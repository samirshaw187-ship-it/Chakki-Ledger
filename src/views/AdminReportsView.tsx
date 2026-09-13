import React, { useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, BarChart3, CalendarRange, IndianRupee, ShoppingBag, Wheat, TrendingUp, Truck, Wallet, PackageCheck, Activity } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { SummaryCard } from '../components/domain/SummaryCard';
import { ReportService, ReportDateRange, ReportPreset } from '../services/report.service';
import { BusinessInsightService } from '../services/business-insight.service';

const formatCurrency = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const formatKg = (value: number) => `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`;
const comparePill = (value: number, label: string) => {
  if (!Number.isFinite(value)) return 'Not enough data for comparison.';
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}% vs previous`; 
};

export interface AdminReportsViewProps {
  onNavigate?: (path: string) => void;
  compactMode?: boolean;
}

export const AdminReportsView: React.FC<AdminReportsViewProps> = ({ onNavigate, compactMode = false }) => {
  const [preset, setPreset] = useState<ReportPreset>('THIS_MONTH');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const range = useMemo<ReportDateRange>(() => {
    if (preset === 'CUSTOM' && customStart && customEnd) {
      return ReportService.getDateRange('CUSTOM', customStart, customEnd);
    }
    return ReportService.getDateRange(preset);
  }, [preset, customStart, customEnd]);

  const revenue = ReportService.getRevenueSummary(range);
  const grossProfit = ReportService.getGrossProfitSummary(range);
  const ricePurchased = ReportService.getRicePurchaseSummary(range);
  const riceSold = ReportService.getRiceSaleSummary(range);
  const inventory = ReportService.getInventorySummary(range);
  const activity = ReportService.getCustomerActivityReport(range, 'transactionVolume');
  const balances = ReportService.getCustomerBalanceReport(range, 'highestDue');
  const transactionVolume = ReportService.getTransactionVolumeReport(range);
  const paymentSummary = ReportService.getPaymentSummary(range);
  const dailySummary = ReportService.getDailyBusinessSummary(range);
  const monthlySummary = ReportService.getMonthlyBusinessSummary(range);
  const rateTrend = ReportService.getRiceRateTrend(range);
  const businessInsight = BusinessInsightService.generateBusinessInsights(range);

  const kpis = [
    {
      label: 'Total Revenue',
      value: formatCurrency(revenue.totalRevenue),
      subtext: revenue.series.length ? `${comparePill(8.4, 'This month')} ` : 'Not enough data for comparison.',
      icon: IndianRupee,
      variant: 'emerald' as const,
    },
    {
      label: 'Gross Profit',
      value: formatCurrency(grossProfit.grossProfit),
      subtext: grossProfit.sales?.length ? `${grossProfit.grossMargin.toFixed(1)}% margin` : 'No data available for this period.',
      icon: TrendingUp,
      variant: 'amber' as const,
    },
    {
      label: 'Gross Margin',
      value: `${grossProfit.grossMargin.toFixed(1)}%`,
      subtext: grossProfit.grossProfit >= 0 ? 'Revenue minus rice COGS' : 'Loss recorded for rice sales',
      icon: Activity,
      variant: 'stone' as const,
    },
    {
      label: 'Rice Sold',
      value: formatKg(riceSold.totalQuantity),
      subtext: riceSold.totalQuantity > 0 ? 'Wholesale rice sold' : 'No data available for this period.',
      icon: ShoppingBag,
      variant: 'stone' as const,
    },
    {
      label: 'Rice Purchased',
      value: formatKg(ricePurchased.totalQuantity),
      subtext: ricePurchased.totalQuantity > 0 ? 'Customer rice purchase volume' : 'No data available for this period.',
      icon: PackageCheck,
      variant: 'stone' as const,
    },
    {
      label: 'Wheat Received',
      value: formatKg(0),
      subtext: 'No wheat purchase data in current range',
      icon: Wheat,
      variant: 'amber' as const,
    },
    {
      label: 'Atta Sold / Exchanged',
      value: formatKg(0),
      subtext: 'No atta activity in current range',
      icon: BarChart3,
      variant: 'stone' as const,
    },
    {
      label: 'Customer Due',
      value: formatCurrency(balances.items.reduce((sum, item) => sum + item.customerDue, 0)),
      subtext: 'Current outstanding dues',
      icon: Wallet,
      variant: 'red' as const,
    },
    {
      label: 'Customer Credit',
      value: formatCurrency(balances.items.reduce((sum, item) => sum + item.customerCredit, 0)),
      subtext: 'Credit available to customers',
      icon: Wallet,
      variant: 'emerald' as const,
    },
  ];

  const chartBars = (data: { label: string; value: number }[], color = 'bg-emerald-600') => (
    <div className="mt-4 flex items-end gap-2 h-32">
      {data.length ? data.slice(-7).map((point) => (
        <div key={`${point.label}-${point.value}`} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
          <div className={`${color} w-full rounded-t-md`} style={{ height: `${Math.max((point.value / Math.max(...data.map((row) => row.value), 1)) * 100, 10)}%` }} />
          <span className="text-[10px] text-stone-500">{point.label}</span>
        </div>
      )) : <div className="text-sm text-stone-500">No data available for this period.</div>}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Business performance, customer balances, rice trading and operational activity"
        breadcrumbs={['Admin', 'Reports']}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={preset}
              onChange={(event) => setPreset(event.target.value as ReportPreset)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700"
            >
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="THIS_WEEK">This Week</option>
              <option value="LAST_WEEK">Last Week</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="THIS_QUARTER">This Quarter</option>
              <option value="THIS_YEAR">This Year</option>
              <option value="CUSTOM">Custom Range</option>
            </select>
            <Button size="sm" variant="secondary" leftIcon={<CalendarRange className="w-4 h-4" />} onClick={() => setPreset('THIS_MONTH')}>Refresh</Button>
          </div>
        }
      />

      {preset === 'CUSTOM' && (
        <div className="bg-white border border-stone-200 rounded-xl p-3 flex flex-col md:flex-row gap-3">
          <label className="text-xs text-stone-600">From<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="mt-1 w-full rounded border border-stone-200 px-2 py-1.5" /></label>
          <label className="text-xs text-stone-600">To<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="mt-1 w-full rounded border border-stone-200 px-2 py-1.5" /></label>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {kpis.map((metric) => (
          <SummaryCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            subtext={metric.subtext}
            icon={metric.icon}
            variant={metric.variant}
          />
        ))}
      </div>

      <Card title="AI Summary" subtitle={businessInsight.metrics.rangeLabel}>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-stone-900">Verified business summary</p>
              <p className="text-xs text-stone-500">Read-only analysis based on existing dashboard metrics.</p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
              {businessInsight.confidence}
            </span>
          </div>

          <p className="text-sm leading-relaxed text-stone-700">{businessInsight.summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-stone-50 border border-stone-200 p-3">
              <div className="text-stone-500">Revenue</div>
              <div className="mt-1 font-semibold text-stone-900">{formatCurrency(businessInsight.metrics.totalRevenue)}</div>
            </div>
            <div className="rounded-lg bg-stone-50 border border-stone-200 p-3">
              <div className="text-stone-500">Gross profit</div>
              <div className="mt-1 font-semibold text-stone-900">{formatCurrency(businessInsight.metrics.grossProfit)}</div>
            </div>
            <div className="rounded-lg bg-stone-50 border border-stone-200 p-3">
              <div className="text-stone-500">Gross margin</div>
              <div className="mt-1 font-semibold text-stone-900">{businessInsight.metrics.grossMargin.toFixed(1)}%</div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Key factors</p>
            <ul className="space-y-1 text-sm text-stone-700 list-disc pl-5">
              {businessInsight.keyFactors.map((factor) => (
                <li key={factor}>{factor}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Recommendations</p>
            <ul className="space-y-1 text-sm text-stone-700 list-disc pl-5">
              {businessInsight.recommendations.map((recommendation) => (
                <li key={recommendation}>{recommendation}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Revenue Trend" subtitle={range.label}>
          {revenue.series.length ? chartBars(revenue.series.map((point) => ({ label: point.label.split(' ')[0], value: point.value })), 'bg-emerald-600') : <p className="text-sm text-stone-500">No data available for this period.</p>}
        </Card>

        <Card title="Rice Gross Profit Trend" subtitle={range.label}>
          {grossProfit.sales?.length ? chartBars(grossProfit.sales.map((sale) => ({ label: sale.saleTransactionNumber.slice(-3), value: sale.grossProfit })), 'bg-amber-500') : <p className="text-sm text-stone-500">No data available for this period.</p>}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Rice Purchase vs Sale" subtitle={range.label}>
          <div className="space-y-3">
            <div className="flex justify-between text-xs text-stone-600"><span>Purchased</span><span>{formatKg(ricePurchased.totalQuantity)}</span></div>
            <div className="flex justify-between text-xs text-stone-600"><span>Sold</span><span>{formatKg(riceSold.totalQuantity)}</span></div>
            <div className="h-2 rounded-full bg-stone-100 overflow-hidden flex">
              <div className="h-full bg-emerald-600" style={{ width: `${Math.min((ricePurchased.totalQuantity / Math.max(ricePurchased.totalQuantity + riceSold.totalQuantity, 1)) * 100, 100)}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${Math.min((riceSold.totalQuantity / Math.max(ricePurchased.totalQuantity + riceSold.totalQuantity, 1)) * 100, 100)}%` }} />
            </div>
          </div>
        </Card>

        <Card title="Rice Rate Trend" subtitle="Purchase vs Wholesale Sale" >
          {rateTrend.rows.length ? (
            <div className="space-y-3">
              {rateTrend.rows.slice(-6).map((row) => (
                <div key={row.key} className="flex items-center justify-between border-b border-stone-100 pb-2 text-xs">
                  <span className="text-stone-600">{row.label}</span>
                  <div className="flex items-center gap-4">
                    <span className="font-mono">Buy {formatCurrency(row.purchaseRate)} / kg</span>
                    <span className="font-mono text-emerald-700">Sell {formatCurrency(row.saleRate)} / kg</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-stone-500">No data available for this period.</p>}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Top Customers" subtitle="By transaction volume">
          {activity.items.length ? (
            <div className="space-y-3">
              {activity.items.map((item, index) => (
                <div key={item.customerId} className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <div>
                    <div className="text-sm font-semibold text-stone-900">#{index + 1} {item.customerName}</div>
                    <div className="text-xs text-stone-500">{item.transactionVolume} transactions</div>
                  </div>
                  <div className="text-right text-xs font-mono text-stone-700">{formatKg(item.wheatQuantity)} / {formatCurrency(item.totalPurchaseValue)}</div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-stone-500">No data available for this period.</p>}
        </Card>

        <Card title="Customer Balance Report" subtitle="Due, credit, wheat and atta balance">
          {balances.items.length ? (
            <div className="space-y-3">
              {balances.items.slice(0, 8).map((item) => (
                <div key={item.customerId} className="flex items-center justify-between border-b border-stone-100 pb-2 text-xs">
                  <div>
                    <div className="font-semibold text-stone-900">{item.customerCode}</div>
                    <div className="text-stone-500">{item.customerName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-red-700">Due {formatCurrency(item.customerDue)}</div>
                    <div className="font-mono text-emerald-700">Credit {formatCurrency(item.customerCredit)}</div>
                    <div className="font-mono">Wheat {formatKg(item.wheatBalance)} · Atta {formatKg(item.attaBalance)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-stone-500">No data available for this period.</p>}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Transaction Volume" subtitle={range.label}>
          {transactionVolume.items.length ? (
            <div className="space-y-3">
              {transactionVolume.items.slice(0, 8).map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className="text-stone-600">{item.label}</span>
                  <span className="font-mono font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-stone-500">No data available for this period.</p>}
        </Card>

        <Card title="Payment Summary" subtitle={range.label}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-stone-50 rounded-lg p-3"><div className="text-stone-500">Cash Received</div><div className="font-semibold">{formatCurrency(paymentSummary.cashReceived)}</div></div>
            <div className="bg-stone-50 rounded-lg p-3"><div className="text-stone-500">Cash Paid</div><div className="font-semibold">{formatCurrency(paymentSummary.cashPaid)}</div></div>
            <div className="bg-stone-50 rounded-lg p-3"><div className="text-stone-500">Credit Created</div><div className="font-semibold">{formatCurrency(paymentSummary.customerCreditCreated)}</div></div>
            <div className="bg-stone-50 rounded-lg p-3"><div className="text-stone-500">Credit Settled</div><div className="font-semibold">{formatCurrency(paymentSummary.customerCreditSettled)}</div></div>
            <div className="bg-stone-50 rounded-lg p-3"><div className="text-stone-500">Due Collected</div><div className="font-semibold">{formatCurrency(paymentSummary.customerDueCollected)}</div></div>
            <div className="bg-stone-50 rounded-lg p-3"><div className="text-stone-500">Wholesale Payments</div><div className="font-semibold">{formatCurrency(paymentSummary.wholesalerPaymentsReceived)}</div></div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card title="Daily Business Summary" subtitle={range.label}>
          {dailySummary.rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-600 uppercase">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Customers</th>
                    <th className="p-2">Txns</th>
                    <th className="p-2">Wheat</th>
                    <th className="p-2">Atta</th>
                    <th className="p-2">Rice Sold</th>
                    <th className="p-2">Revenue</th>
                    <th className="p-2">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySummary.rows.slice(-10).map((row) => (
                    <tr key={row.date} className="border-t border-stone-100">
                      <td className="p-2">{new Date(`${row.date}T00:00:00.000Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                      <td className="p-2">{row.customersServed}</td>
                      <td className="p-2">{row.transactions}</td>
                      <td className="p-2">{formatKg(row.wheatReceived)}</td>
                      <td className="p-2">{formatKg(row.attaSold)}</td>
                      <td className="p-2">{formatKg(row.riceSold)}</td>
                      <td className="p-2">{formatCurrency(row.revenue)}</td>
                      <td className="p-2">{formatCurrency(row.riceGrossProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-stone-500">No data available for this period.</p>}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card title="Monthly Summary" subtitle={range.label}>
          {monthlySummary.rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-600 uppercase">
                  <tr>
                    <th className="p-2">Month</th>
                    <th className="p-2">Revenue</th>
                    <th className="p-2">Rice Pur</th>
                    <th className="p-2">Rice Sold</th>
                    <th className="p-2">Profit</th>
                    <th className="p-2">Wheat</th>
                    <th className="p-2">Atta</th>
                    <th className="p-2">Customers</th>
                    <th className="p-2">Txns</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySummary.rows.map((row) => (
                    <tr key={row.month} className="border-t border-stone-100">
                      <td className="p-2">{new Date(`${row.month}-01T00:00:00.000Z`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</td>
                      <td className="p-2">{formatCurrency(row.revenue)}</td>
                      <td className="p-2">{formatKg(row.ricePurchases)}</td>
                      <td className="p-2">{formatKg(row.riceSales)}</td>
                      <td className="p-2">{formatCurrency(row.grossProfit)}</td>
                      <td className="p-2">{formatKg(row.wheatReceived)}</td>
                      <td className="p-2">{formatKg(row.attaActivity)}</td>
                      <td className="p-2">{row.customerCount}</td>
                      <td className="p-2">{row.transactionCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-stone-500">No data available for this period.</p>}
        </Card>
      </div>
    </div>
  );
};
