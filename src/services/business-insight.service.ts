import { ReportDateRange, ReportPreset, ReportService } from './report.service';

export interface BusinessInsightQuestion {
  question: string;
  period?: ReportPreset;
  comparisonPeriod?: ReportPreset;
}

export interface BusinessInsightResult {
  summary: string;
  keyFactors: string[];
  recommendations: string[];
  confidence: 'low' | 'medium' | 'high';
  metrics: {
    rangeLabel: string;
    totalRevenue: number;
    grossProfit: number;
    grossMargin: number;
    topCustomer: string | null;
    cashReceived: number;
    customerCount: number;
  };
}

const formatCurrency = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const describeRange = (range: ReportDateRange): string => range.label || 'This month';

const isInsufficientData = (range: ReportDateRange): boolean => {
  const revenue = ReportService.getRevenueSummary(range);
  const profit = ReportService.getGrossProfitSummary(range);
  const activity = ReportService.getCustomerActivityReport(range, 'transactionVolume');
  const payments = ReportService.getPaymentSummary(range);

  const totalBusiness = revenue.totalRevenue + profit.grossProfit + payments.cashReceived;
  return totalBusiness === 0 && activity.items.length === 0;
};

export class BusinessInsightService {
  public static generateBusinessInsights(range?: ReportDateRange): BusinessInsightResult {
    const selectedRange = range || ReportService.getDateRange('THIS_MONTH');

    if (isInsufficientData(selectedRange)) {
      return {
        summary: `No business data is available for ${describeRange(selectedRange)}. Please select a wider date range or check whether transactions were recorded for this period.`,
        keyFactors: ['No transactions were found in the selected range.', 'Revenue, profit, and customer activity are all zero.', 'The AI summary is intentionally limited to verified source data.'],
        recommendations: ['Expand the date range to include recent business activity.', 'Verify that transactions are recorded for the selected period.', 'Review the reports dashboard for the latest operational updates.'],
        confidence: 'low',
        metrics: {
          rangeLabel: describeRange(selectedRange),
          totalRevenue: 0,
          grossProfit: 0,
          grossMargin: 0,
          topCustomer: null,
          cashReceived: 0,
          customerCount: 0,
        },
      };
    }

    const revenue = ReportService.getRevenueSummary(selectedRange);
    const profit = ReportService.getGrossProfitSummary(selectedRange);
    const activity = ReportService.getCustomerActivityReport(selectedRange, 'transactionVolume');
    const payments = ReportService.getPaymentSummary(selectedRange);
    const topCustomer = activity.items[0]?.customerName || null;
    const customerCount = activity.items.length;
    const margin = Number.isFinite(profit.grossMargin) ? profit.grossMargin : 0;

    const confidence = margin >= 10 ? 'high' : margin >= 0 ? 'medium' : 'low';

    const summary = [
      `${describeRange(selectedRange)} generated ${formatCurrency(revenue.totalRevenue)} in revenue and ${formatCurrency(profit.grossProfit)} in gross profit.`,
      `Gross margin is ${margin.toFixed(1)}%, and ${topCustomer ? `the top customer was ${topCustomer}.` : 'customer activity remains consistent across the period.'}`,
      `${formatCurrency(payments.cashReceived)} in cash was received during this range.`,
    ].join(' ');

    const keyFactors = [
      `Revenue: ${formatCurrency(revenue.totalRevenue)}`,
      `Gross profit: ${formatCurrency(profit.grossProfit)}`,
      `Gross margin: ${margin.toFixed(1)}%`,
      topCustomer ? `Top customer: ${topCustomer}` : 'Customer activity is spread across the active customer base',
      `Cash received: ${formatCurrency(payments.cashReceived)}`,
    ];

    const recommendations = [
      'Review the highest-volume customers and prioritize follow-ups on due collections.',
      'Watch rice purchase and sale rates to protect the current gross margin trend.',
      'Use the detailed daily and monthly summaries for the next operational decision point.',
    ];

    return {
      summary,
      keyFactors,
      recommendations,
      confidence,
      metrics: {
        rangeLabel: describeRange(selectedRange),
        totalRevenue: revenue.totalRevenue,
        grossProfit: profit.grossProfit,
        grossMargin: margin,
        topCustomer,
        cashReceived: payments.cashReceived,
        customerCount,
      },
    };
  }

  public static answerQuestion(question: BusinessInsightQuestion): BusinessInsightResult {
    const normalizedQuestion = question.question.toLowerCase();
    const selectedRange = ReportService.getDateRange(question.period || 'THIS_MONTH');
    const comparisonRange = question.comparisonPeriod ? ReportService.getDateRange(question.comparisonPeriod) : null;
    const currentRevenue = ReportService.getRevenueSummary(selectedRange);
    const currentProfit = ReportService.getGrossProfitSummary(selectedRange);
    const comparisonRevenue = comparisonRange ? ReportService.getRevenueSummary(comparisonRange) : null;

    if (normalizedQuestion.includes('profit') || normalizedQuestion.includes('gross')) {
      const movement = comparisonRevenue && comparisonRevenue.totalRevenue !== 0
        ? (((currentRevenue.totalRevenue - comparisonRevenue.totalRevenue) / comparisonRevenue.totalRevenue) * 100)
        : null;

      const summary = comparisonRevenue
        ? `Based on verified data, gross profit for ${describeRange(selectedRange)} was ${formatCurrency(currentProfit.grossProfit)}. Compared with ${describeRange(comparisonRange!)}, the revenue trend is ${movement !== null ? `${movement >= 0 ? '+' : ''}${movement.toFixed(1)}%` : 'not available'} in the current period.`
        : `Based on verified data, gross profit for ${describeRange(selectedRange)} was ${formatCurrency(currentProfit.grossProfit)}. The period summary is built from the current rice trading and sales totals.`;

      return {
        summary,
        keyFactors: [
          `Gross profit: ${formatCurrency(currentProfit.grossProfit)}`,
          `Gross margin: ${(currentProfit.grossMargin || 0).toFixed(1)}%`,
          comparisonRevenue ? `Revenue change vs ${describeRange(comparisonRange!)}: ${movement !== null ? `${movement >= 0 ? '+' : ''}${movement.toFixed(1)}%` : 'N/A'}` : 'No comparison range selected',
        ],
        recommendations: [
          'Check the day-by-day rice profit summary to identify the biggest margin swings.',
          'Review stock movement and sale rates to protect profit in the next cycle.',
        ],
        confidence: 'medium',
        metrics: {
          rangeLabel: describeRange(selectedRange),
          totalRevenue: currentRevenue.totalRevenue,
          grossProfit: currentProfit.grossProfit,
          grossMargin: currentProfit.grossMargin || 0,
          topCustomer: null,
          cashReceived: ReportService.getPaymentSummary(selectedRange).cashReceived,
          customerCount: ReportService.getCustomerActivityReport(selectedRange, 'transactionVolume').items.length,
        },
      };
    }

    return this.generateBusinessInsights(ReportService.getDateRange(question.period || 'THIS_MONTH'));
  }
}
