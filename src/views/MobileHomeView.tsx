import React, { useState, useEffect } from 'react';
import { SummaryCard } from '../components/domain/SummaryCard';
import { TransactionCard } from '../components/domain/TransactionCard';
import { Plus, ArrowRight, IndianRupee, Wheat, ShoppingBag, AlertCircle, Receipt } from 'lucide-react';
import { Transaction, Customer } from '../types';
import { dbRepository } from '../db/in-memory-db';

export interface MobileHomeViewProps {
  onNavigate: (path: string) => void;
  userName?: string;
}

export const MobileHomeView: React.FC<MobileHomeViewProps> = ({ onNavigate, userName }) => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => dbRepository.getTransactions());
  const [customers, setCustomers] = useState<Customer[]>(() => dbRepository.getCustomers());

  useEffect(() => {
    const unsub = dbRepository.subscribe(() => {
      setTransactions([...dbRepository.getTransactions()]);
      setCustomers([...dbRepository.getCustomers()]);
    });
    return unsub;
  }, []);

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

  // Calculate real live metrics from repository
  const todayStr = new Date().toISOString().slice(0, 10);
  
  const todayTransactions = transactions.filter((t) => (t.date || t.createdAt || '').slice(0, 10) === todayStr);

  const todaySalesVal = todayTransactions.reduce((acc, t) => {
    const amt = (t as any).totalAmount || (t as any).amount || (t as any).netAmount || 0;
    return acc + amt;
  }, 0);

  const todayWheatVal = todayTransactions.reduce((acc, t) => {
    const wheatKg = (t as any).wheatInput || (t as any).wheatDepositedKg || (t as any).quantity || 0;
    return acc + (typeof wheatKg === 'number' ? wheatKg : parseFloat(wheatKg) || 0);
  }, 0);

  const todayRiceVal = todayTransactions.reduce((acc, t) => {
    const riceKg = (t as any).riceQuantity || (t as any).ricePurchasedKg || 0;
    return acc + (typeof riceKg === 'number' ? riceKg : parseFloat(riceKg) || 0);
  }, 0);

  const totalCustomerDueVal = customers.reduce((acc, c) => acc + (c.currentDue || 0), 0);

  const liveMetrics = {
    todaySales: `₹${todaySalesVal.toLocaleString('en-IN')}`,
    wheatReceived: `${todayWheatVal.toLocaleString('en-IN')} kg`,
    ricePurchased: `${todayRiceVal.toLocaleString('en-IN')} kg`,
    customerDue: `₹${totalCustomerDueVal.toLocaleString('en-IN')}`,
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

      {/* 3. Real Live Summary Cards (2x2 Grid) */}
      <div className="space-y-1.5">
        <p className="text-xs font-bold text-stone-600 uppercase tracking-wider px-1">
          Today's Register Snapshot
        </p>
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          <SummaryCard
            label="Today's Sales"
            value={liveMetrics.todaySales}
            subtext="Cash & UPI collected"
            icon={IndianRupee}
            variant="emerald"
            onClick={() => onNavigate('/app/ledger')}
          />
          <SummaryCard
            label="Wheat Received"
            value={liveMetrics.wheatReceived}
            subtext="Deposit for milling"
            icon={Wheat}
            variant="amber"
            onClick={() => onNavigate('/app/ledger')}
          />
          <SummaryCard
            label="Rice Purchased"
            value={liveMetrics.ricePurchased}
            subtext="From ration cards"
            icon={ShoppingBag}
            variant="stone"
            onClick={() => onNavigate('/app/rice-trading')}
          />
          <SummaryCard
            label="Customer Due"
            value={liveMetrics.customerDue}
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
          <button
            type="button"
            onClick={() => onNavigate('/app/ledger')}
            className="text-xs text-emerald-800 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
          >
            Full Ledger <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {transactions.length > 0 ? (
          <div className="space-y-2.5">
            {transactions.slice(0, 10).map((tx) => (
              <TransactionCard
                key={tx.id}
                transaction={tx}
                onClick={() => onNavigate(`/app/transactions/${tx.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 border border-stone-200 text-center space-y-2 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
              <Receipt className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-stone-800">No Transactions Recorded Yet</p>
            <p className="text-[11px] text-stone-500 max-w-xs mx-auto">
              Your register is fresh and ready. Tap "+ New Transaction" above to record milling, wheat deposits, or payments.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
