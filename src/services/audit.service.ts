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

const INITIAL_SEED_AUDIT_LOGS: AuditLogEntry[] = [];

export class AuditService {
  private static memoryAuditLogs: AuditLogEntry[] = [];

  public static setLogsFromRemote(logs: AuditLogEntry[]): void {
    this.memoryAuditLogs = [...logs];
  }

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
    
    // Async firestore sync without blocking
    import('../lib/firebase-sync.service').then(({ FirebaseSyncService }) => {
      FirebaseSyncService.saveAuditLog(fullEntry);
    }).catch(() => {});

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
