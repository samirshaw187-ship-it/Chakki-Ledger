/**
 * Chakki Ledger - Centralized Grain → Cash Settlement Service
 *
 * Handles two core direct grain cash purchase workflows:
 * 1. RICE → CASH (RICE_CASH_SETTLEMENT)
 *    Customer brings ration rice and receives its monetary value in cash.
 * 2. WHEAT → CASH (WHEAT_CASH_SETTLEMENT)
 *    Customer brings wheat and receives its monetary value in cash (without atta exchange).
 *
 * Core Business Rules:
 * - Grain Value = Quantity (kg) × Applied Cash Purchase Rate (₹/kg)
 * - Final Settlement = CUSTOMER RECEIVES ₹{Grain Value}
 * - Cash Payment Status: PAID | PENDING | PARTIAL
 * - Overpayment rejected: 0 <= amountPaid <= settlementAmount
 * - Remaining balance: settlementAmount - amountPaid
 * - NO ATTA OUT! Zero atta movement in items and ledger.
 * - Historical rate immutability: TransactionItem.ratePerUnit permanently locked.
 * - Rate configuration separation: Wheat Cash Purchase Rate is distinct from Atta milling rates.
 */

import {
  GrainType,
  GrainUnit,
  ItemDirection,
  ItemType,
  LedgerDirection,
  LedgerEntry,
  LedgerEntryType,
  LedgerStatus,
  LedgerUnit,
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
import { RateService } from './rate.service';

export interface GrainCashSettlementInput {
  grainType: GrainType.RATION_RICE | GrainType.WHEAT;
  quantity: number;
  rate?: number;
  isCustomRate?: boolean;
  overrideReason?: string;
  paymentOption?: 'PAID' | 'PENDING' | 'PARTIAL';
  amountPaid?: number;
  rates?: RateConfiguration;
  actorRole?: UserRole;
}

export interface GrainCashSettlementCalculation {
  grainType: GrainType.RATION_RICE | GrainType.WHEAT;
  grainName: string;
  transactionType: TransactionType.RICE_CASH_SETTLEMENT | TransactionType.WHEAT_CASH_SETTLEMENT;
  quantity: number;
  rate: number;
  standardRate: number;
  isCustomRate: boolean;
  overrideReason?: string;

  grossValue: number;
  settlementAmount: number;
  settlementDirection: SettlementDirection; // 'CUSTOMER_RECEIVES'
  plainLanguageResult: string; // e.g. "CUSTOMER RECEIVES ₹315"

  paymentStatus: SettlementPaymentStatus; // PAID | PENDING | PARTIAL
  amountPaid: number;
  remainingAmount: number;
  customerBalanceDelta: number; // 0 if paid, -remainingAmount if pending/partial (customer credit)

  summaryText: string;
  explanationText: string;
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

export class GrainCashSettlementService {
  /**
   * Retrieves configured standard Rice Cash Purchase Rate
   */
  public static getDefaultRiceCashRate(rates?: RateConfiguration): number {
    const config = rates || dbRepository.getRates();
    return RateService.getRiceCashPurchaseRate(config);
  }

  /**
   * Retrieves configured standard Wheat Cash Purchase Rate
   * IMPORTANT: Never assumes this is the milling exchange rate (₹8 or ₹10)!
   */
  public static getDefaultWheatCashRate(rates?: RateConfiguration): number {
    const config = rates || dbRepository.getRates();
    return RateService.getWheatCashPurchaseRate(config);
  }

  /**
   * Helper to get default cash rate for given grain type
   */
  public static getDefaultRate(grainType: GrainType, rates?: RateConfiguration): number {
    if (grainType === GrainType.WHEAT) {
      return this.getDefaultWheatCashRate(rates);
    }
    return this.getDefaultRiceCashRate(rates);
  }

  /**
   * Authoritative backend calculation for Rice → Cash Settlement
   */
  public static calculateRiceCashSettlement(
    input: Omit<GrainCashSettlementInput, 'grainType'>
  ): GrainCashSettlementCalculation {
    return this.calculateGrainCashSettlement({
      ...input,
      grainType: GrainType.RATION_RICE,
    });
  }

  /**
   * Authoritative backend calculation for Wheat → Cash Settlement
   */
  public static calculateWheatCashSettlement(
    input: Omit<GrainCashSettlementInput, 'grainType'>
  ): GrainCashSettlementCalculation {
    return this.calculateGrainCashSettlement({
      ...input,
      grainType: GrainType.WHEAT,
    });
  }

  /**
   * Unified authoritative calculation engine for grain cash purchase
   */
  public static calculateGrainCashSettlement(
    input: GrainCashSettlementInput
  ): GrainCashSettlementCalculation {
    const rates = input.rates || dbRepository.getRates();
    const isRice = input.grainType === GrainType.RATION_RICE;
    const grainName = isRice ? 'Ration Rice' : 'Wheat';
    const transactionType = isRice
      ? TransactionType.RICE_CASH_SETTLEMENT
      : TransactionType.WHEAT_CASH_SETTLEMENT;

    // 1. Validate Quantity
    const qty = roundQuantity(input.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`Please enter a valid ${grainName} quantity greater than 0 kg.`);
    }

    // 2. Resolve Rate (Standard vs Custom Override)
    const standardRate = isRice
      ? this.getDefaultRiceCashRate(rates)
      : this.getDefaultWheatCashRate(rates);

    let appliedRate = standardRate;
    let isCustom = false;
    const reason = (input.overrideReason || '').trim();

    if (input.isCustomRate) {
      if (input.actorRole && input.actorRole !== UserRole.OWNER) {
        throw new Error('Only the Shop Owner has permission to override grain cash purchase rates.');
      }
      if (typeof input.rate !== 'number' || !Number.isFinite(input.rate) || input.rate <= 0) {
        throw new Error('Please enter a valid purchase rate greater than ₹0/kg.');
      }
      if (!reason || reason.length < 4) {
        throw new Error('A detailed reason (at least 4 characters) is required when overriding the standard purchase rate.');
      }
      appliedRate = roundCurrency(input.rate);
      isCustom = true;
    }

    // 3. Authoritative Monetary Value: Quantity × Rate
    const grossValue = safeMultiply(qty, appliedRate);
    const settlementAmount = grossValue;
    const settlementDirection: SettlementDirection = 'CUSTOMER_RECEIVES';
    const plainLanguageResult = `CUSTOMER RECEIVES ${formatRupees(settlementAmount)}`;

    // 4. Payment Status & Cash Breakdown
    const paymentOption = input.paymentOption || 'PAID';
    let paymentStatus: SettlementPaymentStatus;
    let amountPaid: number;
    let remainingAmount: number;

    if (paymentOption === 'PAID') {
      paymentStatus = SettlementPaymentStatus.PAID;
      amountPaid = settlementAmount;
      remainingAmount = 0;
    } else if (paymentOption === 'PENDING') {
      paymentStatus = SettlementPaymentStatus.PENDING;
      amountPaid = 0;
      remainingAmount = settlementAmount;
    } else if (paymentOption === 'PARTIAL') {
      const candidatePaid = roundCurrency(input.amountPaid ?? 0);
      if (candidatePaid < 0) {
        throw new Error('Amount paid cannot be negative.');
      }
      if (candidatePaid > settlementAmount) {
        throw new Error(
          `Amount paid (${formatRupees(candidatePaid)}) cannot exceed the total grain value (${formatRupees(settlementAmount)}). Overpayment is not allowed.`
        );
      }
      amountPaid = candidatePaid;
      remainingAmount = safeSubtract(settlementAmount, amountPaid);

      if (amountPaid === settlementAmount) {
        paymentStatus = SettlementPaymentStatus.PAID;
      } else if (amountPaid === 0) {
        paymentStatus = SettlementPaymentStatus.PENDING;
      } else {
        paymentStatus = SettlementPaymentStatus.PARTIAL;
      }
    } else {
      paymentStatus = SettlementPaymentStatus.PAID;
      amountPaid = settlementAmount;
      remainingAmount = 0;
    }

    // 5. Khata Impact (Shop owes customer money = customer credit)
    // If fully paid, customer received all cash => 0 balance delta.
    // If pending or partial, shop owes customer the remaining balance => negative balanceDelta (credit).
    const customerBalanceDelta = remainingAmount > 0 ? -remainingAmount : 0;

    const summaryText = `${formatKg(qty)} ${grainName} @ ₹${appliedRate}/kg = ${formatRupees(settlementAmount)}`;
    const explanationText = `${grainName} Value: ${formatRupees(grossValue)} → ${plainLanguageResult} (${paymentStatus})`;

    const detailedLines = [
      {
        label: `${grainName} Inflow (Shop Buys)`,
        subtext: `${formatKg(qty)} × ₹${appliedRate}/kg`,
        quantity: qty,
        unit: 'kg',
        rate: appliedRate,
        amount: grossValue,
        type: 'in' as const,
      },
      {
        label: 'Grain Cash Value',
        subtext: plainLanguageResult,
        amount: settlementAmount,
        isHighlight: true,
      },
      {
        label: 'Cash Paid Out Now',
        subtext: paymentStatus === SettlementPaymentStatus.PAID
          ? 'Full settlement cash paid at counter'
          : paymentStatus === SettlementPaymentStatus.PARTIAL
          ? `Partial payment made (${formatRupees(amountPaid)})`
          : 'Payment pending completion',
        amount: amountPaid,
        type: 'out' as const,
      },
      ...(remainingAmount > 0
        ? [
            {
              label: 'Remaining Payable to Customer',
              subtext: 'Credited to customer khata account',
              amount: remainingAmount,
              isHighlight: true,
            },
          ]
        : []),
    ];

    return {
      grainType: input.grainType,
      grainName,
      transactionType,
      quantity: qty,
      rate: appliedRate,
      standardRate,
      isCustomRate: isCustom,
      overrideReason: isCustom ? reason : undefined,
      grossValue,
      settlementAmount,
      settlementDirection,
      plainLanguageResult,
      paymentStatus,
      amountPaid,
      remainingAmount,
      customerBalanceDelta,
      summaryText,
      explanationText,
      detailedLines,
    };
  }

  /**
   * Builds immutable TransactionItemInput array for grain cash settlement
   * Guarantees:
   * 1. Grain Item: Direction IN (Quantity, Applied Rate, Total)
   * 2. Cash Item: Direction OUT (Amount paid now)
   * 3. ZERO ATTA movement!
   */
  public static buildTransactionItems(
    calc: GrainCashSettlementCalculation,
    notes?: string
  ): TransactionItemInput[] {
    const isRice = calc.grainType === GrainType.RATION_RICE;

    const grainItem: TransactionItemInput = {
      itemType: isRice ? ItemType.RICE : ItemType.WHEAT,
      direction: ItemDirection.IN,
      grainType: calc.grainType,
      quantity: calc.quantity,
      unit: GrainUnit.KG,
      ratePerUnit: calc.rate,
      totalAmount: calc.settlementAmount,
      notes: notes
        ? `${notes} (${calc.grainName} purchased for cash)`
        : `${formatKg(calc.quantity)} ${calc.grainName} purchased @ ₹${calc.rate}/kg`,
      metadata: {
        standardRate: calc.standardRate,
        isCustomRate: calc.isCustomRate,
        overrideReason: calc.overrideReason,
      },
    };

    const cashItem: TransactionItemInput = {
      itemType: ItemType.CASH,
      direction: ItemDirection.OUT,
      quantity: 1,
      unit: 'RUPEE',
      ratePerUnit: calc.amountPaid,
      totalAmount: calc.amountPaid,
      notes:
        calc.paymentStatus === SettlementPaymentStatus.PAID
          ? `Full cash payment of ${formatRupees(calc.amountPaid)} handed to customer`
          : calc.paymentStatus === SettlementPaymentStatus.PARTIAL
          ? `Partial cash payment of ${formatRupees(calc.amountPaid)} handed to customer (${formatRupees(calc.remainingAmount)} remaining)`
          : `Cash payment of ${formatRupees(calc.settlementAmount)} pending completion`,
      metadata: {
        settlementAmount: calc.settlementAmount,
        amountPaid: calc.amountPaid,
        remainingAmount: calc.remainingAmount,
        paymentStatus: calc.paymentStatus,
      },
    };

    return [grainItem, cashItem];
  }

  /**
   * Builds authoritative ledger entries for the transaction engine
   * Guarantees:
   * - Grain IN: Stock logged
   * - Wheat OUT balancing entry for wheat balance integrity (grain was bought by shop, not deposited for milling)
   * - Cash OUT: Recorded for actual cash paid
   * - Cash CREDIT: Recorded if remaining balance owed to customer
   * - ZERO Atta entries!
   */
  public static buildLedgerEntries(
    tx: Transaction,
    customerName?: string
  ): Array<Omit<LedgerEntry, 'id' | 'createdAt'>> {
    if (!tx.customerId) return [];

    const isRice = tx.type === TransactionType.RICE_CASH_SETTLEMENT;
    const grainItem = tx.items.find((i) =>
      isRice
        ? i.itemType === ItemType.RICE || i.grainType === GrainType.RATION_RICE
        : i.itemType === ItemType.WHEAT || i.grainType === GrainType.WHEAT
    );
    const cashItem = tx.items.find((i) => i.itemType === ItemType.CASH);

    const qty = roundQuantity(grainItem?.quantity || 0);
    const rate = roundCurrency(grainItem?.ratePerUnit || 0);
    const grainTotal = grainItem?.totalAmount || tx.netAmount;
    const amountPaid = roundCurrency(tx.paidAmount || cashItem?.totalAmount || 0);
    const remaining = safeSubtract(tx.netAmount, amountPaid);
    const name = customerName || tx.customerName || 'Customer';

    const entries: Array<Omit<LedgerEntry, 'id' | 'createdAt'>> = [];

    // 1. Grain Inflow (Record grain intake)
    entries.push({
      customerId: tx.customerId,
      customerName: name,
      transactionId: tx.id,
      transactionNumber: tx.transactionNumber,
      entryType: isRice ? LedgerEntryType.RICE : LedgerEntryType.WHEAT,
      quantity: qty,
      unit: LedgerUnit.KG,
      rate,
      amount: grainTotal,
      direction: LedgerDirection.IN,
      status: LedgerStatus.SETTLED,
      description: `${isRice ? 'Ration Rice' : 'Wheat'} Purchased for Cash (${formatKg(qty)} @ ₹${rate}/kg)`,
      date: tx.date,
      createdById: tx.createdById,
      createdByName: tx.createdByName,
      notes: tx.notes,
    });

    // 2. If Wheat: Post balancing outflow entry so customer's milling deposit balance is not artificially inflated
    if (!isRice && qty > 0) {
      entries.push({
        customerId: tx.customerId,
        customerName: name,
        transactionId: tx.id,
        transactionNumber: tx.transactionNumber,
        entryType: LedgerEntryType.WHEAT,
        quantity: qty,
        unit: LedgerUnit.KG,
        rate,
        amount: 0,
        direction: LedgerDirection.OUT,
        status: LedgerStatus.SETTLED,
        description: `Wheat Sold to Shop for Cash (${formatKg(qty)})`,
        date: tx.date,
        createdById: tx.createdById,
        createdByName: tx.createdByName,
        notes: tx.notes,
      });
    }

    // 3. Cash Outflow (Actual cash paid to customer at counter)
    if (amountPaid > 0) {
      entries.push({
        customerId: tx.customerId,
        customerName: name,
        transactionId: tx.id,
        transactionNumber: tx.transactionNumber,
        entryType: LedgerEntryType.CASH,
        amount: amountPaid,
        unit: LedgerUnit.RUPEE,
        direction: LedgerDirection.OUT,
        status: LedgerStatus.SETTLED,
        description: `Cash Paid to Customer (${formatRupees(amountPaid)} for ${isRice ? 'Rice' : 'Wheat'})`,
        date: tx.date,
        createdById: tx.createdById,
        createdByName: tx.createdByName,
        notes: tx.notes,
      });
    }

    // 4. Record the full payable obligation. The actual cash outflow above
    // offsets the paid portion, leaving only the unpaid remainder as credit.
    if (tx.netAmount > 0) {
      entries.push({
        customerId: tx.customerId,
        customerName: name,
        transactionId: tx.id,
        transactionNumber: tx.transactionNumber,
        entryType: LedgerEntryType.CASH,
        amount: tx.netAmount,
        unit: LedgerUnit.RUPEE,
        direction: LedgerDirection.IN,
        status: LedgerStatus.CREDIT,
        description: `Unpaid ${isRice ? 'Rice' : 'Wheat'} Value Due to Customer (${formatRupees(remaining)} Khata Credit)`,
        date: tx.date,
        createdById: tx.createdById,
        createdByName: tx.createdByName,
        notes: tx.notes,
      });
    }

    return entries;
  }

  /**
   * Helper to execute and persist grain cash settlement transaction through TransactionService
   */
  public static async executeGrainCashSettlement(
    customerId: string,
    calc: GrainCashSettlementCalculation,
    actor: ActorInfo,
    notes?: string,
    customDate?: string,
    idempotencyKey?: string
  ): Promise<CreateTransactionResult> {
    const items = this.buildTransactionItems(calc, notes);
    return TransactionService.createTransaction(
      {
        type: calc.transactionType,
        customerId,
        date: customDate || new Date().toISOString().split('T')[0],
        items,
        paidAmount: calc.amountPaid,
        notes: notes || calc.summaryText,
      },
      actor,
      idempotencyKey
    );
  }
}
