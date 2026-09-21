import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { SummaryCard } from '../components/domain/SummaryCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  IndianRupee,
  Calendar,
  Wheat,
  ShoppingBag,
  TrendingUp,
  Lightbulb,
  Receipt,
  Clock,
} from 'lucide-react';
import { dbRepository } from '../db/in-memory-db';
import { RiceTradingService } from '../services/rice-trading.service';

export interface AdminDashboardViewProps {
  onNavigate: (path: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onNavigate }) => {
  const transactions = dbRepository.getTransactions();
  const ricePurchases = RiceTradingService.getRicePurchases();
  const riceSales = RiceTradingService.getWholesaleSales();
  const customers = dbRepository.getCustomers();

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Today's Transactions
  const todayTransactions = transactions.filter((t) => t.date && t.date.startsWith(todayStr));
  const monthTransactions = transactions.filter((t) => t.date && t.date.startsWith(currentMonthStr));

  // Compute live revenue
  const todayRevenueAmount = todayTransactions.reduce((acc, t) => acc + (t.netAmount || 0), 0);
  const monthlyRevenueAmount = monthTransactions.reduce((acc, t) => acc + (t.netAmount || 0), 0);

  // Compute grain metrics
  let wheatReceivedKg = 0;
  todayTransactions.forEach((t) => {
    if (t.items) {
      t.items.forEach((item) => {
        const itemTypeStr = String(item.grainType || item.itemType || '').toLowerCase();
        if (itemTypeStr.includes('wheat')) {
          wheatReceivedKg += item.quantity || 0;
        }
      });
    }
  });

  let ricePurchasedKg = 0;
  ricePurchases.forEach((p) => {
    if (p.transaction?.date && p.transaction.date.startsWith(todayStr)) {
      ricePurchasedKg += p.quantity || 0;
    }
  });

  // Rice Profit Calculation
  const totalRiceCost = ricePurchases.reduce((acc, p) => acc + (p.totalValue || 0), 0);
  const totalRiceRevenue = riceSales.reduce((acc, s) => acc + (s.saleValue || 0), 0);
  const riceProfitAmount = totalRiceRevenue - totalRiceCost;
  const riceProfitMargin = totalRiceCost > 0 ? ((riceProfitAmount / totalRiceCost) * 100).toFixed(0) : '0';

  const metrics = {
    todayRevenue: `₹${todayRevenueAmount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`,
    monthlyRevenue: `₹${monthlyRevenueAmount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`,
    wheatReceived: `${wheatReceivedKg.toFixed(1)} kg`,
    ricePurchased: `${ricePurchasedKg.toFixed(1)} kg`,
    riceProfit: totalRiceCost > 0 ? `₹${riceProfitAmount.toFixed(0)} (${riceProfitMargin}%)` : '₹0 (0%)',
  };

  // 7-day revenue trend
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const revenueTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dStr = d.toISOString().split('T')[0];
    const dayName = daysOfWeek[d.getDay()];
    const dayTxns = transactions.filter((t) => t.date && t.date.startsWith(dStr));
    const val = dayTxns.reduce((sum, t) => sum + (t.netAmount || 0), 0);
    return { day: dayName, value: val };
  });

  const maxRevenue = Math.max(...revenueTrend.map((r) => r.value), 1);
  const revenueBars = revenueTrend.map((r) => ({
    ...r,
    height: `${Math.max(Math.round((r.value / maxRevenue) * 100), 6)}%`,
  }));

  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        title="Admin Control Center"
        description="Comprehensive desktop management, grain flow analytics, and financial trends"
        breadcrumbs={['Admin', 'Dashboard']}
        action={
          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-semibold text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>Chakki Business Active</span>
          </div>
        }
      />

      {/* 5 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <SummaryCard
          label="Today's Revenue"
          value={metrics.todayRevenue}
          subtext="Cash & UPI collected"
          icon={IndianRupee}
          variant="emerald"
        />
        <SummaryCard
          label="Monthly Revenue"
          value={metrics.monthlyRevenue}
          subtext="Current month-to-date"
          icon={Calendar}
          variant="stone"
        />
        <SummaryCard
          label="Wheat Received"
          value={metrics.wheatReceived}
          subtext="Raw grain deposited today"
          icon={Wheat}
          variant="amber"
        />
        <SummaryCard
          label="Rice Purchased"
          value={metrics.ricePurchased}
          subtext="Ration rice from customers"
          icon={ShoppingBag}
          variant="stone"
        />
        <SummaryCard
          label="Rice Profit"
          value={metrics.riceProfit}
          subtext="Wholesale trading spread"
          icon={TrendingUp}
          variant="emerald"
        />
      </div>

      {/* 2-Column Trends: Revenue Trend & Rice Profit Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Revenue Trend */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Revenue Trend</h3>
              <p className="text-xs text-stone-500">7-Day daily gross counter takings</p>
            </div>
            <span className="text-xs font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200 flex items-center gap-1">
              Live Aggregate
            </span>
          </div>

          {/* Simple Clean Bar Chart Visualizer */}
          <div className="h-44 flex items-end justify-between gap-3 pt-6 px-2 border-b border-stone-100">
            {revenueBars.map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div
                  style={{ height: item.height }}
                  className={`w-full max-w-[36px] ${
                    item.value > 0 ? 'bg-emerald-700/85 hover:bg-emerald-800' : 'bg-stone-200'
                  } transition-colors rounded-t-md relative group cursor-pointer`}
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-stone-900 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow-md whitespace-nowrap z-10">
                    ₹{item.value.toFixed(0)}
                  </div>
                </div>
                <span className="text-[11px] font-medium text-stone-600 mt-1">{item.day}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-stone-400 text-center">
            Daily counter aggregates across cash, UPI, and khata clearance
          </p>
        </div>

        {/* 2. Rice Profit Trend */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Rice Profit Trend</h3>
              <p className="text-xs text-stone-500">Purchase cost vs wholesale dispatch price</p>
            </div>
            <span className="text-xs font-mono font-bold text-stone-800 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
              {totalRiceCost > 0 ? `Spread: ₹${(riceProfitAmount / (ricePurchasedKg || 1)).toFixed(2)}/kg` : 'No Trades'}
            </span>
          </div>

          {totalRiceCost > 0 || totalRiceRevenue > 0 ? (
            <div className="h-44 flex flex-col justify-center space-y-3 px-2">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-stone-700">
                  <span>Customer Purchase Cost</span>
                  <span className="font-mono font-semibold">₹{totalRiceCost.toFixed(2)}</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-stone-500 h-2.5 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-emerald-800">
                  <span>Wholesale Realization</span>
                  <span className="font-mono font-bold">₹{totalRiceRevenue.toFixed(2)}</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-700 h-2.5 rounded-full"
                    style={{
                      width: `${totalRiceCost > 0 ? Math.min((totalRiceRevenue / totalRiceCost) * 100, 100) : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-900">Net Estimated Profit Spread</span>
                <span className="font-mono font-bold text-emerald-950 text-sm">₹{riceProfitAmount.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-center p-4">
              <ShoppingBag className="w-8 h-8 text-stone-300 mb-2" />
              <p className="text-xs font-bold text-stone-700">No rice trade transactions recorded yet</p>
              <p className="text-[11px] text-stone-400 mt-0.5 max-w-xs">
                Purchase customer ration rice or log wholesale dispatches to calculate trading spread.
              </p>
            </div>
          )}

          <p className="text-[11px] text-stone-400 text-center">
            Margin tracking automatically computed on customer rice inflow vs mandi dispatch
          </p>
        </div>
      </div>

      {/* 3. Recent Transactions Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Recent Transactions</h3>
            <p className="text-xs text-stone-500">Live operational ledger feed from the counter</p>
          </div>
          {recentTransactions.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('/admin/transactions')}
              className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
            >
              View Full Table →
            </button>
          )}
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3 text-stone-400">
              <Receipt className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-stone-800">No transactions recorded yet</p>
            <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
              Transactions logged at the counter or in the mobile view will appear here immediately in real time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100 text-stone-500 font-semibold uppercase tracking-wider">
                  <th className="p-3.5">Txn #</th>
                  <th className="p-3.5">Time</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Quantity / Amount Summary</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="p-3.5 font-mono font-semibold text-stone-700">{tx.transactionNumber}</td>
                    <td className="p-3.5 text-stone-500">{new Date(tx.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-3.5 font-bold text-stone-900">{tx.customerName || 'General'}</td>
                    <td className="p-3.5 font-medium text-stone-700">{tx.type}</td>
                    <td className="p-3.5 font-mono text-stone-600">₹{(tx.netAmount || 0).toFixed(2)}</td>
                    <td className="p-3.5 text-center">
                      <StatusBadge status={tx.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Business Insights Section */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900">System Status</h3>
            <p className="text-xs text-stone-500">Real-time status of business databases and queues</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
            <p className="font-bold text-stone-900">Customer Directory</p>
            <p className="text-stone-600 leading-relaxed">
              {customers.length === 0
                ? 'Database is clean. No customers registered yet. Ready to enroll shop accounts.'
                : `${customers.length} customer accounts active in the ledger.`}
            </p>
          </div>
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
            <p className="font-bold text-stone-900">Transactions Ledger</p>
            <p className="text-stone-600 leading-relaxed">
              {transactions.length === 0
                ? 'No transactions logged. All counters, khatas, and grain registers are initialized at zero.'
                : `${transactions.length} transactions recorded in the audit trail.`}
            </p>
          </div>
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
            <p className="font-bold text-stone-900">Ration Rice & Mandi Desk</p>
            <p className="text-stone-600 leading-relaxed">
              {ricePurchases.length === 0
                ? 'No rice trading batches or wholesale transactions currently pending.'
                : `${ricePurchases.length} rice purchases recorded.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
