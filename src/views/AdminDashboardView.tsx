import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { SummaryCard } from '../components/domain/SummaryCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { dbRepository } from '../db/in-memory-db';
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
  Clock,
  UserCheck,
  ArrowRight,
} from 'lucide-react';
import { TransactionStatus, UserRole, GrainType, ItemType } from '../types';

export interface AdminDashboardViewProps {
  onNavigate: (path: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onNavigate }) => {
  const [, setDataVersion] = useState(0);

  useEffect(() => {
    const unsub = dbRepository.subscribe(() => {
      setDataVersion((v) => v + 1);
    });
    return unsub;
  }, []);

  const transactions = dbRepository.getTransactions();
  const customers = dbRepository.getCustomers();
  const users = dbRepository.getUsers();
  const pendingApprovals = users.filter(
    (u) => u.role === UserRole.OWNER && (!u.isApproved || u.approvalStatus === 'PENDING')
  );

  let totalWheatDepositedKg = 0;
  let totalRicePurchasedKg = 0;
  let totalRevenue = 0;

  transactions.forEach((tx) => {
    totalRevenue += Number(tx.paidAmount || 0);
    tx.items?.forEach((item) => {
      if (item.grainType === GrainType.WHEAT || item.itemType === ItemType.WHEAT) {
        totalWheatDepositedKg += Number(item.quantity || 0);
      }
      if (item.grainType === GrainType.RATION_RICE || item.itemType === ItemType.RICE) {
        totalRicePurchasedKg += Number(item.quantity || 0);
      }
    });
  });

  const recentTransactions = [...transactions].reverse().slice(0, 8);

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

      {/* Pending Shop Owner Approvals Alert Banner */}
      {pendingApprovals.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                {pendingApprovals.length} Shop Owner Registration{pendingApprovals.length > 1 ? 's' : ''} Awaiting Your Approval
              </h3>
              <p className="text-xs text-amber-800">
                New shop owners cannot access the system until approved by Administrator (Samir).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/admin/users')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            <UserCheck className="w-4 h-4" /> Review & Approve <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 5 Real-Time Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <SummaryCard
          label="Total Collected"
          value={`₹${totalRevenue.toLocaleString('en-IN')}`}
          subtext="Cash & UPI collected"
          icon={IndianRupee}
          variant="emerald"
        />
        <SummaryCard
          label="Registered Customers"
          value={`${customers.length}`}
          subtext="Active customer accounts"
          icon={Calendar}
          variant="stone"
        />
        <SummaryCard
          label="Wheat Deposited"
          value={`${totalWheatDepositedKg.toFixed(1)} kg`}
          subtext="Raw grain in milling silos"
          icon={Wheat}
          variant="amber"
        />
        <SummaryCard
          label="Rice Purchased"
          value={`${totalRicePurchasedKg.toFixed(1)} kg`}
          subtext="Ration rice acquired"
          icon={ShoppingBag}
          variant="stone"
        />
        <SummaryCard
          label="Total Transactions"
          value={`${transactions.length}`}
          subtext="Live recorded entries"
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
                <th className="p-3.5">Details</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-stone-400">
                    No transactions recorded yet. When a shop owner deposits wheat or records an entry, it will show here immediately.
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx) => {
                  const customer = customers.find((c) => c.id === tx.customerId);
                  const custName = customer?.name || tx.customerName || 'Walk-in Customer';
                  const timeFormatted = new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  let summaryText = '';
                  if (tx.items && tx.items.length > 0) {
                    summaryText = tx.items
                      .map((i) => `${i.quantity} ${i.unit || 'kg'} ${i.grainType || i.itemType || ''}`.trim())
                      .join(', ');
                    if (tx.netAmount) {
                      summaryText += ` · Net ₹${tx.netAmount}`;
                    }
                  } else if (tx.netAmount) {
                    summaryText = `Amount: ₹${tx.netAmount}`;
                  } else {
                    summaryText = 'Standard ledger entry';
                  }

                  return (
                    <tr key={tx.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="p-3.5 font-mono font-semibold text-stone-700">{tx.transactionNumber}</td>
                      <td className="p-3.5 text-stone-500">{timeFormatted}</td>
                      <td className="p-3.5 font-bold text-stone-900">{custName}</td>
                      <td className="p-3.5 font-medium text-stone-700 capitalize">{tx.type.toLowerCase().replace('_', ' ')}</td>
                      <td className="p-3.5 font-mono text-stone-600">{summaryText}</td>
                      <td className="p-3.5 text-center">
                        <StatusBadge status={tx.status} />
                      </td>
                    </tr>
                  );
                })
              )}
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
