/**
 * Chakki Ledger - Centralized Rice → Atta Settlement Service
 *
 * Core domain service managing:
 * 1. Business Formula:
 *    Rice Value = riceQuantity × ricePurchaseRate
 *    Atta Value = attaQuantity × attaSellingRate
 *    Settlement = attaValue - riceValue
 *    - settlement > 0: Customer pays the shop
 *    - settlement < 0: Shop pays the customer (Customer receives)
 *    - settlement = 0: Settled exactly
 * 2. Plain language presentation (never show confusing negative amounts to the user)
 * 3. Retrieval of business rates from configuration (never hardcoding in UI)
 * 4. Immutable historical rate locking on transaction items
 * 5. Permission-gated custom rate overrides with mandatory audit reason
 * 6. Explicit distinction between settlement calculation and physical payment status
 *    (CALCULATED, PENDING, PAID, PARTIAL)
 * 7. Safe decimal arithmetic avoiding floating-point precision issues
 */

import {
  AttaType,
  GrainType,
  GrainUnit,
  ItemDirection,
  ItemType,
  RateConfiguration,
  SettlementDirection,
  SettlementPaymentStatus,
  Transaction,
  TransactionType,
  UserRole,
} from '../types';
import { dbRepository } from '../db/in-memory-db';
import {
  safeMultiply,
  safeSubtract,
  roundCurrency,
  roundQuantity,
  formatKg,
  formatRupees,
} from '../utils/precision';
import { TransactionItemInput } from '../modules/transactions/definitions';
import { TransactionService, ActorInfo, CreateTransactionResult } from './transaction.service';

export interface RiceAttaSettlementInput {
  riceQuantity: number;
  riceRate?: number;
  isCustomRiceRate?: boolean;
  riceOverrideReason?: string;

  attaType: AttaType;
  attaQuantity: number;
  attaRate?: number;
  isCustomAttaRate?: boolean;
  attaOverrideReason?: string;

  paymentOption?: 'PAID_NOW' | 'PENDING' | 'PARTIAL';
  cashPaidAmount?: number;

  rates?: RateConfiguration;
  actorRole?: UserRole;
}

export interface RiceAttaSettlementCalculation {
  riceQuantity: number;
  riceRate: number;
  standardRiceRate: number;
  isCustomRiceRate: boolean;
  riceOverrideReason?: string;
  riceValue: number;

  attaType: AttaType;
  attaTypeName: string;
  attaQuantity: number;
  attaRate: number;
  standardAttaRate: number;
  isCustomAttaRate: boolean;
  attaOverrideReason?: string;
  attaValue: number;

  settlementRawDelta: number; // attaValue - riceValue (>0 customer pays, <0 customer receives)
  settlementAmount: number;   // absolute difference
  settlementDirection: SettlementDirection; // 'CUSTOMER_PAYS' | 'CUSTOMER_RECEIVES' | 'SETTLED'
  plainLanguageResult: string; // "CUSTOMER RECEIVES ₹115" | "CUSTOMER PAYS ₹110" | "SETTLED EXACTLY"

  paymentStatus: SettlementPaymentStatus;
  effectivePaidAmount: number;
  customerBalanceDelta: number;

  riceSummary: string;
  attaSummary: string;
  explanationText: string;
  summaryText: string;

  detailedLines: Array<{
    label: string;
    subtext?: string;
    quantity?: number;
    unit?: string;
    rate?: number;
    amount?: number;
    type?: 'in' | 'out';
    isHighlight?: boolean;
  }>;
}

export interface CreateRiceAttaSettlementRequest {
  customerId: string;
  calculation: RiceAttaSettlementCalculation;
  paymentOption: 'PAID_NOW' | 'PENDING' | 'PARTIAL';
  cashPaidAmount?: number;
  notes?: string;
  date?: string;
  idempotencyKey?: string;
}

export class RiceAttaSettlementService {
  /**
   * Look up configured default purchase rate for ration rice
   */
  public static getDefaultRiceRate(rates?: RateConfiguration): number {
    const config = rates || dbRepository.getRates();
    return roundCurrency(config.ricePurchaseRate ?? 21.0);
  }

  /**
   * Look up configured default selling rate for selected atta type
   */
  public static getDefaultAttaRate(attaType: AttaType, rates?: RateConfiguration): number {
    const config = rates || dbRepository.getRates();
    if (attaType === AttaType.CHALI_ATTA) {
      return roundCurrency(config.chaliAttaSellingRate ?? 35.0);
    }
    return roundCurrency(config.rollAttaSellingRate ?? 40.0);
  }

  /**
   * Get human-readable name for atta type
   */
  public static getAttaTypeName(attaType: AttaType): string {
    return attaType === AttaType.CHALI_ATTA ? 'Chali Atta' : 'Roll Atta';
  }

  /**
   * Validates input values before calculation/submission
   */
  public static validateRiceAttaSettlement(input: Partial<RiceAttaSettlementInput>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    const riceQty = input.riceQuantity ?? 0;
    if (riceQty < 0) {
      errors.push('Rice quantity cannot be negative.');
    }

    if (input.riceRate !== undefined && input.riceRate < 0) {
      errors.push('Rice purchase rate cannot be negative.');
    }

    const attaQty = input.attaQuantity ?? 0;
    if (attaQty < 0) {
      errors.push('Atta quantity cannot be negative.');
    }

    if (riceQty === 0 && attaQty === 0) {
      errors.push('At least one of Rice quantity or Atta quantity must be greater than 0 kg.');
    }

    if (input.attaRate !== undefined && input.attaRate < 0) {
      errors.push('Atta selling rate cannot be negative.');
    }

    if (!input.attaType) {
      errors.push('Atta type (Roll Atta or Chali Atta) is required.');
    }

    if (input.isCustomRiceRate) {
      if (!input.riceOverrideReason?.trim()) {
        errors.push('Reason is required for custom rice rate override.');
      }
      if (input.actorRole && input.actorRole !== UserRole.OWNER) {
        errors.push('Only Owner can override rice rates.');
      }
    }

    if (input.isCustomAttaRate) {
      if (!input.attaOverrideReason?.trim()) {
        errors.push('Reason is required for custom atta rate override.');
      }
      if (input.actorRole && input.actorRole !== UserRole.OWNER) {
        errors.push('Only Owner can override atta rates.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Centralized Calculation:
   *
   * Rice Value = riceQuantity × ricePurchaseRate
   * Atta Value = attaQuantity × attaSellingRate
   * Settlement = attaValue - riceValue
   *
   * If settlement > 0: Customer pays shop (CUSTOMER_PAYS)
   * If settlement < 0: Shop pays customer (CUSTOMER_RECEIVES)
   * If settlement = 0: Settled exactly (SETTLED)
   */
  public static calculateRiceAttaSettlement(input: RiceAttaSettlementInput): RiceAttaSettlementCalculation {
    const rates = input.rates || dbRepository.getRates();
    const attaType = input.attaType || AttaType.ROLL_ATTA;
    const attaTypeName = this.getAttaTypeName(attaType);

    const standardRiceRate = this.getDefaultRiceRate(rates);
    const standardAttaRate = this.getDefaultAttaRate(attaType, rates);

    const riceQty = roundQuantity(input.riceQuantity || 0);
    const attaQty = roundQuantity(input.attaQuantity || 0);

    // 1. Resolve applied rice rate (with permission & reason checking)
    let appliedRiceRate = standardRiceRate;
    let isCustomRice = false;
    let riceReason = input.riceOverrideReason?.trim();

    if (input.isCustomRiceRate && typeof input.riceRate === 'number' && input.riceRate > 0) {
      if (input.actorRole && input.actorRole !== UserRole.OWNER) {
        throw new Error('Your account does not have permission to override rice rates.');
      }
      if (!riceReason) {
        throw new Error('Reason is required for custom rice rate override.');
      }
      appliedRiceRate = roundCurrency(input.riceRate);
      isCustomRice = true;
    }

    // 2. Resolve applied atta rate (with permission & reason checking)
    let appliedAttaRate = standardAttaRate;
    let isCustomAtta = false;
    let attaReason = input.attaOverrideReason?.trim();

    if (input.isCustomAttaRate && typeof input.attaRate === 'number' && input.attaRate > 0) {
      if (input.actorRole && input.actorRole !== UserRole.OWNER) {
        throw new Error('Your account does not have permission to override atta rates.');
      }
      if (!attaReason) {
        throw new Error('Reason is required for custom atta rate override.');
      }
      appliedAttaRate = roundCurrency(input.attaRate);
      isCustomAtta = true;
    }

    // 3. Compute component values with safe currency arithmetic
    const riceValue = safeMultiply(riceQty, appliedRiceRate);
    const attaValue = safeMultiply(attaQty, appliedAttaRate);

    // 4. Compute Settlement
    // Formula: attaValue - riceValue
    const settlementRawDelta = safeSubtract(attaValue, riceValue);
    const settlementAmount = Math.abs(settlementRawDelta);

    let settlementDirection: SettlementDirection;
    let plainLanguageResult: string;

    if (settlementRawDelta > 0) {
      settlementDirection = 'CUSTOMER_PAYS';
      plainLanguageResult = `CUSTOMER PAYS ${formatRupees(settlementAmount)}`;
    } else if (settlementRawDelta < 0) {
      settlementDirection = 'CUSTOMER_RECEIVES';
      plainLanguageResult = `CUSTOMER RECEIVES ${formatRupees(settlementAmount)}`;
    } else {
      settlementDirection = 'SETTLED';
      plainLanguageResult = 'SETTLED EXACTLY';
    }

    // 5. Payment status & khata balance impact
    const paymentOption = input.paymentOption || 'PENDING';
    let paymentStatus: SettlementPaymentStatus;
    let effectivePaidAmount = 0;
    let customerBalanceDelta = 0;

    if (settlementDirection === 'SETTLED') {
      paymentStatus = SettlementPaymentStatus.PAID;
      effectivePaidAmount = 0;
      customerBalanceDelta = 0;
    } else if (settlementDirection === 'CUSTOMER_RECEIVES') {
      // Shop owes customer settlementAmount
      if (paymentOption === 'PAID_NOW') {
        paymentStatus = SettlementPaymentStatus.PAID;
        effectivePaidAmount = settlementAmount;
        customerBalanceDelta = 0; // Handed cash immediately, balance settled
      } else {
        paymentStatus = SettlementPaymentStatus.PENDING;
        effectivePaidAmount = 0;
        customerBalanceDelta = -settlementAmount; // Customer has credit on khata
      }
    } else {
      // CUSTOMER_PAYS: Customer owes shop settlementAmount
      if (paymentOption === 'PAID_NOW') {
        paymentStatus = SettlementPaymentStatus.PAID;
        effectivePaidAmount = settlementAmount;
        customerBalanceDelta = 0; // Customer paid cash immediately, balance settled
      } else if (paymentOption === 'PARTIAL') {
        const cash = roundCurrency(input.cashPaidAmount || 0);
        effectivePaidAmount = cash;
        customerBalanceDelta = safeSubtract(settlementAmount, cash);
        paymentStatus = cash >= settlementAmount
          ? SettlementPaymentStatus.PAID
          : cash > 0
          ? SettlementPaymentStatus.PARTIAL
          : SettlementPaymentStatus.PENDING;
      } else {
        paymentStatus = SettlementPaymentStatus.PENDING;
        effectivePaidAmount = 0;
        customerBalanceDelta = settlementAmount; // Added to customer dues
      }
    }

    const riceSummary = `${formatKg(riceQty)} Ration Rice × ₹${appliedRiceRate}/kg = ${formatRupees(riceValue)}`;
    const attaSummary = `${formatKg(attaQty)} ${attaTypeName} × ₹${appliedAttaRate}/kg = ${formatRupees(attaValue)}`;
    const explanationText = `Rice Credit: ${formatRupees(riceValue)} | Atta Bill: ${formatRupees(attaValue)} → ${plainLanguageResult}`;
    const summaryText = `${formatKg(riceQty)} Rice (${formatRupees(riceValue)}) ⇄ ${formatKg(attaQty)} ${attaTypeName} (${formatRupees(attaValue)})`;

    const detailedLines = [
      {
        label: 'Rice Credit (Inflow)',
        subtext: `${formatKg(riceQty)} × ₹${appliedRiceRate}/kg`,
        quantity: riceQty,
        unit: 'kg',
        rate: appliedRiceRate,
        amount: riceValue,
        type: 'in' as const,
      },
      {
        label: `${attaTypeName} Bill (Outflow)`,
        subtext: `${formatKg(attaQty)} × ₹${appliedAttaRate}/kg`,
        quantity: attaQty,
        unit: 'kg',
        rate: appliedAttaRate,
        amount: attaValue,
        type: 'out' as const,
      },
      {
        label: 'Settlement Result',
        subtext: plainLanguageResult,
        amount: settlementAmount,
        isHighlight: true,
      },
    ];

    return {
      riceQuantity: riceQty,
      riceRate: appliedRiceRate,
      standardRiceRate,
      isCustomRiceRate: isCustomRice,
      riceOverrideReason: riceReason,
      riceValue,

      attaType,
      attaTypeName,
      attaQuantity: attaQty,
      attaRate: appliedAttaRate,
      standardAttaRate,
      isCustomAttaRate: isCustomAtta,
      attaOverrideReason: attaReason,
      attaValue,

      settlementRawDelta,
      settlementAmount,
      settlementDirection,
      plainLanguageResult,

      paymentStatus,
      effectivePaidAmount,
      customerBalanceDelta,

      riceSummary,
      attaSummary,
      explanationText,
      summaryText,

      detailedLines,
    };
  }

  /**
   * Builds normalized transaction items for RICE_ATTA_SETTLEMENT
   */
  public static buildTransactionItems(
    calc: RiceAttaSettlementCalculation,
    notes?: string
  ): TransactionItemInput[] {
    const items: TransactionItemInput[] = [
      // 1. Rice Inflow Item
      {
        itemType: ItemType.RICE,
        direction: ItemDirection.IN,
        grainType: GrainType.RATION_RICE,
        quantity: calc.riceQuantity,
        unit: GrainUnit.KG,
        ratePerUnit: calc.riceRate,
        totalAmount: calc.riceValue,
        notes: notes ? `${notes} (Rice received)` : 'Ration rice received from customer',
      },
      // 2. Atta Outflow Item
      {
        itemType: ItemType.ATTA,
        direction: ItemDirection.OUT,
        grainType: calc.attaType === AttaType.CHALI_ATTA ? GrainType.CHALI_ATTA : GrainType.ROLL_ATTA,
        attaType: calc.attaType,
        quantity: calc.attaQuantity,
        unit: GrainUnit.KG,
        ratePerUnit: calc.attaRate,
        totalAmount: calc.attaValue,
        notes: notes ? `${notes} (${calc.attaTypeName} delivered)` : `${calc.attaTypeName} delivered to customer`,
      },
    ];

    // 3. Cash Settlement Item (if cash moved physically)
    if (calc.effectivePaidAmount > 0) {
      if (calc.settlementDirection === 'CUSTOMER_RECEIVES') {
        items.push({
          itemType: ItemType.CASH,
          direction: ItemDirection.OUT,
          quantity: 1,
          unit: 'RUPEE',
          ratePerUnit: calc.effectivePaidAmount,
          totalAmount: calc.effectivePaidAmount,
          notes: 'Settlement cash paid by shop to customer',
        });
      } else if (calc.settlementDirection === 'CUSTOMER_PAYS') {
        items.push({
          itemType: ItemType.CASH,
          direction: ItemDirection.IN,
          quantity: 1,
          unit: 'RUPEE',
          ratePerUnit: calc.effectivePaidAmount,
          totalAmount: calc.effectivePaidAmount,
          notes: 'Settlement cash paid by customer to shop',
        });
      }
    }

    return items;
  }

  /**
   * Atomically creates a RICE_ATTA_SETTLEMENT transaction via TransactionService
   */
  public static async createRiceAttaSettlement(
    request: CreateRiceAttaSettlementRequest,
    actor: ActorInfo
  ): Promise<CreateTransactionResult> {
    const { calculation, customerId, notes, date, idempotencyKey } = request;

    if (!customerId) {
      throw new Error('Customer is required for Rice → Atta Settlement.');
    }

    const customer = dbRepository.getCustomerById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} does not exist.`);
    }

    // Build audit remarks if rate overrides were used
    const auditNotes: string[] = [];
    if (notes) auditNotes.push(notes);
    if (calculation.isCustomRiceRate) {
      auditNotes.push(
        `[Custom Rice Rate: ₹${calculation.riceRate}/kg (Std: ₹${calculation.standardRiceRate}/kg). Reason: ${calculation.riceOverrideReason}]`
      );
    }
    if (calculation.isCustomAttaRate) {
      auditNotes.push(
        `[Custom Atta Rate: ₹${calculation.attaRate}/kg (Std: ₹${calculation.standardAttaRate}/kg). Reason: ${calculation.attaOverrideReason}]`
      );
    }

    const items = this.buildTransactionItems(calculation, notes);

    const dto = {
      type: TransactionType.RICE_ATTA_SETTLEMENT,
      customerId,
      items,
      paidAmount: calculation.effectivePaidAmount,
      paymentStatus: calculation.paymentStatus,
      notes: auditNotes.join(' '),
      description: calculation.summaryText,
      date,
    };

    return await TransactionService.createTransaction(dto, actor, idempotencyKey);
  }

  /**
   * Look up an existing Rice Atta Settlement transaction
   */
  public static getRiceAttaSettlement(transactionId: string): Transaction | undefined {
    const txn = dbRepository.getTransactionById(transactionId);
    if (txn && txn.type === TransactionType.RICE_ATTA_SETTLEMENT) {
      return txn;
    }
    return undefined;
  }
}
