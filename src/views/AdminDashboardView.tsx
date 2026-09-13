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
  ArrowUpRight,
  Receipt,
  Info,
} from 'lucide-react';
import { TransactionStatus } from '../types';

export interface AdminDashboardViewProps {
  onNavigate: (path: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onNavigate }) => {
  // Sample Illustrative Data (strictly separated from future live calculations)
  const sampleMetrics = {
    todayRevenue: '₹4,820',
    monthlyRevenue: '₹1,42,800',
    wheatReceived: '185 kg',
    ricePurchased: '64 kg',
    riceProfit: '₹2,160 (22%)',
  };

  const sampleRecentTransactions = [
    {
      id: 'tx-001',
      number: 'TX-2026-001',
      time: '08:20 AM',
      customer: 'Rahul Das',
      type: 'Wheat Deposit',
      qtyAmount: '15.0 kg Raw Wheat',
      status: TransactionStatus.COMPLETED,
    },
    {
      id: 'tx-002',
      number: 'TX-2026-002',
      time: '09:05 AM',
      customer: 'Rahim Sheikh',
      type: 'Rice → Atta Settlement',
      qtyAmount: '15 kg Rice (₹315) vs 5 kg Atta (₹200) → Net ₹115',
      status: TransactionStatus.COMPLETED,
    },
    {
      id: 'tx-003',
      number: 'TX-2026-003',
      time: '09:45 AM',
      customer: 'Amit Mondal',
      type: 'Atta Retail Sale',
      qtyAmount: '10.0 kg Chali Atta · ₹340.00',
      status: TransactionStatus.COMPLETED,
    },
    {
      id: 'tx-004',
      number: 'TX-2026-004',
      time: '10:15 AM',
      customer: 'Karim',
      type: 'Wheat Deposit',
      qtyAmount: '25.0 kg Raw Wheat',
      status: TransactionStatus.COMPLETED,
    },
    {
      id: 'tx-005',
      number: 'TX-2026-005',
      time: '11:10 AM',
      customer: 'Rakesh',
      type: 'Ration Rice Purchase',
      qtyAmount: '20.0 kg Rice @ ₹21/kg · ₹420.00',
      status: TransactionStatus.CONFIRMED,
    },
  ];

  const sampleRevenueTrend = [
    { day: 'Mon', value: 3800, height: '55%' },
    { day: 'Tue', value: 4200, height: '65%' },
    { day: 'Wed', value: 3950, height: '60%' },
    { day: 'Thu', value: 5100, height: '80%' },
    { day: 'Fri', value: 4820, height: '75%' },
    { day: 'Sat', value: 6200, height: '95%' },
    { day: 'Sun', value: 2900, height: '45%' },
  ];

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

      {/* Illustrative Data Notice */}
      <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 p-3 rounded-xl text-xs text-stone-600">
        <Info className="w-4 h-4 text-emerald-700 shrink-0" />
        <span>
          <strong>Dashboard Placeholder:</strong> The metrics and charts below showcase sample/illustrative data. Live database aggregations will be plugged in during the analytics and reporting phases.
        </span>
      </div>

      {/* 5 Requested Dashboard Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <SummaryCard
          label="Today's Revenue"
          value={sampleMetrics.todayRevenue}
          subtext="Cash & UPI collected"
          icon={IndianRupee}
          variant="emerald"
        />
        <SummaryCard
          label="Monthly Revenue"
          value={sampleMetrics.monthlyRevenue}
          subtext="September month-to-date"
          icon={Calendar}
          variant="stone"
        />
        <SummaryCard
          label="Wheat Received"
          value={sampleMetrics.wheatReceived}
          subtext="Raw grain deposited today"
          icon={Wheat}
          variant="amber"
        />
        <SummaryCard
          label="Rice Purchased"
          value={sampleMetrics.ricePurchased}
          subtext="Ration rice from customers"
          icon={ShoppingBag}
          variant="stone"
        />
        <SummaryCard
          label="Rice Profit"
          value={sampleMetrics.riceProfit}
          subtext="Wholesale trading spread"
          icon={TrendingUp}
          variant="emerald"
        />
      </div>

      {/* 2-Column Trends: Revenue Trend & Rice Profit Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Revenue Trend Placeholder */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Revenue Trend</h3>
              <p className="text-xs text-stone-500">7-Day daily gross counter takings</p>
            </div>
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> +14.2% vs last week
            </span>
          </div>

          {/* Simple Clean Bar Chart Visualizer (Tailwind CSS, No external charting bugs) */}
          <div className="h-44 flex items-end justify-between gap-3 pt-6 px-2 border-b border-stone-100">
            {sampleRevenueTrend.map((item) => (
              <div key={item.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div
                  style={{ height: item.height }}
                  className="w-full max-w-[36px] bg-emerald-700/85 hover:bg-emerald-800 transition-colors rounded-t-md relative group cursor-pointer"
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-stone-900 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow-md whitespace-nowrap z-10">
                    ₹{item.value}
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

        {/* 2. Rice Profit Trend Placeholder */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Rice Profit Trend</h3>
              <p className="text-xs text-stone-500">Purchase cost vs wholesale dispatch price</p>
            </div>
            <span className="text-xs font-mono font-bold text-stone-800 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
              Avg Spread: ₹4.80/kg
            </span>
          </div>

          <div className="h-44 flex flex-col justify-center space-y-3 px-2">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-stone-700">
                <span>Farmer Purchase Cost (@ ₹21/kg)</span>
                <span className="font-mono font-semibold">₹7,980 (380 kg)</span>
              </div>
              <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-stone-500 h-2.5 rounded-full" style={{ width: '78%' }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-emerald-800">
                <span>Wholesale Realization (@ ₹26/kg)</span>
                <span className="font-mono font-bold">₹9,880</span>
              </div>
              <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-emerald-700 h-2.5 rounded-full" style={{ width: '96%' }} />
              </div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-900">Net Estimated Profit Spread</span>
              <span className="font-mono font-bold text-emerald-950 text-sm">₹1,900.00</span>
            </div>
          </div>

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
          <button
            type="button"
            onClick={() => onNavigate('/admin/transactions')}
            className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
          >
            View Full Table →
          </button>
        </div>

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
              {sampleRecentTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-stone-50/60 transition-colors">
                  <td className="p-3.5 font-mono font-semibold text-stone-700">{tx.number}</td>
                  <td className="p-3.5 text-stone-500">{tx.time}</td>
                  <td className="p-3.5 font-bold text-stone-900">{tx.customer}</td>
                  <td className="p-3.5 font-medium text-stone-700">{tx.type}</td>
                  <td className="p-3.5 font-mono text-stone-600">{tx.qtyAmount}</td>
                  <td className="p-3.5 text-center">
                    <StatusBadge status={tx.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Business Insights Section */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900">Business Insights & Alerts</h3>
            <p className="text-xs text-stone-500">Automated recommendations derived from ledger patterns</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
            <p className="font-bold text-stone-900">Ration Rice Threshold</p>
            <p className="text-stone-600 leading-relaxed">
              Rice holding has reached 380 kg. It is recommended to contact Gupta Rice Traders for a 400 kg pickup to capture peak mandi rates.
            </p>
          </div>
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
            <p className="font-bold text-stone-900">Customer Dues Recovery</p>
            <p className="text-stone-600 leading-relaxed">
              Total customer receivables are ₹1,420 across 3 accounts. All 3 accounts have had active deposits within the last 7 days.
            </p>
          </div>
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
            <p className="font-bold text-stone-900">Milling Capacity</p>
            <p className="text-stone-600 leading-relaxed">
              Wheat storage currently has 420 kg awaiting grinding. Daily capacity utilization is at 65% with optimal hopper maintenance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
