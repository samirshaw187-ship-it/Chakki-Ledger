/**
 * Chakki Ledger - Customer Digital Ledger Service
 *
 * Core domain service managing:
 * - Ledger entries (Wheat, Atta, Rice, Cash)
 * - Traceable links to Transaction IDs
 * - Service-level balance calculations (no hardcoding, no component calculation)
 * - Customer statements with standardized date filtering
 */

import { dbRepository } from '../db/in-memory-db';
import {
  Customer,
  CustomerAccountBalance,
  CustomerStatement,
  CustomerStatementSummary,
  LedgerDirection,
  LedgerEntry,
  LedgerEntryType,
  LedgerStatus,
  LedgerUnit,
  UserRole,
} from '../types';
import { AuditService } from './audit.service';

export interface LedgerQueryOptions {
  page?: number;
  limit?: number;
  entryType?: LedgerEntryType | 'ALL';
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface StatementFilterOptions {
  preset?: 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'ALL' | 'CUSTOM';
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  search?: string;
}

export class LedgerService {
  /**
   * Calculate wheat balance from ledger entries
   * Wheat Balance: Amount of wheat currently recorded as outstanding/available in mill.
   */
  public static calculateWheatBalance(entries: LedgerEntry[]): number {
    const wheatEntries = entries.filter((e) => e.entryType === LedgerEntryType.WHEAT);
    const inQty = wheatEntries
      .filter((e) => e.direction === LedgerDirection.IN)
      .reduce((sum, e) => sum + (e.quantity || 0), 0);
    const outQty = wheatEntries
      .filter((e) => e.direction === LedgerDirection.OUT)
      .reduce((sum, e) => sum + (e.quantity || 0), 0);

    const net = inQty - outQty;
    return Math.max(0, Math.round(net * 100) / 100);
  }

  /**
   * Calculate atta balance from ledger entries
   * Atta Balance: Amount of atta currently outstanding (e.g. ground and ready for pickup).
   */
  public static calculateAttaBalance(entries: LedgerEntry[]): number {
    const attaEntries = entries.filter((e) => e.entryType === LedgerEntryType.ATTA);
    const inQty = attaEntries
      .filter((e) => e.direction === LedgerDirection.IN)
      .reduce((sum, e) => sum + (e.quantity || 0), 0);
    const outQty = attaEntries
      .filter((e) => e.direction === LedgerDirection.OUT)
      .reduce((sum, e) => sum + (e.quantity || 0), 0);

    const net = inQty - outQty;
    return Math.max(0, Math.round(net * 100) / 100);
  }

  /**
   * Calculate cash credit and cash dues from ledger entries
   * Cash Credit: Money the shop owes the customer (advance payment, trade credit).
   * Cash Due: Money the customer owes the shop (unpaid milling or grain sales).
   */
  public static calculateCashBalances(entries: LedgerEntry[]): {
    cashCreditAmount: number;
    cashDueAmount: number;
    netCashBalance: number;
  } {
    // 1. Direct CREDIT / DUE marked entries
    const explicitCredit = entries
      .filter((e) => e.entryType === LedgerEntryType.CASH && e.status === LedgerStatus.CREDIT)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const explicitDue = entries
      .filter((e) => e.entryType === LedgerEntryType.CASH && e.status === LedgerStatus.DUE)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // 2. Flow calculation: Cash IN (payments from customer) vs Cash OUT (charges/debited from customer)
    // Exclude explicit credit/due from flow to avoid double counting if flagged
    const standardCashEntries = entries.filter(
      (e) =>
        e.entryType === LedgerEntryType.CASH &&
        e.status !== LedgerStatus.CREDIT &&
        e.status !== LedgerStatus.DUE
    );

    const cashIn = standardCashEntries
      .filter((e) => e.direction === LedgerDirection.IN)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const cashOut = standardCashEntries
      .filter((e) => e.direction === LedgerDirection.OUT)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // Total net cash
    // Positive = customer has paid more than charged (Credit in customer's favor)
    // Negative = customer has been charged more than paid (Due from customer)
    const netFlow = cashIn - cashOut + explicitCredit - explicitDue;

    const netCashBalance = Math.round(netFlow * 100) / 100;
    const cashCreditAmount = netCashBalance > 0 ? netCashBalance : 0;
    const cashDueAmount = netCashBalance < 0 ? Math.abs(netCashBalance) : 0;

    return {
      cashCreditAmount,
      cashDueAmount,
      netCashBalance,
    };
  }

  /**
   * Derive customer balances strictly from ledger records
   */
  public static calculateCustomerBalances(customerId: string): CustomerAccountBalance {
    const customer = dbRepository.getCustomerById(customerId);
    const entries = dbRepository.getCustomerLedgerEntries(customerId);

    if (!entries || entries.length === 0) {
      return {
        customerId,
        customerName: customer?.name || 'Unknown',
        customerCode: customer?.customerCode || customerId,
        wheatBalanceKg: 0,
        attaBalanceKg: 0,
        riceCreditAmount: 0,
        cashCreditAmount: 0,
        cashDueAmount: 0,
        netCashBalance: 0,
        totalEntriesCount: 0,
        lastActivityDate: undefined,
      };
    }

    const wheatBalanceKg = this.calculateWheatBalance(entries);
    const attaBalanceKg = this.calculateAttaBalance(entries);
    const { cashCreditAmount, cashDueAmount, netCashBalance } = this.calculateCashBalances(entries);

    // Rice trade value (Inflow minus Outflow/Reversals)
    const riceEntries = entries.filter((e) => e.entryType === LedgerEntryType.RICE);
    const riceIn = riceEntries
      .filter((e) => e.direction === LedgerDirection.IN && (e.status === LedgerStatus.CREDIT || e.status === LedgerStatus.SETTLED || !e.status))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const riceOut = riceEntries
      .filter((e) => e.direction === LedgerDirection.OUT)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const riceCreditAmount = Math.max(0, Math.round((riceIn - riceOut) * 100) / 100);

    const lastEntry = entries[0];

    return {
      customerId,
      customerName: customer?.name || lastEntry.customerName || 'Unknown',
      customerCode: customer?.customerCode || customerId,
      wheatBalanceKg,
      attaBalanceKg,
      riceCreditAmount,
      cashCreditAmount,
      cashDueAmount,
      netCashBalance,
      totalEntriesCount: entries.length,
      lastActivityDate: lastEntry?.date || lastEntry?.createdAt,
    };
  }

  /**
   * Get balance snapshot for customer
   */
  public static getCustomerBalance(customerId: string): CustomerAccountBalance {
    return this.calculateCustomerBalances(customerId);
  }

  /**
   * Get paginated customer ledger entries
   */
  public static getCustomerLedger(
    customerId: string,
    options?: LedgerQueryOptions
  ): {
    entries: LedgerEntry[];
    total: number;
    page: number;
    totalPages: number;
  } {
    let entries = dbRepository.getCustomerLedgerEntries(customerId);

    // Entry type filter
    if (options?.entryType && options.entryType !== 'ALL') {
      entries = entries.filter((e) => e.entryType === options.entryType);
    }

    // Date filters
    if (options?.startDate) {
      const start = new Date(options.startDate).getTime();
      entries = entries.filter((e) => new Date(e.date).getTime() >= start);
    }
    if (options?.endDate) {
      const end = new Date(options.endDate).getTime();
      entries = entries.filter((e) => new Date(e.date).getTime() <= end);
    }

    // Search query
    if (options?.search) {
      const q = options.search.toLowerCase().trim();
      entries = entries.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          e.transactionNumber?.toLowerCase().includes(q) ||
          e.transactionId.toLowerCase().includes(q) ||
          e.notes?.toLowerCase().includes(q)
      );
    }

    const total = entries.length;
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const paginated = entries.slice(offset, offset + limit);

    return {
      entries: paginated,
      total,
      page,
      totalPages,
    };
  }

  /**
   * Get global ledger entries across all customers
   */
  public static getGlobalLedger(options?: LedgerQueryOptions): {
    entries: LedgerEntry[];
    total: number;
    page: number;
    totalPages: number;
  } {
    let entries = dbRepository.getLedgerEntries();

    if (options?.entryType && options.entryType !== 'ALL') {
      entries = entries.filter((e) => e.entryType === options.entryType);
    }

    if (options?.startDate) {
      const start = new Date(options.startDate).getTime();
      entries = entries.filter((e) => new Date(e.date).getTime() >= start);
    }
    if (options?.endDate) {
      const end = new Date(options.endDate).getTime();
      entries = entries.filter((e) => new Date(e.date).getTime() <= end);
    }

    if (options?.search) {
      const q = options.search.toLowerCase().trim();
      entries = entries.filter(
        (e) =>
          e.customerName?.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.transactionNumber?.toLowerCase().includes(q) ||
          e.transactionId.toLowerCase().includes(q) ||
          e.notes?.toLowerCase().includes(q)
      );
    }

    const total = entries.length;
    const page = options?.page || 1;
    const limit = options?.limit || 15;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const paginated = entries.slice(offset, offset + limit);

    return {
      entries: paginated,
      total,
      page,
      totalPages,
    };
  }

  /**
   * Fetch single ledger entry
   */
  public static getLedgerEntry(entryId: string): LedgerEntry | undefined {
    return dbRepository.getLedgerEntryById(entryId);
  }

  /**
   * Generate customer detailed statement for date period
   */
  public static getCustomerStatement(
    customerId: string,
    options?: StatementFilterOptions
  ): CustomerStatement {
    const customer = dbRepository.getCustomerById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    const allEntries = dbRepository.getCustomerLedgerEntries(customerId);

    // Resolve date range safely (avoiding UTC timezone date jumps)
    let startDate: string | undefined = options?.startDate;
    let endDate: string | undefined = options?.endDate;
    let periodLabel = 'All Time';

    const now = new Date();
    const formatYMD = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (options?.preset === 'TODAY') {
      const todayStr = formatYMD(now);
      startDate = `${todayStr}T00:00:00.000Z`;
      endDate = `${todayStr}T23:59:59.999Z`;
      periodLabel = 'Today';
    } else if (options?.preset === 'THIS_WEEK') {
      const startOfWeek = new Date(now);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);

      startDate = startOfWeek.toISOString();
      endDate = new Date().toISOString();
      periodLabel = 'This Week';
    } else if (options?.preset === 'THIS_MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = startOfMonth.toISOString();
      endDate = new Date().toISOString();
      periodLabel = 'This Month';
    } else if (options?.preset === 'LAST_MONTH') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      startDate = startOfLastMonth.toISOString();
      endDate = endOfLastMonth.toISOString();
      periodLabel = 'Last Month';
    } else if (options?.preset === 'CUSTOM' && (startDate || endDate)) {
      periodLabel = `${startDate || 'Start'} to ${endDate || 'Present'}`;
    }

    let filteredEntries = [...allEntries];
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      filteredEntries = filteredEntries.filter((e) => new Date(e.date).getTime() >= startMs);
    }
    if (endDate) {
      const endMs = new Date(endDate).getTime();
      filteredEntries = filteredEntries.filter((e) => new Date(e.date).getTime() <= endMs);
    }

    if (options?.search) {
      const q = options.search.toLowerCase().trim();
      filteredEntries = filteredEntries.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          e.transactionNumber?.toLowerCase().includes(q) ||
          e.transactionId.toLowerCase().includes(q)
      );
    }

    // Calculate statement totals
    const wheatEntries = filteredEntries.filter((e) => e.entryType === LedgerEntryType.WHEAT);
    const totalWheatInKg = wheatEntries
      .filter((e) => e.direction === LedgerDirection.IN)
      .reduce((sum, e) => sum + (e.quantity || 0), 0);
    const totalWheatOutKg = wheatEntries
      .filter((e) => e.direction === LedgerDirection.OUT)
      .reduce((sum, e) => sum + (e.quantity || 0), 0);
    const netWheatBalanceKg = totalWheatInKg - totalWheatOutKg;

    const attaEntries = filteredEntries.filter((e) => e.entryType === LedgerEntryType.ATTA);
    const totalAttaInKg = attaEntries
      .filter((e) => e.direction === LedgerDirection.IN)
      .reduce((sum, e) => sum + (e.quantity || 0), 0);
    const totalAttaOutKg = attaEntries
      .filter((e) => e.direction === LedgerDirection.OUT)
      .reduce((sum, e) => sum + (e.quantity || 0), 0);
    const netAttaBalanceKg = totalAttaInKg - totalAttaOutKg;

    const riceEntries = filteredEntries.filter((e) => e.entryType === LedgerEntryType.RICE);
    const totalRiceInKg = riceEntries
      .filter((e) => e.direction === LedgerDirection.IN)
      .reduce((sum, e) => sum + (e.quantity || 0), 0);
    const totalRiceOutKg = riceEntries
      .filter((e) => e.direction === LedgerDirection.OUT)
      .reduce((sum, e) => sum + (e.quantity || 0), 0);
    const netRiceBalanceKg = totalRiceInKg - totalRiceOutKg;

    const cashEntries = filteredEntries.filter((e) => e.entryType === LedgerEntryType.CASH);
    const totalCashInAmount = cashEntries
      .filter((e) => e.direction === LedgerDirection.IN)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalCashOutAmount = cashEntries
      .filter((e) => e.direction === LedgerDirection.OUT)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const netCashDifference = totalCashInAmount - totalCashOutAmount;
    const netCashCreditAmount = netCashDifference > 0 ? netCashDifference : 0;
    const netCashDueAmount = netCashDifference < 0 ? Math.abs(netCashDifference) : 0;

    const summary: CustomerStatementSummary = {
      totalWheatInKg: Math.round(totalWheatInKg * 100) / 100,
      totalWheatOutKg: Math.round(totalWheatOutKg * 100) / 100,
      netWheatBalanceKg: Math.round(netWheatBalanceKg * 100) / 100,

      totalAttaInKg: Math.round(totalAttaInKg * 100) / 100,
      totalAttaOutKg: Math.round(totalAttaOutKg * 100) / 100,
      netAttaBalanceKg: Math.round(netAttaBalanceKg * 100) / 100,

      totalRiceInKg: Math.round(totalRiceInKg * 100) / 100,
      totalRiceOutKg: Math.round(totalRiceOutKg * 100) / 100,
      netRiceBalanceKg: Math.round(netRiceBalanceKg * 100) / 100,

      totalCashInAmount: Math.round(totalCashInAmount * 100) / 100,
      totalCashOutAmount: Math.round(totalCashOutAmount * 100) / 100,
      netCashCreditAmount: Math.round(netCashCreditAmount * 100) / 100,
      netCashDueAmount: Math.round(netCashDueAmount * 100) / 100,
    };

    const balances = this.calculateCustomerBalances(customerId);

    return {
      customer,
      periodLabel,
      startDate,
      endDate,
      entries: filteredEntries,
      summary,
      balances,
    };
  }

  /**
   * Append a new ledger entry with trace metadata and audit trail
   */
  public static createLedgerEntry(
    entryData: Omit<LedgerEntry, 'id' | 'createdAt'>,
    operator: { id: string; name: string; role: UserRole }
  ): LedgerEntry {
    if (!entryData.customerId) {
      throw new Error('Customer ID is required for a ledger entry');
    }
    if (!entryData.transactionId) {
      throw new Error('Transaction ID is required to link ledger entry for full traceability');
    }

    const created = dbRepository.addLedgerEntry({
      ...entryData,
      createdById: operator.id,
      createdByName: operator.name,
    });

    AuditService.log({
      action: 'CREATE' as any,
      entityType: 'LEDGER_ENTRY',
      entityId: created.id,
      performedById: operator.id,
      performedByName: operator.name,
      reason: `Recorded ${created.entryType} ${created.direction} entry for customer ${created.customerId} (TXN: ${created.transactionNumber || created.transactionId})`,
      newState: { ...created },
    });

    return created;
  }
}
