/**
 * Chakki Ledger - Transaction Domain Service
 *
 * The Transaction system is the central source of truth for all business activities.
 *
 * Key Principles:
 * 1. Unique immutable identity (UUID + Human-readable TXN-YYYYMMDD-XXXXX).
 * 2. Fully traceable to customer, operator user, date, time, items, and audit.
 * 3. Never silently deleted or destructively overwritten.
 * 4. Atomic execution: validation, transaction creation, item creation, ledger entries,
 *    and audit log occur in a single atomic transaction with rollback protection.
 * 5. Duplicate submission protection via client idempotency tokens.
 */

import {
  Transaction,
  TransactionItem,
  TransactionType,
  TransactionStatus,
  SettlementPaymentStatus,
  UserRole,
  AuditAction,
  AuditLogEntry,
  Customer,
  GrainType,
  ItemDirection,
  LedgerEntryType,
  LedgerUnit,
  LedgerDirection,
  LedgerStatus,
} from '../types';
import { dbRepository } from '../db/in-memory-db';
import { TransactionNumberService } from './transaction-number.service';
import {
  TransactionValidationService,
  CreateTransactionDTO,
} from './transaction-validation.service';
import { TRANSACTION_DEFINITIONS } from '../modules/transactions/definitions';
import { LedgerService } from './ledger.service';
import { AuditService } from './audit.service';
import { roundCurrency, roundQuantity } from '../utils/precision';
import { hasPermission, Permission } from '../modules/auth/permissions';

export interface ActorInfo {
  id: string;
  name: string;
  role: UserRole;
}

export interface CorrectionItemUpdate {
  index?: number;
  itemId?: string;
  correctedQuantity?: number;
  correctedRatePerUnit?: number;
  newQuantity?: number;
  newRate?: number;
  notes?: string;
}

export interface CorrectionImpactResult {
  originalQuantity: number;
  correctedQuantity: number;
  deltaQuantity: number;
  originalAmount: number;
  correctedAmount: number;
  deltaAmount: number;
  deltaBalance: number;
  summaryText: string;
  hasChanges: boolean;
}

function mapGrainToLedgerType(grain?: GrainType, itemType?: string): LedgerEntryType {
  const it = (itemType || '').toUpperCase();
  if (grain === GrainType.WHEAT || it === 'WHEAT') return LedgerEntryType.WHEAT;
  if (grain === GrainType.RATION_RICE || it === 'RICE' || it === 'RATION_RICE') return LedgerEntryType.RICE;
  if (grain === GrainType.CHALI_ATTA || grain === GrainType.ROLL_ATTA || it === 'ATTA' || it.includes('ATTA')) return LedgerEntryType.ATTA;
  if (grain === GrainType.BRAN || it === 'BRAN') return LedgerEntryType.BRAN;
  if (it === 'CASH') return LedgerEntryType.CASH;
  return LedgerEntryType.WHEAT;
}

export interface TransactionQueryOptions {
  search?: string;
  type?: TransactionType | 'ALL';
  status?: TransactionStatus | 'ALL';
  customerId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'transactionNumber' | 'netAmount';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedTransactionsResult {
  transactions: Transaction[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface CreateTransactionResult {
  success: boolean;
  transaction: Transaction;
  summaryText: string;
}

export class TransactionService {
  // Idempotency cache: stores recent idempotencyKey -> Transaction to prevent double submissions
  private static idempotencyMap: Map<string, { txn: Transaction; timestamp: number }> = new Map();

  /**
   * Atomically creates a confirmed transaction with all its items, ledger entries, and audit record.
   */
  public static async createTransaction(
    dto: CreateTransactionDTO,
    actor: ActorInfo,
    idempotencyKey?: string
  ): Promise<CreateTransactionResult> {
    // 1. Idempotency Check: Prevent duplicate submissions (double-tap protection)
    if (idempotencyKey) {
      const existing = this.idempotencyMap.get(idempotencyKey);
      if (existing && Date.now() - existing.timestamp < 120000) {
        // Return existing transaction within 2 minutes window
        const def = TRANSACTION_DEFINITIONS[existing.txn.type];
        return {
          success: true,
          transaction: existing.txn,
          summaryText: def?.calculate(existing.txn.items as any).settlementText || 'Transaction already submitted',
        };
      }
    }

    // 2. Server-side Validation
    const validation = TransactionValidationService.validate(dto, actor.role);
    if (!validation.isValid) {
      throw new Error(validation.errorSummary || 'Validation failed for transaction request');
    }

    const definition = TRANSACTION_DEFINITIONS[dto.type];
    if (!definition) {
      throw new Error(`Unsupported transaction type: ${dto.type}`);
    }

    // 3. Customer Resolution
    let customer: Customer | undefined;
    if (dto.customerId) {
      customer = dbRepository.getCustomerById(dto.customerId);
      if (!customer && definition.requiresCustomer) {
        throw new Error(`Customer with ID ${dto.customerId} does not exist.`);
      }
    }

    // 4. Server-Authoritative Calculation (never trust frontend numbers blindly)
    const calculation = definition.calculate(dto.items, dto.paidAmount, dto.notes);

    // 5. Generate Human-Readable Unique Transaction Number (TXN-YYYYMMDD-XXXXX)
    const transactionDate = dto.date ? new Date(dto.date) : new Date();
    const transactionNumber = TransactionNumberService.generateNext(transactionDate);
    const transactionId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // 6. Build Immutable Transaction Items
    const items: TransactionItem[] = (dto.items || []).map((inputItem, index) => {
      const itemAmount = roundCurrency(inputItem.totalAmount || 0);
      return {
        id: `item-${Date.now()}-${index + 1}`,
        transactionId,
        itemType: inputItem.itemType,
        direction: inputItem.direction,
        grainType: inputItem.grainType,
        attaType: inputItem.attaType,
        quantity: inputItem.quantity,
        unit: inputItem.unit,
        ratePerUnit: inputItem.ratePerUnit,
        totalAmount: itemAmount,
        notes: inputItem.notes,
        createdAt: transactionDate.toISOString(),
      };
    });

    // 7. Determine initial status
    let initialStatus: TransactionStatus = TransactionStatus.CONFIRMED;
    if (calculation.paidAmount > 0 && calculation.balanceDelta === 0) {
      initialStatus = TransactionStatus.PAID;
    } else if (calculation.settlementDirection === 'SETTLED' && calculation.balanceDelta === 0) {
      initialStatus = TransactionStatus.SETTLED;
    } else if (calculation.paidAmount > 0 && calculation.balanceDelta > 0) {
      initialStatus = TransactionStatus.PARTIAL;
    } else if (calculation.balanceDelta > 0) {
      initialStatus = TransactionStatus.DUE;
    } else if (calculation.balanceDelta < 0) {
      initialStatus = TransactionStatus.CREDIT;
    }

    const newTransaction: Transaction = {
      id: transactionId,
      transactionNumber,
      type: dto.type,
      status: dto.status || initialStatus,
      date: transactionDate.toISOString(),
      customerId: customer?.id,
      customerName: customer?.name,
      customerPhone: customer?.phone,
      customerCode: customer?.customerCode,
      grossAmount: calculation.grossAmount,
      discountAmount: calculation.discountAmount,
      netAmount: calculation.netAmount,
      paidAmount: calculation.paidAmount,
      balanceDelta: calculation.balanceDelta,
      settlementDirection: calculation.settlementDirection,
      paymentStatus: (dto.paymentStatus as any) || (
        calculation.paidAmount > 0 && calculation.balanceDelta === 0
          ? 'PAID'
          : calculation.paidAmount > 0 && calculation.balanceDelta > 0
          ? 'PARTIAL'
          : calculation.balanceDelta > 0
          ? 'DUE'
          : calculation.settlementDirection === 'SETTLED'
          ? 'PAID'
          : 'PENDING'
      ),
      items,
      notes: dto.notes,
      description: dto.description || calculation.itemsSummary,
      createdById: actor.id,
      createdByName: actor.name,
      createdAt: transactionDate.toISOString(),
      updatedAt: transactionDate.toISOString(),
    };

    // 8. ATOMIC SAVE WITH ROLLBACK PROTECTION
    const createdLedgerEntryIds: string[] = [];
    let isTransactionSaved = false;

    try {
      // Step A: Save Transaction
      dbRepository.saveTransaction(newTransaction);
      isTransactionSaved = true;

      // Step B: Build & Insert Corresponding Ledger Entries
      const ledgerPayloads = definition.buildLedgerEntries(newTransaction, customer?.name);
      for (const entryPayload of ledgerPayloads) {
        const createdEntry = dbRepository.addLedgerEntry(entryPayload);
        createdLedgerEntryIds.push(createdEntry.id);
      }

      // Step C: Synchronize Customer Balances from Ledger Foundation
      if (customer) {
        const calculatedBalance = LedgerService.calculateCustomerBalances(customer.id);
        dbRepository.updateCustomer(customer.id, {
          currentDueAmount: calculatedBalance.cashDueAmount,
          wheatBalanceKg: calculatedBalance.wheatBalanceKg,
          riceCreditAmount: calculatedBalance.riceCreditAmount,
          lastTransactionAt: transactionDate.toISOString(),
        });
      }

      // Step D: Create Audit Log Entry
      AuditService.log({
        action: AuditAction.TRANSACTION_CREATED,
        entityType: 'TRANSACTION',
        entityId: newTransaction.id,
        performedById: actor.id,
        performedByName: actor.name,
        reason: `Created ${definition.label} (${newTransaction.transactionNumber}): ${calculation.settlementText}`,
        newState: {
          transactionNumber: newTransaction.transactionNumber,
          type: newTransaction.type,
          status: newTransaction.status,
          customerName: newTransaction.customerName,
          grossAmount: newTransaction.grossAmount,
          netAmount: newTransaction.netAmount,
          balanceDelta: newTransaction.balanceDelta,
          itemsCount: newTransaction.items.length,
        },
      });

      // Step E: Store in idempotency map
      if (idempotencyKey) {
        this.idempotencyMap.set(idempotencyKey, {
          txn: newTransaction,
          timestamp: Date.now(),
        });
      }

      return {
        success: true,
        transaction: newTransaction,
        summaryText: calculation.settlementText,
      };
    } catch (err: any) {
      // ROLLBACK: Revert any partial mutations
      if (isTransactionSaved) {
        dbRepository.removeTransaction(newTransaction.id);
      }
      for (const ledgerId of createdLedgerEntryIds) {
        dbRepository.removeLedgerEntry(ledgerId);
      }
      if (customer) {
        // Recompute balances to previous state
        const restoredBalance = LedgerService.calculateCustomerBalances(customer.id);
        dbRepository.updateCustomer(customer.id, {
          currentDueAmount: restoredBalance.cashDueAmount,
          wheatBalanceKg: restoredBalance.wheatBalanceKg,
          riceCreditAmount: restoredBalance.riceCreditAmount,
        });
      }

      console.error('[TransactionService] Transaction creation failed and was rolled back:', err);
      throw new Error(err.message || 'Transaction could not be saved. All operations were rolled back.');
    }
  }

  /**
   * Retrieves single transaction by ID or Transaction Number
   */
  public static getTransactionById(idOrNumber: string): Transaction | undefined {
    return dbRepository.getTransactionById(idOrNumber);
  }

  /**
   * Server-backed query, search, filtering, and pagination for transactions
   */
  public static getTransactions(options: TransactionQueryOptions = {}): PaginatedTransactionsResult {
    let list = dbRepository.getTransactions();

    // 1. Search Query (Transaction Number, Customer Name, Phone, Customer Code)
    if (options.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      list = list.filter((t) => {
        const matchNumber = t.transactionNumber?.toLowerCase().includes(q);
        const matchName = t.customerName?.toLowerCase().includes(q);
        const matchPhone = t.customerPhone?.toLowerCase().includes(q);
        const matchCode = t.customerCode?.toLowerCase().includes(q);
        const matchType = t.type?.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q);
        return matchNumber || matchName || matchPhone || matchCode || matchType || matchDesc;
      });
    }

    // 2. Type Filter
    if (options.type && options.type !== 'ALL') {
      list = list.filter((t) => t.type === options.type);
    }

    // 3. Status Filter
    if (options.status && options.status !== 'ALL') {
      list = list.filter((t) => t.status === options.status);
    }

    // 4. Customer Filter
    if (options.customerId) {
      list = list.filter((t) => t.customerId === options.customerId);
    }

    // 5. Date Range
    if (options.startDate) {
      const startMs = new Date(options.startDate).getTime();
      list = list.filter((t) => new Date(t.date).getTime() >= startMs);
    }
    if (options.endDate) {
      // Include end of day
      const end = new Date(options.endDate);
      end.setHours(23, 59, 59, 999);
      const endMs = end.getTime();
      list = list.filter((t) => new Date(t.date).getTime() <= endMs);
    }

    // 6. Sorting
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 7. Pagination
    const total = list.length;
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, options.limit || 20);
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedTransactions = list.slice(startIndex, startIndex + limit);

    return {
      transactions: paginatedTransactions,
      total,
      page,
      totalPages,
      limit,
    };
  }

  /**
   * Validate correction parameters and permissions
   */
  public static validateCorrection(
    originalTxId: string,
    role: UserRole,
    reason: string,
    items?: CorrectionItemUpdate[]
  ): { isValid: boolean; error?: string; original?: Transaction } {
    if (!hasPermission(role, Permission.CORRECT_TRANSACTION)) {
      return {
        isValid: false,
        error: 'Unauthorized: Users without TRANSACTION_CORRECT permission are not permitted to perform financial corrections. Only the Shop Owner or Admin can perform corrections.',
      };
    }

    const original = dbRepository.getTransactionById(originalTxId);
    if (!original) {
      return { isValid: false, error: `Transaction ${originalTxId} not found.` };
    }

    if (original.status === TransactionStatus.REVERSED) {
      return {
        isValid: false,
        error: 'Cannot correct a reversed transaction. The transaction has already been reversed.',
      };
    }

    if (!reason || reason.trim().length < 4) {
      return {
        isValid: false,
        error: 'A mandatory, detailed reason (minimum 4 characters) is required for correction.',
      };
    }

    if (items && items.length > 0) {
      for (const it of items) {
        const qty = it.newQuantity !== undefined ? it.newQuantity : it.correctedQuantity;
        const rate = it.newRate !== undefined ? it.newRate : it.correctedRatePerUnit;
        if (qty !== undefined && (typeof qty !== 'number' || qty < 0 || isNaN(qty))) {
          return { isValid: false, error: 'Corrected quantity must be a non-negative number.' };
        }
        if (rate !== undefined && (typeof rate !== 'number' || rate < 0 || isNaN(rate))) {
          return { isValid: false, error: 'Corrected rate must be a non-negative number.' };
        }
      }
    }

    return { isValid: true, original };
  }

  /**
   * Calculates net quantity, rate, and financial impact between original and corrected values
   */
  public static calculateCorrectionImpact(
    original: Transaction,
    itemUpdates: CorrectionItemUpdate[]
  ): CorrectionImpactResult {
    let originalQtyTotal = 0;
    let correctedQtyTotal = 0;
    let originalAmtTotal = 0;
    let correctedAmtTotal = 0;

    const changesList: string[] = [];

    original.items.forEach((origItem, idx) => {
      const update = itemUpdates.find(
        (u) => (u.itemId && u.itemId === origItem.id) || (u.index !== undefined && u.index === idx)
      );
      const newQty = update
        ? (update.newQuantity !== undefined ? update.newQuantity : update.correctedQuantity !== undefined ? update.correctedQuantity : origItem.quantity)
        : origItem.quantity;
      const newRate = update
        ? (update.newRate !== undefined ? update.newRate : update.correctedRatePerUnit !== undefined ? update.correctedRatePerUnit : origItem.ratePerUnit)
        : origItem.ratePerUnit;

      const oldAmt = origItem.totalAmount || (origItem.quantity * origItem.ratePerUnit);
      const newAmt = roundCurrency(newQty * newRate);

      originalQtyTotal += origItem.quantity;
      correctedQtyTotal += newQty;
      originalAmtTotal += oldAmt;
      correctedAmtTotal += newAmt;

      const qDiff = roundQuantity(newQty - origItem.quantity);
      const aDiff = roundCurrency(newAmt - oldAmt);

      if (qDiff !== 0 || aDiff !== 0 || newRate !== origItem.ratePerUnit) {
        const name = origItem.grainType || origItem.attaType || origItem.itemType || `Item #${idx + 1}`;
        changesList.push(
          `${name}: ${origItem.quantity} ${origItem.unit} → ${newQty} ${origItem.unit} (${qDiff >= 0 ? '+' : ''}${qDiff} ${origItem.unit})${
            aDiff !== 0 ? `, Amount: ₹${oldAmt} → ₹${newAmt} (${aDiff >= 0 ? '+₹' : '-₹'}${Math.abs(aDiff)})` : ''
          }`
        );
      }
    });

    const deltaQuantity = roundQuantity(correctedQtyTotal - originalQtyTotal);
    const deltaAmount = roundCurrency(correctedAmtTotal - originalAmtTotal);
    const deltaBalance = deltaAmount;

    const hasChanges = changesList.length > 0;
    const summaryText = hasChanges
      ? changesList.join('; ')
      : 'No quantity or rate changes detected.';

    return {
      originalQuantity: originalQtyTotal,
      correctedQuantity: correctedQtyTotal,
      deltaQuantity,
      originalAmount: originalAmtTotal,
      correctedAmount: correctedAmtTotal,
      deltaAmount,
      deltaBalance,
      summaryText,
      hasChanges,
    };
  }

  /**
   * Atomically executes a non-destructive correction workflow:
   * - Preserves the original record (values unchanged, marked CORRECTED)
   * - Creates a new compensating CORRECTION transaction referencing original
   * - Inserts compensating ledger entries with delta effects
   * - Recalculates customer balances atomically
   * - Records immutable audit trail
   */
  public static async createCorrection(
    originalTxId: string,
    input: {
      reason: string;
      items: CorrectionItemUpdate[];
      idempotencyKey?: string;
    },
    actor: ActorInfo
  ): Promise<{ original: Transaction; correctionTxn: Transaction; summary: string }> {
    // 1. Idempotency Check
    if (input.idempotencyKey) {
      const existing = this.idempotencyMap.get(input.idempotencyKey);
      if (existing && Date.now() - existing.timestamp < 120000) {
        const orig = dbRepository.getTransactionById(originalTxId);
        return {
          original: orig || existing.txn,
          correctionTxn: existing.txn,
          summary: 'Correction was already processed.',
        };
      }
    }

    // 2. Validate
    const validation = this.validateCorrection(originalTxId, actor.role, input.reason, input.items);
    if (!validation.isValid || !validation.original) {
      throw new Error(validation.error || 'Correction validation failed.');
    }

    const original = validation.original;

    // 3. Impact analysis
    const impact = this.calculateCorrectionImpact(original, input.items);
    if (!impact.hasChanges) {
      throw new Error('No differences detected between original values and corrected values. Please adjust quantities or rates.');
    }

    let correctionTxnId = '';
    const createdLedgerEntryIds: string[] = [];

    try {
      // Step A: Preserve original transaction, update status and tracking metadata
      original.status = TransactionStatus.CORRECTED;
      original.correctionCount = (original.correctionCount || 0) + 1;
      original.correctedById = actor.id;
      original.correctedByName = actor.name;
      original.correctedAt = new Date().toISOString();
      original.correctionReason = input.reason;
      original.netCorrectionDiff = `${impact.deltaQuantity >= 0 ? '+' : ''}${impact.deltaQuantity} kg / ${impact.deltaAmount >= 0 ? '+₹' : '-₹'}${Math.abs(impact.deltaAmount)}`;
      original.updatedAt = new Date().toISOString();
      dbRepository.saveTransaction(original);

      // Step B: Build new CORRECTION transaction
      const corrNumber = TransactionNumberService.generateNext(new Date());
      correctionTxnId = `tx-corr-${Date.now()}`;

      // Compensating line items reflecting net differences
      const compensatingItems: TransactionItem[] = [];
      original.items.forEach((origItem, idx) => {
        const update = input.items.find(
          (u) => (u.itemId && u.itemId === origItem.id) || (u.index !== undefined && u.index === idx)
        );
        const newQty = update
          ? (update.newQuantity !== undefined ? update.newQuantity : update.correctedQuantity !== undefined ? update.correctedQuantity : origItem.quantity)
          : origItem.quantity;
        const newRate = update
          ? (update.newRate !== undefined ? update.newRate : update.correctedRatePerUnit !== undefined ? update.correctedRatePerUnit : origItem.ratePerUnit)
          : origItem.ratePerUnit;
        const qDiff = roundQuantity(newQty - origItem.quantity);
        const oldAmt = origItem.totalAmount || (origItem.quantity * origItem.ratePerUnit);
        const newAmt = roundCurrency(newQty * newRate);
        const aDiff = roundCurrency(newAmt - oldAmt);

        if (qDiff !== 0 || aDiff !== 0 || newRate !== origItem.ratePerUnit) {
          compensatingItems.push({
            id: `item-corr-${Date.now()}-${idx}`,
            transactionId: correctionTxnId,
            grainType: origItem.grainType,
            attaType: origItem.attaType,
            itemType: origItem.itemType,
            quantity: Math.abs(qDiff),
            unit: origItem.unit,
            ratePerUnit: newRate,
            totalAmount: Math.abs(aDiff),
            direction: qDiff >= 0 ? origItem.direction : (origItem.direction === ItemDirection.IN ? ItemDirection.OUT : ItemDirection.IN),
            notes: `Correction adjustment: ${qDiff >= 0 ? '+' : ''}${qDiff} ${origItem.unit} @ ₹${newRate}/${origItem.unit}`,
          });
        }
      });

      const newCorrectionTxn: Transaction = {
        id: correctionTxnId,
        transactionNumber: corrNumber,
        type: TransactionType.CORRECTION,
        status: TransactionStatus.CONFIRMED,
        date: new Date().toISOString(),
        customerId: original.customerId,
        customerName: original.customerName,
        customerCode: original.customerCode,
        customerPhone: original.customerPhone,
        grossAmount: Math.abs(impact.deltaAmount),
        discountAmount: 0,
        netAmount: impact.deltaAmount,
        paidAmount: 0,
        balanceDelta: impact.deltaBalance,
        settlementDirection: impact.deltaBalance > 0 ? 'CUSTOMER_PAYS' : impact.deltaBalance < 0 ? 'CUSTOMER_RECEIVES' : 'SETTLED',
        items: compensatingItems,
        isCorrectionOfId: original.id,
        notes: input.reason,
        description: `Correction for ${original.transactionNumber}: ${impact.summaryText}`,
        createdById: actor.id,
        createdByName: actor.name,
        createdAt: new Date().toISOString(),
      };

      dbRepository.saveTransaction(newCorrectionTxn);

      // Step C: Post compensating ledger entries
      if (original.customerId) {
        for (const item of compensatingItems) {
          if (item.quantity > 0) {
            const isPositiveDelta = item.direction === ItemDirection.IN;
            const entry = dbRepository.addLedgerEntry({
              customerId: original.customerId,
              customerName: original.customerName,
              transactionId: newCorrectionTxn.id,
              transactionNumber: newCorrectionTxn.transactionNumber,
              entryType: mapGrainToLedgerType(item.grainType, item.itemType),
              quantity: item.quantity,
              amount: 0,
              unit: item.unit as any,
              direction: isPositiveDelta ? LedgerDirection.IN : LedgerDirection.OUT,
              status: LedgerStatus.CORRECTED,
              description: `Correction adjustment for ${original.transactionNumber}: ${isPositiveDelta ? '+' : '-'}${item.quantity} ${item.unit} (Reason: ${input.reason})`,
              date: new Date().toISOString().split('T')[0],
              createdById: actor.id,
              createdByName: actor.name,
              notes: input.reason,
            });
            createdLedgerEntryIds.push(entry.id);
          }
        }

        if (impact.deltaBalance !== 0) {
          const entry = dbRepository.addLedgerEntry({
            customerId: original.customerId,
            customerName: original.customerName,
            transactionId: newCorrectionTxn.id,
            transactionNumber: newCorrectionTxn.transactionNumber,
            entryType: LedgerEntryType.CASH,
            amount: Math.abs(impact.deltaBalance),
            quantity: 0,
            unit: LedgerUnit.RUPEE,
            direction: impact.deltaBalance > 0 ? LedgerDirection.OUT : LedgerDirection.IN,
            status: impact.deltaBalance > 0 ? LedgerStatus.DUE : LedgerStatus.CREDIT,
            description: `Correction Cash Adjustment for ${original.transactionNumber} (${impact.deltaBalance > 0 ? '+' : ''}₹${impact.deltaBalance})`,
            date: new Date().toISOString().split('T')[0],
            createdById: actor.id,
            createdByName: actor.name,
            notes: input.reason,
          });
          createdLedgerEntryIds.push(entry.id);
        }

        const updatedBalance = LedgerService.calculateCustomerBalances(original.customerId);
        dbRepository.updateCustomer(original.customerId, {
          currentDueAmount: updatedBalance.cashDueAmount,
          wheatBalanceKg: updatedBalance.wheatBalanceKg,
          riceCreditAmount: updatedBalance.riceCreditAmount,
          lastTransactionAt: new Date().toISOString(),
        });
      }

      // Step D: Audit Trail
      AuditService.log({
        action: AuditAction.TRANSACTION_CORRECTED,
        entityType: 'TRANSACTION',
        entityId: original.id,
        entityReference: original.transactionNumber,
        performedById: actor.id,
        performedByName: actor.name,
        reason: input.reason,
        previousState: {
          status: 'CONFIRMED',
          items: original.items.map((i) => ({ qty: i.quantity, rate: i.ratePerUnit, amount: i.totalAmount })),
          netAmount: original.netAmount,
        },
        newState: {
          status: TransactionStatus.CORRECTED,
          correctionTxnId: newCorrectionTxn.id,
          correctionTxnNumber: newCorrectionTxn.transactionNumber,
          impact: impact.summaryText,
          deltaQuantity: impact.deltaQuantity,
          deltaAmount: impact.deltaAmount,
          reason: input.reason,
        },
      });

      AuditService.log({
        action: AuditAction.TRANSACTION_CREATED,
        entityType: 'TRANSACTION',
        entityId: newCorrectionTxn.id,
        entityReference: newCorrectionTxn.transactionNumber,
        performedById: actor.id,
        performedByName: actor.name,
        reason: `Compensating correction transaction created for ${original.transactionNumber}: ${impact.summaryText}`,
        newState: {
          transactionNumber: newCorrectionTxn.transactionNumber,
          type: newCorrectionTxn.type,
          isCorrectionOfId: original.id,
          deltaAmount: newCorrectionTxn.netAmount,
        },
      });

      if (input.idempotencyKey) {
        this.idempotencyMap.set(input.idempotencyKey, {
          txn: newCorrectionTxn,
          timestamp: Date.now(),
        });
      }

      return {
        original,
        correctionTxn: newCorrectionTxn,
        summary: `Correction confirmed: ${impact.summaryText}`,
      };
    } catch (err: any) {
      if (correctionTxnId) {
        dbRepository.removeTransaction(correctionTxnId);
      }
      for (const lid of createdLedgerEntryIds) {
        dbRepository.removeLedgerEntry(lid);
      }
      if (original.customerId) {
        const restored = LedgerService.calculateCustomerBalances(original.customerId);
        dbRepository.updateCustomer(original.customerId, {
          currentDueAmount: restored.cashDueAmount,
          wheatBalanceKg: restored.wheatBalanceKg,
          riceCreditAmount: restored.riceCreditAmount,
        });
      }
      console.error('[TransactionService] Correction rollback triggered:', err);
      throw new Error(err.message || 'Correction failed and was rolled back.');
    }
  }

  /**
   * Legacy prepareCorrection for backwards-compatibility
   */
  public static prepareCorrection(
    originalTxId: string,
    reason: string,
    actor: ActorInfo
  ): { original: Transaction; message: string } {
    const val = this.validateCorrection(originalTxId, actor.role, reason);
    if (!val.isValid || !val.original) {
      throw new Error(val.error || 'Validation failed');
    }
    const original = val.original;
    original.status = TransactionStatus.CORRECTED;
    original.notes = `${original.notes ? original.notes + ' | ' : ''}Correction noted: ${reason}`;
    original.updatedAt = new Date().toISOString();
    dbRepository.saveTransaction(original);

    AuditService.log({
      action: AuditAction.TRANSACTION_CORRECTED,
      entityType: 'TRANSACTION',
      entityId: original.id,
      entityReference: original.transactionNumber,
      performedById: actor.id,
      performedByName: actor.name,
      reason: `Flagged for correction: ${reason}`,
      previousState: { status: original.status },
      newState: { status: TransactionStatus.CORRECTED, reason },
    });

    return {
      original,
      message: `Transaction ${original.transactionNumber} flagged for correction. Original record preserved.`,
    };
  }

  /**
   * Validate reversal parameters and permissions
   */
  public static validateReversal(
    originalTxId: string,
    role: UserRole,
    reason: string
  ): { isValid: boolean; error?: string; original?: Transaction } {
    if (!hasPermission(role, Permission.REVERSE_TRANSACTION)) {
      return {
        isValid: false,
        error: 'Unauthorized: Users without TRANSACTION_REVERSE permission are not permitted to reverse financial transactions. Only the Shop Owner or Admin can perform reversals.',
      };
    }

    const original = dbRepository.getTransactionById(originalTxId);
    if (!original) {
      return { isValid: false, error: `Transaction ${originalTxId} not found.` };
    }

    // STRICT NO-DOUBLE-REVERSAL PROTECTION
    if (original.status === TransactionStatus.REVERSED) {
      return {
        isValid: false,
        error: 'This transaction has already been reversed. Double reversal is strictly prevented.',
      };
    }

    if (!reason || reason.trim().length < 4) {
      return {
        isValid: false,
        error: 'A mandatory, detailed reason (minimum 4 characters) is required for reversal.',
      };
    }

    return { isValid: true, original };
  }

  /**
   * Atomically executes a complete non-destructive transaction reversal:
   * - Marks original transaction status as REVERSED
   * - Creates a REVERSAL transaction record referencing original
   * - Creates opposite ledger entries that neutralize all ledger balances
   * - Recalculates customer balances atomically
   * - Records immutable audit trail
   */
  public static async reverseTransaction(
    originalTxId: string,
    reason: string,
    actor: ActorInfo,
    idempotencyKey?: string
  ): Promise<{ original: Transaction; reversalTxn: Transaction; summary: string }> {
    // 1. Idempotency Check
    if (idempotencyKey) {
      const existing = this.idempotencyMap.get(idempotencyKey);
      if (existing && Date.now() - existing.timestamp < 120000) {
        const orig = dbRepository.getTransactionById(originalTxId);
        return {
          original: orig || existing.txn,
          reversalTxn: existing.txn,
          summary: 'Transaction reversal was already executed.',
        };
      }
    }

    // 2. Validate
    const validation = this.validateReversal(originalTxId, actor.role, reason);
    if (!validation.isValid || !validation.original) {
      throw new Error(validation.error || 'Reversal validation failed.');
    }

    const original = validation.original;
    let reversalTxnId = '';
    const createdLedgerEntryIds: string[] = [];

    try {
      // Step A: Mark original as REVERSED (preserves all historical values: date, items, rate, numbers!)
      const previousStatus = original.status;
      original.status = TransactionStatus.REVERSED;
      original.reversalReason = reason;
      original.reversedById = actor.id;
      original.reversedByName = actor.name;
      original.reversalDate = new Date().toISOString();
      original.updatedAt = new Date().toISOString();
      dbRepository.saveTransaction(original);

      // Step B: Create a REVERSAL transaction
      const revNumber = `REV-${original.transactionNumber.replace(/^TXN-/, '')}`;
      reversalTxnId = `tx-rev-${Date.now()}`;

      const invertedItems = original.items.map((it, idx) => ({
        ...it,
        id: `item-rev-${Date.now()}-${idx}`,
        transactionId: reversalTxnId,
        direction: it.direction === ItemDirection.IN ? ItemDirection.OUT : ItemDirection.IN,
        notes: `Reversal for ${original.transactionNumber}: ${it.notes || ''}`,
      }));

      const reversalTxn: Transaction = {
        id: reversalTxnId,
        transactionNumber: revNumber,
        type: TransactionType.REVERSAL,
        status: TransactionStatus.COMPLETED,
        date: new Date().toISOString(),
        customerId: original.customerId,
        customerName: original.customerName,
        customerCode: original.customerCode,
        customerPhone: original.customerPhone,
        grossAmount: original.grossAmount,
        discountAmount: 0,
        netAmount: -original.netAmount,
        paidAmount: -original.paidAmount,
        balanceDelta: -original.balanceDelta,
        settlementDirection:
          original.settlementDirection === 'CUSTOMER_PAYS'
            ? 'CUSTOMER_RECEIVES'
            : original.settlementDirection === 'CUSTOMER_RECEIVES'
            ? 'CUSTOMER_PAYS'
            : 'SETTLED',
        items: invertedItems,
        isCorrectionOfId: original.id,
        notes: reason,
        reversalReason: reason,
        description: `Reversal of ${original.transactionNumber}. Reason: ${reason}`,
        createdById: actor.id,
        createdByName: actor.name,
        createdAt: new Date().toISOString(),
      };

      dbRepository.saveTransaction(reversalTxn);
      original.reversalTxnId = reversalTxn.id;
      dbRepository.saveTransaction(original);

      // Step C: Create opposing ledger entries
      const originalLedgerEntries = dbRepository.getLedgerEntriesByTransactionId(original.id);

      if (originalLedgerEntries.length > 0) {
        for (const entry of originalLedgerEntries) {
          const opposingDirection = entry.direction === LedgerDirection.IN ? LedgerDirection.OUT : LedgerDirection.IN;
          const newLedger = dbRepository.addLedgerEntry({
            customerId: entry.customerId,
            customerName: entry.customerName,
            transactionId: reversalTxn.id,
            transactionNumber: reversalTxn.transactionNumber,
            entryType: entry.entryType,
            amount: entry.amount,
            quantity: entry.quantity,
            unit: entry.unit,
            direction: opposingDirection,
            status: LedgerStatus.REVERSED,
            description: `Reversal of ${original.transactionNumber}: ${entry.description} (Reason: ${reason})`,
            date: new Date().toISOString().split('T')[0],
            createdById: actor.id,
            createdByName: actor.name,
            notes: reason,
          });
          createdLedgerEntryIds.push(newLedger.id);
        }
      } else if (original.customerId) {
        for (const item of original.items) {
          if (item.quantity > 0) {
            const oppDirection = item.direction === ItemDirection.IN ? LedgerDirection.OUT : LedgerDirection.IN;
            const newLedger = dbRepository.addLedgerEntry({
              customerId: original.customerId,
              customerName: original.customerName,
              transactionId: reversalTxn.id,
              transactionNumber: reversalTxn.transactionNumber,
              entryType: mapGrainToLedgerType(item.grainType),
              quantity: item.quantity,
              amount: 0,
              unit: item.unit as any,
              direction: oppDirection,
              status: LedgerStatus.REVERSED,
              description: `Reversal of ${original.transactionNumber}: ${item.quantity} ${item.unit} ${item.grainType || ''} (Reason: ${reason})`,
              date: new Date().toISOString().split('T')[0],
              createdById: actor.id,
              createdByName: actor.name,
              notes: reason,
            });
            createdLedgerEntryIds.push(newLedger.id);
          }
        }

        if (original.balanceDelta !== 0) {
          const oppDirection = original.balanceDelta > 0 ? LedgerDirection.IN : LedgerDirection.OUT;
          const newLedger = dbRepository.addLedgerEntry({
            customerId: original.customerId,
            customerName: original.customerName,
            transactionId: reversalTxn.id,
            transactionNumber: reversalTxn.transactionNumber,
            entryType: LedgerEntryType.CASH,
            amount: Math.abs(original.balanceDelta),
            quantity: 0,
            unit: LedgerUnit.RUPEE,
            direction: oppDirection,
            status: LedgerStatus.REVERSED,
            description: `Reversal Cash Balance Offset for ${original.transactionNumber} (Reason: ${reason})`,
            date: new Date().toISOString().split('T')[0],
            createdById: actor.id,
            createdByName: actor.name,
            notes: reason,
          });
          createdLedgerEntryIds.push(newLedger.id);
        }
      }

      // Step D: Recalculate customer balances
      if (original.customerId) {
        const updatedBalance = LedgerService.calculateCustomerBalances(original.customerId);
        dbRepository.updateCustomer(original.customerId, {
          currentDueAmount: updatedBalance.cashDueAmount,
          wheatBalanceKg: updatedBalance.wheatBalanceKg,
          riceCreditAmount: updatedBalance.riceCreditAmount,
          lastTransactionAt: new Date().toISOString(),
        });
      }

      // Step E: Audit Trail Logging
      AuditService.log({
        action: AuditAction.TRANSACTION_REVERSED,
        entityType: 'TRANSACTION',
        entityId: original.id,
        entityReference: original.transactionNumber,
        performedById: actor.id,
        performedByName: actor.name,
        reason,
        previousState: {
          status: previousStatus,
          netAmount: original.netAmount,
          balanceDelta: original.balanceDelta,
        },
        newState: {
          status: TransactionStatus.REVERSED,
          reversalTxnId: reversalTxn.id,
          reversalTxnNumber: reversalTxn.transactionNumber,
          reason,
        },
      });

      AuditService.log({
        action: AuditAction.TRANSACTION_CREATED,
        entityType: 'TRANSACTION',
        entityId: reversalTxn.id,
        entityReference: reversalTxn.transactionNumber,
        performedById: actor.id,
        performedByName: actor.name,
        reason: `Reversal record generated for ${original.transactionNumber}: ${reason}`,
        newState: {
          transactionNumber: reversalTxn.transactionNumber,
          type: reversalTxn.type,
          isCorrectionOfId: original.id,
          netAmount: reversalTxn.netAmount,
        },
      });

      if (idempotencyKey) {
        this.idempotencyMap.set(idempotencyKey, {
          txn: reversalTxn,
          timestamp: Date.now(),
        });
      }

      return {
        original,
        reversalTxn,
        summary: `Transaction ${original.transactionNumber} safely reversed without destructive deletion.`,
      };
    } catch (err: any) {
      if (reversalTxnId) {
        dbRepository.removeTransaction(reversalTxnId);
      }
      for (const lid of createdLedgerEntryIds) {
        dbRepository.removeLedgerEntry(lid);
      }
      if (original.customerId) {
        const restored = LedgerService.calculateCustomerBalances(original.customerId);
        dbRepository.updateCustomer(original.customerId, {
          currentDueAmount: restored.cashDueAmount,
          wheatBalanceKg: restored.wheatBalanceKg,
          riceCreditAmount: restored.riceCreditAmount,
        });
      }
      console.error('[TransactionService] Reversal rollback triggered:', err);
      throw new Error(err.message || 'Reversal failed and was rolled back.');
    }
  }

  /**
   * Legacy prepareReversal for backwards-compatibility
   */
  public static prepareReversal(
    originalTxId: string,
    reason: string,
    actor: ActorInfo
  ): { original: Transaction; message: string } {
    const val = this.validateReversal(originalTxId, actor.role, reason);
    if (!val.isValid || !val.original) {
      throw new Error(val.error || 'Validation failed');
    }
    const original = val.original;
    original.status = TransactionStatus.REVERSED;
    original.reversalReason = reason;
    original.updatedAt = new Date().toISOString();
    dbRepository.saveTransaction(original);

    AuditService.log({
      action: AuditAction.TRANSACTION_REVERSED,
      entityType: 'TRANSACTION',
      entityId: original.id,
      entityReference: original.transactionNumber,
      performedById: actor.id,
      performedByName: actor.name,
      reason: `Reversed: ${reason}`,
      previousState: { status: original.status },
      newState: { status: TransactionStatus.REVERSED, reversalReason: reason },
    });

    return {
      original,
      message: `Transaction ${original.transactionNumber} safely reversed without destructive deletion.`,
    };
  }

  /**
   * Update settlement payment status (e.g. from PENDING to PAID when physical cash is handed over)
   */
  public static updatePaymentStatus(
    transactionId: string,
    newStatus: SettlementPaymentStatus | 'CALCULATED' | 'PENDING' | 'PAID' | 'PARTIAL',
    actor: ActorInfo,
    notes?: string
  ): Transaction {
    const txn = dbRepository.getTransactionById(transactionId);
    if (!txn) {
      throw new Error(`Transaction ${transactionId} not found.`);
    }

    const previousStatus = txn.paymentStatus;
    txn.paymentStatus = newStatus as any;
    txn.updatedAt = new Date().toISOString();

    // If changing to PAID from PENDING or PARTIAL for a settlement where cash was handed over:
    if (newStatus === 'PAID' && (previousStatus === 'PENDING' || previousStatus === 'PARTIAL')) {
      const priorDelta = txn.balanceDelta;
      const remainingAmount = Math.abs(priorDelta);
      if (remainingAmount > 0) {
        txn.paidAmount = txn.netAmount;
        txn.balanceDelta = 0;
        txn.status = TransactionStatus.SETTLED;

        // If customer is attached, post offsetting cash ledger entry so balance recalculates to 0
        if (txn.customerId) {
          const isCustomerReceives = txn.settlementDirection === 'CUSTOMER_RECEIVES' || priorDelta < 0;
          dbRepository.addLedgerEntry({
            customerId: txn.customerId,
            customerName: txn.customerName,
            transactionId: txn.id,
            transactionNumber: txn.transactionNumber,
            entryType: LedgerEntryType.CASH,
            amount: remainingAmount,
            unit: LedgerUnit.RUPEE,
            direction: isCustomerReceives ? LedgerDirection.OUT : LedgerDirection.IN,
            status: isCustomerReceives ? LedgerStatus.SETTLED : LedgerStatus.PAID,
            description: isCustomerReceives
              ? `Settlement Remaining Cash Handed Over to Customer (${txn.transactionNumber})`
              : `Settlement Remaining Cash Received from Customer (${txn.transactionNumber})`,
            date: new Date().toISOString().split('T')[0],
            createdById: actor.id,
            createdByName: actor.name,
            notes: notes || 'Remaining payment marked completed',
          });
        }
      }
    }

    dbRepository.saveTransaction(txn);

    // Sync customer balances from ledger
    if (txn.customerId) {
      const calculatedBalance = LedgerService.calculateCustomerBalances(txn.customerId);
      dbRepository.updateCustomer(txn.customerId, {
        currentDueAmount: calculatedBalance.cashDueAmount,
        wheatBalanceKg: calculatedBalance.wheatBalanceKg,
        riceCreditAmount: calculatedBalance.riceCreditAmount,
        lastTransactionAt: new Date().toISOString(),
      });
    }

    AuditService.log({
      action: AuditAction.STATUS_CHANGE,
      entityType: 'TRANSACTION',
      entityId: txn.id,
      performedById: actor.id,
      performedByName: actor.name,
      reason: notes || `Payment status updated from ${previousStatus || 'UNSPECIFIED'} to ${newStatus}`,
      previousState: { paymentStatus: previousStatus },
      newState: { paymentStatus: newStatus },
    });

    return txn;
  }

  /**
   * Retrieves all audit events for a transaction, including corrections and reversals referencing it
   */
  public static getAuditTrailForTransaction(txnIdOrNumber: string): AuditLogEntry[] {
    const txn = dbRepository.getTransactionById(txnIdOrNumber);
    const id = txn ? txn.id : txnIdOrNumber;
    const num = txn ? txn.transactionNumber : txnIdOrNumber;
    return AuditService.getAllLogs().filter(
      (l) =>
        l.entityId === id ||
        l.entityReference === num ||
        (l.newState as any)?.isCorrectionOfId === id ||
        (l.newState as any)?.correctionTxnId === id ||
        (l.newState as any)?.reversalTxnId === id
    );
  }
}
