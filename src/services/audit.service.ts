/**
 * Chakki Ledger - Audit Service & Dispute Prevention Architecture
 *
 * Core Principle:
 * Financial and ledger records are IMMUTABLE.
 * Mistakes are corrected via explicit CORRECTION or REVERSAL transactions with
 * mandatory reason, user ID, and timestamp tracking.
 */

import { AuditAction, AuditLogEntry, Transaction, TransactionStatus } from '../types';

export interface AuditQueryOptions {
  search?: string;
  action?: AuditAction | 'ALL';
  entityType?: string | 'ALL';
  userId?: string | 'ALL';
  entityId?: string;
  startDate?: string;
  endDate?: string;
}

const INITIAL_SEED_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'audit-seed-001',
    action: AuditAction.TRANSACTION_CREATED,
    entityType: 'TRANSACTION',
    entityId: 'tx-001',
    entityReference: 'TXN-2026-0001',
    performedById: 'user-owner-01',
    performedByName: 'Gopal Sahu (Owner)',
    reason: 'Wheat deposit & roll atta extraction recorded at counter',
    previousState: undefined,
    newState: {
      transactionNumber: 'TXN-2026-0001',
      customer: 'Rahul Das',
      wheatInput: '20 kg',
      rollAttaDelivered: '18 kg',
      rate: '₹10/kg',
      netAmount: 180,
      balanceDelta: 180,
    },
    timestamp: '2026-09-10T10:30:00.000Z',
  },
  {
    id: 'audit-seed-002',
    action: AuditAction.TRANSACTION_CREATED,
    entityType: 'TRANSACTION',
    entityId: 'tx-002',
    entityReference: 'TXN-2026-0002',
    performedById: 'user-staff-01',
    performedByName: 'Suresh Kumar (Operator)',
    reason: '20kg ration rice submitted @ ₹21/kg support rate',
    previousState: undefined,
    newState: {
      transactionNumber: 'TXN-2026-0002',
      customer: 'Rahim Sheikh',
      riceQuantity: '20 kg',
      appliedRate: '₹21/kg',
      creditValue: 420,
      status: 'COMPLETED',
    },
    timestamp: '2026-09-09T14:15:00.000Z',
  },
  {
    id: 'audit-seed-003',
    action: AuditAction.PAYMENT_CREATED,
    entityType: 'PAYMENT',
    entityId: 'pmt-001',
    entityReference: 'RCT-2026-0001',
    performedById: 'user-owner-01',
    performedByName: 'Gopal Sahu (Owner)',
    reason: 'Cash received ₹500 from Rakesh to clear pending balance',
    previousState: { currentDue: 500 },
    newState: {
      receiptNumber: 'RCT-2026-0001',
      customer: 'Rakesh',
      amount: 500,
      mode: 'CASH',
      newDue: 0,
    },
    timestamp: '2026-09-08T11:00:00.000Z',
  },
  {
    id: 'audit-seed-004',
    action: AuditAction.CUSTOMER_CREATED,
    entityType: 'CUSTOMER',
    entityId: 'cust-01',
    entityReference: 'CUST-00001',
    performedById: 'user-owner-01',
    performedByName: 'Gopal Sahu (Owner)',
    reason: 'New customer profile registered for Rahul Das',
    previousState: undefined,
    newState: { customerCode: 'CUST-00001', name: 'Rahul Das', phone: '9830011223' },
    timestamp: '2026-01-10T10:00:00.000Z',
  },
  {
    id: 'audit-seed-005',
    action: AuditAction.RATE_OVERRIDE_USED,
    entityType: 'RATE',
    entityId: 'rate-cfg-01',
    entityReference: 'ROLL_ATTA_EXCHANGE',
    performedById: 'user-owner-01',
    performedByName: 'Gopal Sahu (Owner)',
    reason: 'Verified base rate snapshot ₹10/kg for roll atta processing',
    previousState: { rollAttaExchangeRate: 9 },
    newState: { rollAttaExchangeRate: 10 },
    timestamp: '2026-01-01T08:00:00.000Z',
  },
];

export class AuditService {
  private static memoryAuditLogs: AuditLogEntry[] = [...INITIAL_SEED_AUDIT_LOGS];

  /**
   * Records an auditable event
   */
  public static log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    this.memoryAuditLogs.unshift(fullEntry);
    return fullEntry;
  }

  /**
   * Retrieves audit logs for a specific entity (e.g. Transaction ID, Customer ID)
   */
  public static getLogsForEntity(entityType: string, entityId: string): AuditLogEntry[] {
    return this.memoryAuditLogs.filter(
      (log) => log.entityType === entityType && log.entityId === entityId
    );
  }

  /**
   * Returns all audit logs, newest first
   */
  public static getAllLogs(): AuditLogEntry[] {
    return [...this.memoryAuditLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Filtered and searchable query for audit trail
   */
  public static searchLogs(options: AuditQueryOptions = {}): AuditLogEntry[] {
    let list = [...this.memoryAuditLogs];

    if (options.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      list = list.filter(
        (log) =>
          log.performedByName?.toLowerCase().includes(q) ||
          log.reason?.toLowerCase().includes(q) ||
          log.entityId?.toLowerCase().includes(q) ||
          log.entityReference?.toLowerCase().includes(q) ||
          log.action?.toLowerCase().includes(q) ||
          log.entityType?.toLowerCase().includes(q)
      );
    }

    if (options.action && options.action !== 'ALL') {
      list = list.filter((log) => log.action === options.action);
    }

    if (options.entityType && options.entityType !== 'ALL') {
      list = list.filter((log) => log.entityType === options.entityType);
    }

    if (options.userId && options.userId !== 'ALL') {
      list = list.filter((log) => log.performedById === options.userId);
    }

    if (options.entityId) {
      const target = options.entityId.trim().toLowerCase();
      list = list.filter(
        (log) =>
          log.entityId?.toLowerCase() === target ||
          log.entityReference?.toLowerCase() === target
      );
    }

    if (options.startDate) {
      const start = new Date(options.startDate).getTime();
      list = list.filter((log) => new Date(log.timestamp).getTime() >= start);
    }

    if (options.endDate) {
      const end = new Date(options.endDate).getTime() + 86400000;
      list = list.filter((log) => new Date(log.timestamp).getTime() <= end);
    }

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Builds non-destructive correction record.
   * Instead of overwriting old transaction, the old is marked CORRECTED and linked to new.
   */
  public static prepareCorrection(
    originalTransaction: Transaction,
    correctionData: Partial<Transaction>,
    userId: string,
    userName: string,
    reason: string
  ): { originalUpdated: Transaction; newCorrectionTx: Transaction; auditLog: AuditLogEntry } {
    if (!reason || reason.trim().length < 4) {
      throw new Error('A detailed reason (at least 4 characters) is mandatory for any transaction correction.');
    }

    // 1. Mark original as CORRECTED
    const originalUpdated: Transaction = {
      ...originalTransaction,
      status: TransactionStatus.CORRECTED,
      updatedAt: new Date().toISOString(),
    };

    // 2. Spawn the new adjustment transaction referencing original
    const newCorrectionTx: Transaction = {
      ...originalTransaction,
      ...correctionData,
      id: `tx-corr-${Date.now()}`,
      transactionNumber: `${originalTransaction.transactionNumber}-REV1`,
      type: originalTransaction.type,
      status: TransactionStatus.COMPLETED,
      isCorrectionOfId: originalTransaction.id,
      notes: `Correction for ${originalTransaction.transactionNumber}. Reason: ${reason}`,
      createdById: userId,
      createdByName: userName,
      createdAt: new Date().toISOString(),
    };

    // 3. Log audit event
    const auditLog = this.log({
      action: AuditAction.CORRECTION,
      entityType: 'TRANSACTION',
      entityId: originalTransaction.id,
      performedById: userId,
      performedByName: userName,
      reason,
      previousState: originalTransaction as unknown as Record<string, unknown>,
      newState: newCorrectionTx as unknown as Record<string, unknown>,
    });

    return { originalUpdated, newCorrectionTx, auditLog };
  }

  /**
   * Builds non-destructive reversal record.
   */
  public static prepareReversal(
    originalTransaction: Transaction,
    userId: string,
    userName: string,
    reason: string
  ): { reversedTransaction: Transaction; auditLog: AuditLogEntry } {
    if (!reason || reason.trim().length < 4) {
      throw new Error('A reason is mandatory for reversing a transaction.');
    }

    const reversedTransaction: Transaction = {
      ...originalTransaction,
      status: TransactionStatus.REVERSED,
      reversalReason: reason,
      updatedAt: new Date().toISOString(),
    };

    const auditLog = this.log({
      action: AuditAction.REVERSAL,
      entityType: 'TRANSACTION',
      entityId: originalTransaction.id,
      performedById: userId,
      performedByName: userName,
      reason,
      previousState: originalTransaction as unknown as Record<string, unknown>,
      newState: { status: TransactionStatus.REVERSED, reversalReason: reason },
    });

    return { reversedTransaction, auditLog };
  }
}
