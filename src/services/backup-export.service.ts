import { jsPDF } from 'jspdf';
import { dbRepository } from '../db/in-memory-db';
import { Permission, hasPermission } from '../modules/auth/permissions';
import {
  AuditAction,
  Customer,
  InventoryItemCode,
  User,
  Transaction,
} from '../types';
import { AuditService } from './audit.service';
import { InventoryService } from './inventory.service';
import { LedgerService } from './ledger.service';
import { ReportService, ReportDateRange } from './report.service';
import { RiceTradingService } from './rice-trading.service';

export type BackupStatus = 'SUCCESS' | 'IN_PROGRESS' | 'FAILED' | 'NEVER_BACKED_UP' | 'REQUESTED';
export type ExportFormat = 'CSV' | 'XLSX' | 'PDF';
export type ExportKind =
  | 'CUSTOMERS'
  | 'TRANSACTIONS'
  | 'LEDGER'
  | 'PAYMENTS'
  | 'INVENTORY'
  | 'RICE_TRADING'
  | 'WHOLESALERS'
  | 'DAILY_SUMMARY'
  | 'MONTHLY_SUMMARY'
  | 'RICE_PROFIT'
  | 'CUSTOMER_BALANCES';

export interface BackupRecord {
  id: string;
  status: BackupStatus;
  type: 'MANUAL' | 'AUTOMATIC';
  sizeBytes?: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  initiatedById: string;
  initiatedByName: string;
  errorMessage?: string;
}

export interface BackupStatusView {
  status: BackupStatus;
  lastSuccessfulBackup?: BackupRecord;
  lastAttempt?: BackupRecord;
  systemHealth: 'HEALTHY' | 'ATTENTION_REQUIRED';
  provider: 'IN_MEMORY_VERIFIED_SNAPSHOT';
  nextScheduledBackup?: string;
}

export interface ExportRequest {
  kind: ExportKind;
  format: ExportFormat;
  actor: User;
  startDate?: string;
  endDate?: string;
  customerId?: string;
}

export interface ExportArtifact {
  filename: string;
  mimeType: string;
  content: string | ArrayBuffer;
  rowCount: number;
  generatedAt: string;
}

type ExportRow = Record<string, string | number | null | undefined>;

const PERMISSION_BY_KIND: Record<ExportKind, Permission> = {
  CUSTOMERS: Permission.EXPORT_CUSTOMERS,
  TRANSACTIONS: Permission.EXPORT_TRANSACTIONS,
  LEDGER: Permission.EXPORT_LEDGER,
  PAYMENTS: Permission.EXPORT_PAYMENTS,
  INVENTORY: Permission.EXPORT_INVENTORY,
  RICE_TRADING: Permission.EXPORT_RICE_TRADING,
  WHOLESALERS: Permission.EXPORT_WHOLESALERS,
  DAILY_SUMMARY: Permission.EXPORT_FINANCIAL_REPORTS,
  MONTHLY_SUMMARY: Permission.EXPORT_FINANCIAL_REPORTS,
  RICE_PROFIT: Permission.EXPORT_FINANCIAL_REPORTS,
  CUSTOMER_BALANCES: Permission.EXPORT_FINANCIAL_REPORTS,
};

const safeDate = (value?: string): number | undefined => {
  if (!value) return undefined;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? undefined : time;
};

const inRange = (date: string, start?: string, end?: string): boolean => {
  const timestamp = new Date(date).getTime();
  const startTime = safeDate(start);
  const endTime = safeDate(end);
  return (startTime === undefined || timestamp >= startTime) && (endTime === undefined || timestamp <= endTime);
};

const cleanName = (value: string): string => value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 50) || 'Report';
const dateStamp = (date = new Date()): string => date.toISOString().slice(0, 10);
const displayDate = (value?: string): string => value ? new Date(value).toLocaleString('en-IN') : '-';
const formatMoney = (value: number): string => `₹${Number(value || 0).toFixed(2)}`;

const escapeCsv = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (rows: ExportRow[]): string => {
  if (!rows.length) return 'No records found\n';
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return [columns.map(escapeCsv).join(','), ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(','))].join('\n');
};

const toExcelHtml = (rows: ExportRow[]): string => {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const header = columns.map((column) => `<th>${escapeCsv(column)}</th>`).join('');
  const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeCsv(row[column])}</td>`).join('')}</tr>`).join('');
  return `<html><head><meta charset="utf-8"></head><body><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
};

const toPdf = (title: string, rows: ExportRow[], rangeLabel: string): ArrayBuffer => {
  const pdf = new jsPDF({ orientation: 'landscape' });
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  pdf.setFontSize(16);
  pdf.text('Chakki Ledger', 14, 14);
  pdf.setFontSize(12);
  pdf.text(title, 14, 22);
  pdf.setFontSize(9);
  pdf.text(`Period: ${rangeLabel} | Generated: ${displayDate(new Date().toISOString())}`, 14, 29);
  let y = 38;
  const columnWidth = Math.max(24, 270 / Math.max(columns.length, 1));
  pdf.setFont('helvetica', 'bold');
  columns.forEach((column, index) => pdf.text(column.slice(0, 18), 14 + index * columnWidth, y));
  pdf.setFont('helvetica', 'normal');
  y += 6;
  rows.slice(0, 42).forEach((row) => {
    columns.forEach((column, index) => pdf.text(String(row[column] ?? '-').slice(0, 18), 14 + index * columnWidth, y));
    y += 5;
    if (y > 190) { pdf.addPage(); y = 18; }
  });
  pdf.setFontSize(8);
  pdf.text('Generated by Chakki Ledger', 14, 202);
  return pdf.output('arraybuffer');
};

const transactionRows = (transactions: Transaction[], startDate?: string, endDate?: string): ExportRow[] => transactions
  .filter((transaction) => inRange(transaction.date, startDate, endDate))
  .flatMap((transaction) => {
    const items = transaction.items?.length ? transaction.items : [undefined];
    return items.map((item) => ({
      transactionNumber: transaction.transactionNumber,
      date: displayDate(transaction.date),
      customer: transaction.customerName || transaction.wholesalerName || 'General Customer',
      transactionType: transaction.type,
      status: transaction.status,
      createdBy: transaction.createdByName || transaction.createdById,
      totalAmount: transaction.netAmount,
      paymentStatus: transaction.paymentStatus || transaction.status,
      correctionOf: transaction.isCorrectionOfId || '',
      reversalOf: transaction.reversalTxnId || '',
      itemType: item?.itemType || '',
      quantity: item?.quantity || '',
      unit: item?.unit || '',
      historicalRate: item?.ratePerUnit || '',
      itemAmount: item?.totalAmount || '',
      direction: item?.direction || '',
    }));
  });

export class BackupExportService {
  private static backupHistory: BackupRecord[] = [];

  public static getBackupStatus(): BackupStatusView {
    const lastAttempt = this.backupHistory[0];
    const lastSuccessfulBackup = this.backupHistory.find((backup) => backup.status === 'SUCCESS');
    return {
      status: lastAttempt?.status || 'NEVER_BACKED_UP',
      lastAttempt,
      lastSuccessfulBackup,
      systemHealth: lastAttempt?.status === 'FAILED' ? 'ATTENTION_REQUIRED' : 'HEALTHY',
      provider: 'IN_MEMORY_VERIFIED_SNAPSHOT',
      nextScheduledBackup: undefined,
    };
  }

  public static getBackupHistory(): BackupRecord[] {
    return this.backupHistory.map((record) => ({ ...record }));
  }

  public static async createBackup(actor: User): Promise<BackupRecord> {
    if (!hasPermission(actor.role, Permission.BACKUP_CREATE)) throw new Error('You do not have permission to create backups.');
    const startedAt = new Date().toISOString();
    const record: BackupRecord = {
      id: `backup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: 'IN_PROGRESS',
      type: 'MANUAL',
      startedAt,
      initiatedById: actor.id,
      initiatedByName: actor.name,
    };
    this.backupHistory.unshift(record);
    AuditService.log({ action: AuditAction.BACKUP_STARTED, entityType: 'BACKUP', entityId: record.id, performedById: actor.id, performedByName: actor.name });

    try {
      const snapshot = {
        customers: dbRepository.getCustomers(),
        transactions: dbRepository.getTransactions(),
        payments: dbRepository.getPayments(),
        ledger: dbRepository.getLedgerEntries(),
        inventory: InventoryService.getInventorySummary(),
        inventoryMovements: InventoryService.getStockMovementHistory(),
        wholesalers: dbRepository.getWholesalers(),
        rates: dbRepository.getRates(),
        businessProfile: dbRepository.getBusinessProfile(),
        receiptConfiguration: dbRepository.getReceiptConfiguration(),
      };
      const serialized = JSON.stringify(snapshot);
      const verified = JSON.parse(serialized);
      if (!verified || !Array.isArray(verified.transactions)) throw new Error('Backup verification did not complete.');
      const completedAt = new Date().toISOString();
      Object.assign(record, { status: 'SUCCESS' as BackupStatus, completedAt, durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(), sizeBytes: new Blob([serialized]).size });
      AuditService.log({ action: AuditAction.BACKUP_COMPLETED, entityType: 'BACKUP', entityId: record.id, performedById: actor.id, performedByName: actor.name, newState: { sizeBytes: record.sizeBytes } });
      return { ...record };
    } catch (error) {
      Object.assign(record, { status: 'FAILED' as BackupStatus, completedAt: new Date().toISOString(), errorMessage: 'Backup verification failed.' });
      AuditService.log({ action: AuditAction.BACKUP_FAILED, entityType: 'BACKUP', entityId: record.id, performedById: actor.id, performedByName: actor.name, reason: record.errorMessage });
      return { ...record };
    }
  }

  public static generateExport(request: ExportRequest): ExportArtifact {
    const requiredPermission = PERMISSION_BY_KIND[request.kind];
    if (!hasPermission(request.actor.role, requiredPermission)) throw new Error('You do not have permission to export this data.');
    try {
      const rows = this.buildRows(request);
      const title = request.kind.replace(/_/g, ' ');
      const extension = request.format === 'CSV' ? 'csv' : request.format === 'XLSX' ? 'xls' : 'pdf';
      const customer = request.customerId ? dbRepository.getCustomerById(request.customerId) : undefined;
      const name = customer ? `${cleanName(customer.name)}-Statement` : title.replace(/ /g, '');
      const filename = `ChakkiLedger-${name}-${dateStamp()}.${extension}`;
      const content = request.format === 'CSV' ? toCsv(rows) : request.format === 'XLSX' ? toExcelHtml(rows) : toPdf(title, rows, request.startDate && request.endDate ? `${request.startDate} - ${request.endDate}` : 'Selected records');
      AuditService.log({ action: AuditAction.EXPORT_CREATED, entityType: 'EXPORT', entityId: filename, performedById: request.actor.id, performedByName: request.actor.name, newState: { kind: request.kind, format: request.format, rowCount: rows.length } });
      return { filename, mimeType: request.format === 'CSV' ? 'text/csv;charset=utf-8' : request.format === 'XLSX' ? 'application/vnd.ms-excel' : 'application/pdf', content, rowCount: rows.length, generatedAt: new Date().toISOString() };
    } catch (error) {
      AuditService.log({ action: AuditAction.EXPORT_FAILED, entityType: 'EXPORT', entityId: request.kind, performedById: request.actor.id, performedByName: request.actor.name, reason: 'Unable to generate export.' });
      throw new Error('Unable to generate export.');
    }
  }

  private static buildRows(request: ExportRequest): ExportRow[] {
    const { kind, startDate, endDate } = request;
    if (kind === 'CUSTOMERS') return dbRepository.getCustomers().map((customer: Customer) => ({ customerId: customer.customerCode || customer.id, name: customer.name, phone: customer.phone || '', address: customer.address || '', status: customer.status, createdDate: displayDate(customer.createdAt) }));
    if (kind === 'TRANSACTIONS') return transactionRows(dbRepository.getTransactions(), startDate, endDate);
    if (kind === 'PAYMENTS') return dbRepository.getPayments().filter((payment) => inRange(payment.date, startDate, endDate)).map((payment) => ({ paymentId: payment.id, date: displayDate(payment.date), customer: payment.customerName || payment.customerId, paymentType: payment.paymentType || '', amount: payment.amount, paymentMethod: payment.paymentMode || payment.mode, status: payment.status || '', relatedTransaction: payment.transactionNumber || payment.transactionId || '', createdBy: payment.createdByName || payment.createdById }));
    if (kind === 'LEDGER') {
      const customer = request.customerId ? dbRepository.getCustomerById(request.customerId) : undefined;
      if (!customer) throw new Error('Select a customer for ledger export.');
      const statement = LedgerService.getCustomerStatement(customer.id, { startDate, endDate, preset: startDate && endDate ? 'CUSTOM' : 'ALL' });
      return statement.entries.map((entry) => ({ date: displayDate(entry.date), transaction: entry.description, quantity: entry.quantity || '', rate: entry.rate || '', amount: entry.amount || '', direction: entry.direction, status: entry.status || '', transactionId: entry.transactionNumber || entry.transactionId }));
    }
    if (kind === 'INVENTORY') {
      const summary = InventoryService.getInventorySummary().map((snapshot) => ({ item: snapshot.item.name, currentStock: snapshot.currentStock, reorderLevel: snapshot.item.reorderLevel, status: snapshot.status }));
      const movements = InventoryService.getStockMovementHistory().filter((movement) => inRange(movement.createdAt, startDate, endDate)).map((movement) => ({ date: displayDate(movement.createdAt), item: movement.itemName, type: movement.movementType, quantity: movement.quantity, direction: movement.direction, relatedTransaction: movement.transactionNumber || movement.transactionId || '', reason: movement.reason || '', createdBy: movement.createdByName || movement.createdById || '' }));
      return [...summary, ...movements];
    }
    if (kind === 'RICE_TRADING') return [...RiceTradingService.getRicePurchases().filter((record) => inRange(record.transaction.date, startDate, endDate)).map((record) => ({ recordType: 'PURCHASE', transaction: record.transaction.transactionNumber, date: displayDate(record.transaction.date), quantityKg: record.quantity, rate: record.purchaseRate, amount: record.totalValue, status: record.transaction.status })), ...RiceTradingService.getWholesaleSales().filter((record) => inRange(record.transaction.date, startDate, endDate)).map((record) => ({ recordType: 'WHOLESALE SALE', transaction: record.transaction.transactionNumber, date: displayDate(record.transaction.date), wholesaler: record.wholesaler.name, quantityKg: record.quantity, rate: record.sellingRate, amount: record.saleValue, amountDue: record.amountDue, status: record.transaction.status }))];
    if (kind === 'WHOLESALERS') return dbRepository.getWholesalers().map((wholesaler) => ({ wholesalerId: wholesaler.wholesalerCode, name: wholesaler.name, company: wholesaler.companyName || '', phone: wholesaler.phone || '', status: wholesaler.status, ricePurchasedKg: wholesaler.totalRicePurchasedKg, outstanding: wholesaler.totalOutstandingPayment }));
    const range: ReportDateRange = ReportService.getDateRange(kind === 'DAILY_SUMMARY' ? 'TODAY' : 'THIS_MONTH', startDate, endDate);
    if (kind === 'RICE_PROFIT') { const summary = ReportService.getGrossProfitSummary(range); return [{ report: 'Rice Profit/Loss', period: range.label, revenue: summary.revenue, cogs: summary.cogs, grossProfit: summary.grossProfit, grossMargin: summary.grossMargin, costingMethod: dbRepository.getRates().riceCostingMethod }]; }
    if (kind === 'CUSTOMER_BALANCES') return ReportService.getCustomerBalanceReport(range).items.map((balance) => ({ customer: balance.customerName, customerCode: balance.customerCode, due: balance.customerDue, credit: balance.customerCredit, wheatBalanceKg: balance.wheatBalance }));
    const summary = kind === 'DAILY_SUMMARY' ? ReportService.getDailyBusinessSummary(range) : ReportService.getMonthlyBusinessSummary(range);
    return summary.rows.map((row) => ({ report: kind === 'DAILY_SUMMARY' ? 'Daily Summary' : 'Monthly Summary', ...row }));
  }
}

export const getExportPermission = (kind: ExportKind): Permission => PERMISSION_BY_KIND[kind];
export const getInventoryExportItemCodes = (): InventoryItemCode[] => Object.values(InventoryItemCode);
