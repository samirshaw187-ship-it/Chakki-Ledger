import { dbRepository } from '../db/in-memory-db';
import { InventoryService } from './inventory.service';
import { LedgerService } from './ledger.service';
import { RiceProfitService } from './rice-profit.service';
import { RiceTradingService } from './rice-trading.service';
import {
  InventoryItemCode,
  PaymentType,
  Transaction,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '../types';
import { roundCurrency, roundQuantity } from '../utils/precision';

export type ReportPreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'LAST_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_QUARTER'
  | 'THIS_YEAR'
  | 'CUSTOM';

export interface ReportDateRange {
  preset: ReportPreset;
  start: string;
  end: string;
  label: string;
}

export interface TrendPoint {
  key: string;
  label: string;
  value: number;
}

export interface SummaryMetric {
  totalRevenue: number;
  previousRevenue: number;
  grossProfit: number;
  previousGrossProfit: number;
  grossMargin: number;
  totalRicePurchasedKg: number;
  totalRiceSoldKg: number;
  wheatReceivedKg: number;
  attaSoldKg: number;
  customerDue: number;
  customerCredit: number;
  series: TrendPoint[];
}

const roundCurrencyValue = (value: number) => roundCurrency(value || 0);
const roundQuantityValue = (value: number) => roundQuantity(value || 0);

const isTransactionActive = (transaction: Transaction): boolean => {
  if (!transaction) return false;
  if ([TransactionStatus.DRAFT, TransactionStatus.CANCELLED, TransactionStatus.REVERSED].includes(transaction.status)) return false;
  if (transaction.isCorrectionOfId) return false;
  if (transaction.status === TransactionStatus.CORRECTED) return false;
  return true;
};

const withinDateRange = (dateValue: string, start: string, end: string): boolean => {
  const timestamp = new Date(dateValue).getTime();
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  return timestamp >= startMs && timestamp <= endMs;
};

const toDateKey = (value: string): string => new Date(value).toISOString().slice(0, 10);

const addToMap = (map: Record<string, number>, key: string, value: number) => {
  map[key] = (map[key] || 0) + value;
};

const makeMonthKey = (dateString: string): string => {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getDateRangePreset = (preset: ReportPreset, customStart?: string, customEnd?: string): ReportDateRange => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - (day === 0 ? 6 : day - 1));
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const assignRange = (start: Date, end: Date, label: string, presetKey: ReportPreset): ReportDateRange => ({
    preset: presetKey,
    start: start.toISOString(),
    end: end.toISOString(),
    label,
  });

  switch (preset) {
    case 'TODAY':
      return assignRange(startOfDay, endOfDay, 'Today', preset);
    case 'YESTERDAY': {
      const yesterdayStart = new Date(startOfDay);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(endOfDay);
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
      return assignRange(yesterdayStart, yesterdayEnd, 'Yesterday', preset);
    }
    case 'THIS_WEEK':
      return assignRange(startOfWeek, endOfWeek, 'This Week', preset);
    case 'LAST_WEEK': {
      const lastWeekStart = new Date(startOfWeek);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(endOfWeek);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
      return assignRange(lastWeekStart, lastWeekEnd, 'Last Week', preset);
    }
    case 'THIS_MONTH':
      return assignRange(monthStart, new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999), 'This Month', preset);
    case 'LAST_MONTH':
      return assignRange(prevMonthStart, prevMonthEnd, 'Last Month', preset);
    case 'THIS_QUARTER':
      return assignRange(quarterStart, new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0, 23, 59, 59, 999), 'This Quarter', preset);
    case 'THIS_YEAR':
      return assignRange(yearStart, new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999), 'This Year', preset);
    case 'CUSTOM':
      if (customStart && customEnd) {
        return {
          preset: 'CUSTOM',
          start: new Date(customStart).toISOString(),
          end: new Date(customEnd).toISOString(),
          label: 'Custom Range',
        };
      }
      return assignRange(monthStart, endOfDay, 'This Month', 'THIS_MONTH');
    default:
      return assignRange(monthStart, endOfDay, 'This Month', 'THIS_MONTH');
  }
};

const buildSeries = (
  transactions: Transaction[],
  range: ReportDateRange,
  granularity: 'day' | 'month'
): TrendPoint[] => {
  const map: Record<string, number> = {};

  for (const transaction of transactions) {
    const date = new Date(transaction.date);
    const inRange = date.getTime() >= new Date(range.start).getTime() && date.getTime() <= new Date(range.end).getTime();
    if (!inRange) continue;
    const bucket = granularity === 'month' ? makeMonthKey(transaction.date) : toDateKey(transaction.date);
    addToMap(map, bucket, Number(transaction.netAmount || 0));
  }

  const orderedKeys = Object.keys(map).sort();
  if (orderedKeys.length) {
    return orderedKeys.map((key) => ({
      key,
      label: granularity === 'month' ? new Date(`${key}-01T00:00:00.000Z`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : new Date(`${key}T00:00:00.000Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      value: roundCurrencyValue(map[key]),
    }));
  }

  const startDate = new Date(range.start);
  const endDate = new Date(range.end);
  const bucketKeys: string[] = [];

  if (granularity === 'month') {
    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (cursor <= endMonth) {
      bucketKeys.push(makeMonthKey(cursor.toISOString()));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  } else {
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);
    const finalDate = new Date(endDate);
    finalDate.setHours(0, 0, 0, 0);
    while (cursor <= finalDate) {
      bucketKeys.push(toDateKey(cursor.toISOString()));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return bucketKeys.map((key) => ({
    key,
    label: granularity === 'month'
      ? new Date(`${key}-01T00:00:00.000Z`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
      : new Date(`${key}T00:00:00.000Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    value: 0,
  }));
};

export class ReportService {
  public static getDateRange(preset: ReportPreset, customStart?: string, customEnd?: string): ReportDateRange {
    return getDateRangePreset(preset, customStart, customEnd);
  }

  public static getRevenueSummary(range?: ReportDateRange) {
    const selectedRange = range || this.getDateRange('THIS_MONTH');
    const sales = dbRepository
      .getTransactions()
      .filter((tx) => tx.type === TransactionType.RICE_WHOLESALE_SALE && isTransactionActive(tx))
      .filter((tx) => withinDateRange(tx.date, selectedRange.start, selectedRange.end));

    const totalRevenue = roundCurrencyValue(sales.reduce((sum, tx) => sum + (tx.netAmount || 0), 0));
    const series = buildSeries(sales, selectedRange, sales.length > 60 ? 'month' : 'day');
    return {
      totalRevenue,
      previousRevenue: 0,
      series,
      sales,
    };
  }

  public static getGrossProfitSummary(range?: ReportDateRange) {
    const selectedRange = range || this.getDateRange('THIS_MONTH');
    const summary = RiceProfitService.getRiceProfitSummary(selectedRange.start, selectedRange.end);
    return {
      ...summary,
      grossMargin: summary.grossMargin || 0,
      previousGrossProfit: 0,
      profitTrend: buildSeries(
        dbRepository.getTransactions().filter((tx) => tx.type === TransactionType.RICE_WHOLESALE_SALE && isTransactionActive(tx)).filter((tx) => withinDateRange(tx.date, selectedRange.start, selectedRange.end)),
        selectedRange,
        'day'
      ),
    };
  }

  public static getRicePurchaseSummary(range?: ReportDateRange) {
    const selectedRange = range || this.getDateRange('THIS_MONTH');
    const purchases = dbRepository
      .getTransactions()
      .filter((tx) => tx.type === TransactionType.RICE_PURCHASE && isTransactionActive(tx))
      .filter((tx) => withinDateRange(tx.date, selectedRange.start, selectedRange.end));

    const totalQuantity = roundQuantityValue(
      purchases.reduce((sum, tx) => sum + (tx.items || []).reduce((inner, item) => inner + ((item.itemType === 'RICE' || item.grainType === 'RATION_RICE') ? Number(item.quantity || 0) : 0), 0), 0)
    );

    const series = buildSeries(purchases, selectedRange, purchases.length > 60 ? 'month' : 'day');
    return { totalQuantity, series, purchases };
  }

  public static getRiceSaleSummary(range?: ReportDateRange) {
    const selectedRange = range || this.getDateRange('THIS_MONTH');
    const sales = dbRepository
      .getTransactions()
      .filter((tx) => tx.type === TransactionType.RICE_WHOLESALE_SALE && isTransactionActive(tx))
      .filter((tx) => withinDateRange(tx.date, selectedRange.start, selectedRange.end));

    const totalQuantity = roundQuantityValue(
      sales.reduce((sum, tx) => sum + (tx.items || []).reduce((inner, item) => inner + ((item.itemType === 'RICE' || item.grainType === 'RATION_RICE') ? Number(item.quantity || 0) : 0), 0), 0)
    );

    const series = buildSeries(sales, selectedRange, sales.length > 60 ? 'month' : 'day');
    return { totalQuantity, series, sales };
  }

  public static getInventorySummary(range?: ReportDateRange) {
    const inventorySummary = InventoryService.getInventorySummary();
    const currentRange = range || this.getDateRange('THIS_MONTH');
    return {
      range: currentRange,
      items: inventorySummary,
      wheatStock: inventorySummary.find((item) => item.item.code === InventoryItemCode.WHEAT)?.currentStock || 0,
      chaliAttaStock: inventorySummary.find((item) => item.item.code === InventoryItemCode.CHALI_ATTA)?.currentStock || 0,
      rollAttaStock: inventorySummary.find((item) => item.item.code === InventoryItemCode.ROLL_ATTA)?.currentStock || 0,
      riceStock: inventorySummary.find((item) => item.item.code === InventoryItemCode.RICE)?.currentStock || 0,
      lowStock: inventorySummary.filter((item) => item.status !== 'IN STOCK').length,
      outOfStock: inventorySummary.filter((item) => item.status === 'OUT OF STOCK').length,
      todayIn: inventorySummary.reduce((sum, item) => sum + item.todayIn, 0),
      todayOut: inventorySummary.reduce((sum, item) => sum + item.todayOut, 0),
    };
  }

  public static getCustomerActivityReport(range?: ReportDateRange, sortBy: 'transactionVolume' | 'wheatQuantity' | 'riceQuantity' | 'totalPurchaseValue' = 'transactionVolume') {
    const selectedRange = range || this.getDateRange('THIS_MONTH');
    const customerRows = dbRepository.getCustomers().map((customer) => {
      const customerTransactions = dbRepository
        .getCustomerTransactions(customer.id)
        .filter((tx) => isTransactionActive(tx))
        .filter((tx) => withinDateRange(tx.date, selectedRange.start, selectedRange.end));

      const wheatQuantity = customerTransactions.reduce((sum, tx) => sum + (tx.items || []).reduce((inner, item) => inner + (item.grainType === 'WHEAT' || item.itemType === 'WHEAT' ? Number(item.quantity || 0) : 0), 0), 0);
      const riceQuantity = customerTransactions.reduce((sum, tx) => sum + (tx.items || []).reduce((inner, item) => inner + ((item.grainType === 'RATION_RICE' || item.itemType === 'RICE') ? Number(item.quantity || 0) : 0), 0), 0);
      const totalPurchaseValue = customerTransactions.reduce((sum, tx) => sum + (tx.netAmount || 0), 0);
      return {
        customerId: customer.id,
        customerName: customer.name,
        customerCode: customer.customerCode,
        transactionVolume: customerTransactions.length,
        wheatQuantity: roundQuantityValue(wheatQuantity),
        riceQuantity: roundQuantityValue(riceQuantity),
        totalPurchaseValue: roundCurrencyValue(totalPurchaseValue),
      };
    }).filter((row) => row.transactionVolume > 0 || row.wheatQuantity > 0 || row.riceQuantity > 0 || row.totalPurchaseValue > 0);

    const ordered = [...customerRows].sort((a, b) => {
      const direction = { transactionVolume: a.transactionVolume - b.transactionVolume, wheatQuantity: a.wheatQuantity - b.wheatQuantity, riceQuantity: a.riceQuantity - b.riceQuantity, totalPurchaseValue: a.totalPurchaseValue - b.totalPurchaseValue }[sortBy] ?? 0;
      return direction > 0 ? -1 : 1;
    });

    return { items: ordered.slice(0, 10), range: selectedRange, metric: sortBy };
  }

  public static getCustomerBalanceReport(range?: ReportDateRange, sortBy: 'highestDue' | 'highestCredit' | 'highestWheatBalance' | 'highestAttaBalance' = 'highestDue') {
    const selectedRange = range || this.getDateRange('THIS_MONTH');
    const rows = dbRepository.getCustomers().map((customer) => {
      const balances = LedgerService.calculateCustomerBalances(customer.id);
      return {
        customerId: customer.id,
        customerCode: customer.customerCode,
        customerName: customer.name,
        customerDue: roundCurrencyValue(balances.cashDueAmount),
        customerCredit: roundCurrencyValue(balances.cashCreditAmount),
        wheatBalance: roundQuantityValue(balances.wheatBalanceKg),
        attaBalance: roundQuantityValue(balances.attaBalanceKg),
      };
    }).filter((row) => row.customerDue > 0 || row.customerCredit > 0 || row.wheatBalance > 0 || row.attaBalance > 0);

    const sortMap = {
      highestDue: (a: any, b: any) => b.customerDue - a.customerDue,
      highestCredit: (a: any, b: any) => b.customerCredit - a.customerCredit,
      highestWheatBalance: (a: any, b: any) => b.wheatBalance - a.wheatBalance,
      highestAttaBalance: (a: any, b: any) => b.attaBalance - a.attaBalance,
    };

    return { items: rows.sort(sortMap[sortBy]).slice(0, 20), range: selectedRange, sortBy };
  }

  public static getWholesalerReport(range?: ReportDateRange) {
    const selectedRange = range || this.getDateRange('THIS_MONTH');
    const sales = RiceTradingService.getWholesaleSales().filter((sale) => withinDateRange(sale.transaction.date, selectedRange.start, selectedRange.end));
    const rows = sales.map((sale) => ({
      wholesaler: sale.wholesaler.name,
      quantity: roundQuantityValue(sale.quantity),
      revenue: roundCurrencyValue(sale.saleValue),
      grossProfit: sale.transaction.profitSnapshot ? roundCurrencyValue(sale.transaction.profitSnapshot.grossProfit) : 0,
      outstandingReceivable: roundCurrencyValue(Math.max(0, sale.amountDue || 0)),
    }));

    return { items: rows, range: selectedRange };
  }

  public static getPaymentSummary(range?: ReportDateRange) {
    const selectedRange = range || this.getDateRange('THIS_MONTH');
    const payments = dbRepository
      .getPayments()
      .filter((payment) => withinDateRange(payment.date, selectedRange.start, selectedRange.end));

    const cashReceived = payments
      .filter((payment) => payment.paymentType === PaymentType.RECEIVE_PAYMENT || payment.paymentType === PaymentType.SETTLE_DUE)
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);

    const cashPaid = payments
      .filter((payment) => payment.paymentType === PaymentType.PAY_CUSTOMER)
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);

    const customerCreditCreated = payments.reduce((sum, payment) => sum + (payment.creditCreatedAmount || 0), 0);
    const customerCreditSettled = payments.filter((payment) => payment.paymentType === PaymentType.APPLY_CREDIT).reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const customerDueCollected = payments.filter((payment) => payment.paymentType === PaymentType.RECEIVE_PAYMENT || payment.paymentType === PaymentType.SETTLE_DUE).reduce((sum, payment) => sum + (payment.appliedToBillAmount || payment.amount || 0), 0);
    const wholesalerPaymentsReceived = payments.filter((payment) => payment.customerId.startsWith('wholesaler')).reduce((sum, payment) => sum + (payment.amount || 0), 0);

    return {
      cashReceived: roundCurrencyValue(cashReceived),
      cashPaid: roundCurrencyValue(cashPaid),
      customerCreditCreated: roundCurrencyValue(customerCreditCreated),
      customerCreditSettled: roundCurrencyValue(customerCreditSettled),
      customerDueCollected: roundCurrencyValue(customerDueCollected),
      wholesalerPaymentsReceived: roundCurrencyValue(wholesalerPaymentsReceived),
      range: selectedRange,
    };
  }

  public static getDailyBusinessSummary(range?: ReportDateRange) {
    const selectedRange = range || this.getDateRange('THIS_MONTH');
    const map: Record<string, any> = {};
    dbRepository.getTransactions()
      .filter((tx) => isTransactionActive(tx))
      .filter((tx) => withinDateRange(tx.date, selectedRange.start, selectedRange.end))
      .forEach((tx) => {
        const key = toDateKey(tx.date);
        map[key] ||= {
          date: key,
          customersServed: new Set<string>(),
          transactions: 0,
          wheatReceived: 0,
          attaSold: 0,
          ricePurchased: 0,
          riceSold: 0,
          revenue: 0,
          riceGrossProfit: 0,
          cashReceived: 0,
          cashPaid: 0,
          customerDue: 0,
          customerCredit: 0,
        };
        const row = map[key];
        if (tx.customerId) row.customersServed.add(tx.customerId);
        row.transactions += 1;
        row.wheatReceived += (tx.items || []).reduce((sum, item) => sum + (item.grainType === 'WHEAT' || item.itemType === 'WHEAT' ? Number(item.quantity || 0) : 0), 0);
        row.attaSold += (tx.items || []).reduce((sum, item) => sum + ((item.grainType === 'CHALI_ATTA' || item.grainType === 'ROLL_ATTA' || item.itemType === 'ATTA') ? Number(item.quantity || 0) : 0), 0);
        row.ricePurchased += (tx.type === TransactionType.RICE_PURCHASE ? (tx.items || []).reduce((sum, item) => sum + ((item.itemType === 'RICE' || item.grainType === 'RATION_RICE') ? Number(item.quantity || 0) : 0), 0) : 0);
        row.riceSold += (tx.type === TransactionType.RICE_WHOLESALE_SALE ? (tx.items || []).reduce((sum, item) => sum + ((item.itemType === 'RICE' || item.grainType === 'RATION_RICE') ? Number(item.quantity || 0) : 0), 0) : 0);
        row.revenue += tx.type === TransactionType.RICE_WHOLESALE_SALE ? (tx.netAmount || 0) : 0;
        row.riceGrossProfit += tx.profitSnapshot?.grossProfit || 0;
        row.cashReceived += tx.paidAmount > 0 ? tx.paidAmount : 0;
        row.customerDue += tx.balanceDelta > 0 ? tx.balanceDelta : 0;
        row.customerCredit += tx.balanceDelta < 0 ? Math.abs(tx.balanceDelta) : 0;
      });

    return {
      range: selectedRange,
      rows: Object.values(map).map((row) => ({
        ...row,
        customersServed: row.customersServed.size,
        wheatReceived: roundQuantityValue(row.wheatReceived),
        attaSold: roundQuantityValue(row.attaSold),
        ricePurchased: roundQuantityValue(row.ricePurchased),
        riceSold: roundQuantityValue(row.riceSold),
        revenue: roundCurrencyValue(row.revenue),
        riceGrossProfit: roundCurrencyValue(row.riceGrossProfit),
        cashReceived: roundCurrencyValue(row.cashReceived),
        customerDue: roundCurrencyValue(row.customerDue),
        customerCredit: roundCurrencyValue(row.customerCredit),
      })).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  public static getMonthlyBusinessSummary(range?: ReportDateRange) {
    const selectedRange = range || this.getDateRange('THIS_YEAR');
    const map: Record<string, any> = {};
    dbRepository.getTransactions()
      .filter((tx) => isTransactionActive(tx))
      .filter((tx) => withinDateRange(tx.date, selectedRange.start, selectedRange.end))
      .forEach((tx) => {
        const key = makeMonthKey(tx.date);
        map[key] ||= {
          month: key,
          revenue: 0,
          ricePurchases: 0,
          riceSales: 0,
          grossProfit: 0,
          wheatReceived: 0,
          attaActivity: 0,
          customerCount: new Set<string>(),
          transactionCount: 0,
          wholesalerSales: 0,
        };
        const row = map[key];
        if (tx.customerId) row.customerCount.add(tx.customerId);
        row.transactionCount += 1;
        row.revenue += tx.type === TransactionType.RICE_WHOLESALE_SALE ? (tx.netAmount || 0) : 0;
        row.ricePurchases += tx.type === TransactionType.RICE_PURCHASE ? (tx.items || []).reduce((sum, item) => sum + ((item.itemType === 'RICE' || item.grainType === 'RATION_RICE') ? Number(item.quantity || 0) : 0), 0) : 0;
        row.riceSales += tx.type === TransactionType.RICE_WHOLESALE_SALE ? (tx.items || []).reduce((sum, item) => sum + ((item.itemType === 'RICE' || item.grainType === 'RATION_RICE') ? Number(item.quantity || 0) : 0), 0) : 0;
        row.grossProfit += tx.profitSnapshot?.grossProfit || 0;
        row.wheatReceived += (tx.items || []).reduce((sum, item) => sum + (item.grainType === 'WHEAT' || item.itemType === 'WHEAT' ? Number(item.quantity || 0) : 0), 0);
        row.attaActivity += (tx.items || []).reduce((sum, item) => sum + ((item.grainType === 'CHALI_ATTA' || item.grainType === 'ROLL_ATTA' || item.itemType === 'ATTA') ? Number(item.quantity || 0) : 0), 0);
        row.wholesalerSales += tx.type === TransactionType.RICE_WHOLESALE_SALE ? (tx.netAmount || 0) : 0;
      });

    return {
      range: selectedRange,
      rows: Object.values(map).map((row) => ({
        ...row,
        customerCount: row.customerCount.size,
        revenue: roundCurrencyValue(row.revenue),
        ricePurchases: roundQuantityValue(row.ricePurchases),
        riceSales: roundQuantityValue(row.riceSales),
        grossProfit: roundCurrencyValue(row.grossProfit),
        wheatReceived: roundQuantityValue(row.wheatReceived),
        attaActivity: roundQuantityValue(row.attaActivity),
        wholesalerSales: roundCurrencyValue(row.wholesalerSales),
      })).sort((a, b) => a.month.localeCompare(b.month)),
    };
  }

  public static getPeriodComparison(currentRange: ReportDateRange) {
    const previousPreset = currentRange.preset === 'THIS_MONTH' ? 'LAST_MONTH'
      : currentRange.preset === 'THIS_WEEK' ? 'LAST_WEEK'
      : currentRange.preset === 'THIS_YEAR' ? 'THIS_YEAR'
      : 'THIS_MONTH';

    const previousRange = this.getDateRange(previousPreset);
    const currentTotal = this.getRevenueSummary(currentRange).totalRevenue;
    const previousTotal = this.getRevenueSummary(previousRange).totalRevenue;

    const absoluteDifference = roundCurrencyValue(currentTotal - previousTotal);
    const percentageDifference = previousTotal === 0 ? null : roundCurrencyValue((absoluteDifference / previousTotal) * 100);

    return {
      currentRange,
      previousRange,
      currentTotal,
      previousTotal,
      absoluteDifference,
      percentageDifference,
      changeLabel: previousTotal === 0 ? 'New activity' : `${absoluteDifference >= 0 ? '+' : ''}${absoluteDifference} / ${percentageDifference !== null ? `${percentageDifference >= 0 ? '+' : ''}${percentageDifference}%` : 'N/A'}`,
    };
  }

  public static getTransactionVolumeReport(range?: ReportDateRange) {
    const selectedRange = range || this.getDateRange('THIS_MONTH');
    const counts: Record<string, number> = {};
    dbRepository.getTransactions()
      .filter((tx) => isTransactionActive(tx))
      .filter((tx) => withinDateRange(tx.date, selectedRange.start, selectedRange.end))
      .forEach((tx) => {
        const label = tx.type.replace(/_/g, ' ');
        counts[label] = (counts[label] || 0) + 1;
      });

    return {
      range: selectedRange,
      items: Object.entries(counts)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
    };
  }

  public static getRiceRateTrend(range?: ReportDateRange) {
    const selectedRange = range || this.getDateRange('THIS_MONTH');
    const buckets: Record<string, { purchase: number[]; sale: number[] }> = {};

    dbRepository.getTransactions()
      .filter((tx) => isTransactionActive(tx))
      .filter((tx) => withinDateRange(tx.date, selectedRange.start, selectedRange.end))
      .forEach((tx) => {
        const key = selectedRange.preset === 'THIS_YEAR' || selectedRange.preset === 'THIS_QUARTER' ? makeMonthKey(tx.date) : toDateKey(tx.date);
        if (!buckets[key]) buckets[key] = { purchase: [], sale: [] };

        const txRates = (tx.items || []).filter((item) => item.ratePerUnit > 0);
        if (tx.type === TransactionType.RICE_PURCHASE) {
          txRates.forEach((item) => buckets[key].purchase.push(Number(item.ratePerUnit || 0)));
        }
        if (tx.type === TransactionType.RICE_WHOLESALE_SALE) {
          txRates.forEach((item) => buckets[key].sale.push(Number(item.ratePerUnit || 0)));
        }
      });

    const rows = Object.entries(buckets)
      .map(([key, bucket]) => {
        const purchaseAverage = bucket.purchase.length ? bucket.purchase.reduce((sum, value) => sum + value, 0) / bucket.purchase.length : 0;
        const saleAverage = bucket.sale.length ? bucket.sale.reduce((sum, value) => sum + value, 0) / bucket.sale.length : 0;
        return {
          key,
          label: key.length > 7 ? new Date(`${key}-01T00:00:00.000Z`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : new Date(`${key}T00:00:00.000Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          purchaseRate: roundCurrencyValue(purchaseAverage),
          saleRate: roundCurrencyValue(saleAverage),
        };
      })
      .sort((a, b) => a.key.localeCompare(b.key));

    return { range: selectedRange, rows };
  }
}
