import React from 'react';
import { SummaryCard } from '../components/domain/SummaryCard';
import { TransactionCard } from '../components/domain/TransactionCard';
import { Plus, ArrowRight, IndianRupee, Wheat, ShoppingBag, AlertCircle } from 'lucide-react';
import { Transaction } from '../types';
import { dbRepository } from '../db/in-memory-db';
import { RiceTradingService } from '../services/rice-trading.service';

export interface MobileHomeViewProps {
  onNavigate: (path: string) => void;
  userName?: string;
}

export const MobileHomeView: React.FC<MobileHomeViewProps> = ({ onNavigate, userName }) => {
  // Dynamic greeting based on current time
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Transactions from repository
  const transactions: Transaction[] = dbRepository.getTransactions();
  const customers = dbRepository.getCustomers();
  const ricePurchases = RiceTradingService.getRicePurchases();

  const todayTransactions = transactions.filter((t) => t.date && t.date.startsWith(todayStr));

  // Compute live summary metrics
  const todaySalesVal = todayTransactions.reduce((acc, t) => acc + (t.netAmount || 0), 0);

  let wheatReceivedVal = 0;
  todayTransactions.forEach((t) => {
    if (t.items) {
      t.items.forEach((item) => {
        const itemTypeStr = String(item.grainType || item.itemType || '').toLowerCase();
        if (itemTypeStr.includes('wheat')) {
          wheatReceivedVal += item.quantity || 0;
        }
      });
    }
  });

  let ricePurchasedVal = 0;
  ricePurchases.forEach((p) => {
    if (p.transaction?.date && p.transaction.date.startsWith(todayStr)) {
      ricePurchasedVal += p.quantity || 0;
    }
  });

  const totalCustomerDue = customers.reduce((acc, c) => acc + (c.currentDueAmount > 0 ? c.currentDueAmount : 0), 0);

  const metrics = {
    todaySales: `₹${todaySalesVal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`,
    wheatReceived: `${wheatReceivedVal.toFixed(1)} kg`,
    ricePurchased: `${ricePurchasedVal.toFixed(1)} kg`,
    customerDue: `₹${totalCustomerDue.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`,
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Greeting & Today's Date */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs">
        <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
          Chakki Counter Register
        </span>
        <h2 className="text-xl font-bold text-stone-900 mt-0.5 tracking-tight">
          {greeting}, {userName ? userName.split(' ')[0] : 'Owner'}
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">{todayFormatted}</p>
      </div>

      {/* 2. Primary Hero Action: + New Transaction */}
      <div>
        <button
          type="button"
          onClick={() => onNavigate('/app/transactions/new')}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-emerald-800 text-white hover:bg-emerald-900 active:bg-emerald-950 shadow-md transition-all cursor-pointer group min-h-[56px]"
          aria-label="Create New Transaction"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white group-hover:scale-105 transition-transform">
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="text-left">
              <p className="text-base font-bold leading-tight">+ New Transaction</p>
              <p className="text-xs text-emerald-200 leading-tight mt-0.5">
                Milling, Wheat deposit & Rice exchange
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-emerald-200 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
      </div>

      {/* 3. Small Summary Cards (2x2 Grid) */}
      <div className="space-y-1.5">
        <p className="text-xs font-bold text-stone-600 uppercase tracking-wider px-1">
          Today's Register Snapshot
        </p>
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          <SummaryCard
            label="Today's Sales"
            value={metrics.todaySales}
            subtext="Cash & UPI collected"
            icon={IndianRupee}
            variant="emerald"
            onClick={() => onNavigate('/app/ledger')}
          />
          <SummaryCard
            label="Wheat Received"
            value={metrics.wheatReceived}
            subtext="Deposit for milling"
            icon={Wheat}
            variant="amber"
            onClick={() => onNavigate('/app/ledger')}
          />
          <SummaryCard
            label="Rice Purchased"
            value={metrics.ricePurchased}
            subtext="From ration cards"
            icon={ShoppingBag}
            variant="stone"
            onClick={() => onNavigate('/app/rice-trading')}
          />
          <SummaryCard
            label="Customer Due"
            value={metrics.customerDue}
            subtext="Pending khata balance"
            icon={AlertCircle}
            variant="red"
            onClick={() => onNavigate('/app/customers')}
          />
        </div>
      </div>

      {/* 4. Recent Transactions List */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">
            Recent Transactions
          </p>
          {transactions.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('/app/ledger')}
              className="text-xs text-emerald-800 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
            >
              Full Ledger <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3 text-stone-400">
              <Wheat className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-stone-800">No transactions recorded yet</p>
            <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
              Start by tapping "+ New Transaction" above to log your first milling, deposit, or rice exchange.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {transactions.slice(0, 10).map((tx) => (
              <TransactionCard
                key={tx.id}
                transaction={tx}
                onClick={() => onNavigate(`/app/transactions/${tx.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
