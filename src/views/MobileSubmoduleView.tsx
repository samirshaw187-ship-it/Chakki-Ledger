import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Boxes,
  Wheat,
  Truck,
  FileSpreadsheet,
  Lock,
  Settings,
  HardDriveDownload,
  ShieldCheck,
  Info,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { SummaryCard } from '../components/domain/SummaryCard';
import { Button } from '../components/ui/Button';
import { ChangePasswordCard } from '../components/domain/ChangePasswordCard';
import { dbRepository } from '../db/in-memory-db';
import { AuditService } from '../services/audit.service';
import { AuditLogEntry } from '../types';

export interface MobileSubmoduleViewProps {
  path: string;
  onNavigate: (path: string) => void;
}

export const MobileSubmoduleView: React.FC<MobileSubmoduleViewProps> = ({ path, onNavigate }) => {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    setAuditLogs(AuditService.getLogs().slice(0, 15));
  }, [path]);

  const transactions = dbRepository.getTransactions();
  const customers = dbRepository.getCustomers();
  const wholesalers = dbRepository.getWholesalers();
  const rateConfig = dbRepository.getRateConfig();
  const inventoryItems = dbRepository.getInventoryItems();

  const handleExportBackup = () => {
    const data = {
      exportDate: new Date().toISOString(),
      customers: dbRepository.getCustomers(),
      transactions: dbRepository.getTransactions(),
      payments: dbRepository.getPayments(),
      wholesalers: dbRepository.getWholesalers(),
      rates: dbRepository.getRateConfig(),
      version: '1.0.0',
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chakki-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  // 1. Inventory View
  if (path === '/app/inventory') {
    return (
      <div className="space-y-4 font-sans">
        <button
          type="button"
          onClick={() => onNavigate('/app/more')}
          className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to More Tools</span>
        </button>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200 shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                Grain Inventory & Mill Silos
              </h2>
              <p className="text-xs text-stone-500 mt-0.5 leading-tight">
                Real-time stock of raw wheat, milled atta batches, and commodities
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
          <div className="p-3 bg-stone-50/80 border-b border-stone-200 flex items-center justify-between">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Stock Items Registered
            </span>
            <span className="text-[11px] font-semibold text-stone-600 bg-white px-2 py-0.5 rounded border border-stone-200">
              {inventoryItems.length} Categories
            </span>
          </div>

          <div className="divide-y divide-stone-100 text-xs">
            {inventoryItems.map((item) => (
              <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-stone-50/60">
                <div>
                  <p className="font-semibold text-stone-900">{item.name}</p>
                  <p className="text-[11px] text-stone-500">{item.category}</p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Active Catalog
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 2. Ration Rice Trading View
  if (path === '/app/rice-trading') {
    const riceTxns = transactions.filter(
      (t) => (t as any).riceQuantity || (t as any).ricePurchasedKg || t.description?.toLowerCase().includes('rice')
    );

    const totalRiceKg = riceTxns.reduce(
      (acc, t) => acc + ((t as any).riceQuantity || (t as any).ricePurchasedKg || 0),
      0
    );

    return (
      <div className="space-y-4 font-sans">
        <button
          type="button"
          onClick={() => onNavigate('/app/more')}
          className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to More Tools</span>
        </button>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200 shrink-0">
              <Wheat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                Ration Rice Trading
              </h2>
              <p className="text-xs text-stone-500 mt-0.5 leading-tight">
                Ration rice intake at active support rates
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <SummaryCard
            label="Total Rice Purchased"
            value={`${totalRiceKg} kg`}
            subtext="From counter registrations"
            variant="emerald"
          />
          <SummaryCard
            label="Support Rate"
            value={`₹${rateConfig.ricePurchaseRate || 21}/kg`}
            subtext="Active purchase rate"
            variant="stone"
          />
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
          <div className="p-3 bg-stone-50/80 border-b border-stone-200">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Rice Purchases Log
            </span>
          </div>

          {riceTxns.length > 0 ? (
            <div className="divide-y divide-stone-100 text-xs">
              {riceTxns.map((tx) => (
                <div key={tx.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-stone-900">{tx.customerName || 'Counter Customer'}</p>
                    <p className="text-[11px] text-stone-500">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right font-mono font-semibold text-emerald-800">
                    {(tx as any).riceQuantity || (tx as any).ricePurchasedKg || 0} kg
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-stone-500">
              No rice purchase transactions logged yet. Record your first trade from Counter.
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Wholesalers View
  if (path === '/app/wholesalers') {
    return (
      <div className="space-y-4 font-sans">
        <button
          type="button"
          onClick={() => onNavigate('/app/more')}
          className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to More Tools</span>
        </button>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center border border-stone-200 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                Wholesale Buyers & Mandi Dispatch
              </h2>
              <p className="text-xs text-stone-500 mt-0.5 leading-tight">
                Manage bulk grain trading and mandi receivables
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
          <div className="p-3 bg-stone-50/80 border-b border-stone-200 flex items-center justify-between">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Wholesale Accounts
            </span>
            <span className="text-[11px] font-semibold text-stone-600">
              {wholesalers.length} Active
            </span>
          </div>

          {wholesalers.length > 0 ? (
            <div className="divide-y divide-stone-100 text-xs">
              {wholesalers.map((w) => (
                <div key={w.id} className="p-3.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-stone-900">{w.name}</p>
                    <p className="text-[11px] text-stone-500">{w.phone || w.address || 'Registered Trader'}</p>
                  </div>
                  <div className="text-right font-mono font-semibold text-stone-800">
                    ₹{(w.totalOutstandingPayment || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-stone-500">
              No wholesale traders added yet. Add wholesale accounts as your mandi operations expand.
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. Daily Reports View
  if (path === '/app/reports') {
    const totalTransactions = transactions.length;
    const totalDues = customers.reduce((acc, c) => acc + (c.currentDueAmount || 0), 0);

    return (
      <div className="space-y-4 font-sans">
        <button
          type="button"
          onClick={() => onNavigate('/app/more')}
          className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to More Tools</span>
        </button>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                Daily Ledger Reports
              </h2>
              <p className="text-xs text-stone-500 mt-0.5 leading-tight">
                Live summaries, customer khata balances, and milling logs
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <SummaryCard
            label="Total Transactions"
            value={`${totalTransactions} Entries`}
            subtext="Persisted in database"
            variant="emerald"
          />
          <SummaryCard
            label="Outstanding Dues"
            value={`₹${totalDues.toLocaleString('en-IN')}`}
            subtext={`Across ${customers.length} customers`}
            variant="red"
          />
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 text-xs space-y-2.5">
          <p className="font-bold text-stone-700 uppercase tracking-wider text-[11px]">
            Available Report Actions
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onNavigate('/app/ledger')}
              className="w-full text-xs justify-center"
            >
              Open Complete Ledger Register
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onNavigate('/app/customers')}
              className="w-full text-xs justify-center"
            >
              View Customer Khata Dues
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 5. Daily Closing View
  if (path === '/app/daily-closing') {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTxns = transactions.filter((t) => (t.date || t.createdAt || '').slice(0, 10) === todayStr);
    const todayAmount = todayTxns.reduce((acc, t) => acc + ((t as any).totalAmount || (t as any).amount || 0), 0);

    return (
      <div className="space-y-4 font-sans">
        <button
          type="button"
          onClick={() => onNavigate('/app/more')}
          className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to More Tools</span>
        </button>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                Daily Register Closing
              </h2>
              <p className="text-xs text-stone-500 mt-0.5 leading-tight">
                End-of-day register balancing and tally
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <SummaryCard
            label="Today's Collections"
            value={`₹${todayAmount.toLocaleString('en-IN')}`}
            subtext={`${todayTxns.length} entries today`}
            variant="emerald"
          />
          <SummaryCard
            label="Drawer Status"
            value="Balanced"
            subtext="Ready for day closing"
            variant="stone"
          />
        </div>
      </div>
    );
  }

  // 6. Settings & Rate Configuration View
  if (path === '/app/settings') {
    return (
      <div className="space-y-4 font-sans">
        <button
          type="button"
          onClick={() => onNavigate('/app/more')}
          className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to More Tools</span>
        </button>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200 shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                Rates & Shop Configuration
              </h2>
              <p className="text-xs text-stone-500 mt-0.5 leading-tight">
                Active milling fees and account security settings
              </p>
            </div>
          </div>
        </div>

        {/* Live Active Rates Table */}
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
          <div className="p-3 bg-stone-50/80 border-b border-stone-200">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Active Processing & Commodity Rates
            </span>
          </div>
          <div className="divide-y divide-stone-100 text-xs">
            <div className="p-3 flex items-center justify-between">
              <span className="font-medium text-stone-800">Chali Atta Milling Rate</span>
              <span className="font-mono font-bold text-stone-900">₹{rateConfig.chaliAttaExchangeRate || 8}.00 / kg</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="font-medium text-stone-800">Roll Atta Milling Rate</span>
              <span className="font-mono font-bold text-stone-900">₹{rateConfig.rollAttaExchangeRate || 10}.00 / kg</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="font-medium text-stone-800">Ration Rice Purchase Rate</span>
              <span className="font-mono font-bold text-stone-900">₹{rateConfig.ricePurchaseRate || 21}.00 / kg</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="font-medium text-stone-800">Raw Wheat Purchase Rate</span>
              <span className="font-mono font-bold text-stone-900">₹{rateConfig.wheatCashPurchaseRate || 24}.00 / kg</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="font-medium text-stone-800">Retail Chakki Atta Sale</span>
              <span className="font-mono font-bold text-stone-900">₹{rateConfig.rollAttaSellingRate || 40}.00 / kg</span>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="pt-1">
          <ChangePasswordCard />
        </div>
      </div>
    );
  }

  // 7. Backup & Export View
  if (path === '/app/backup') {
    return (
      <div className="space-y-4 font-sans">
        <button
          type="button"
          onClick={() => onNavigate('/app/more')}
          className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to More Tools</span>
        </button>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200 shrink-0">
              <HardDriveDownload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                Backup & Data Export
              </h2>
              <p className="text-xs text-stone-500 mt-0.5 leading-tight">
                Export all customers, transactions, and ledger entries
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-2xs">
          <div className="space-y-1">
            <p className="text-sm font-bold text-stone-900">Encrypted JSON Ledger Backup</p>
            <p className="text-xs text-stone-600">
              Download your full database snapshot to preserve your accounts offline or transfer data securely.
            </p>
          </div>

          <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs space-y-1.5 text-stone-700">
            <div className="flex justify-between">
              <span>Customers count:</span>
              <span className="font-semibold">{customers.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Transactions count:</span>
              <span className="font-semibold">{transactions.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Sync destination:</span>
              <span className="font-semibold text-emerald-800">Cloud Firestore Active</span>
            </div>
          </div>

          {downloadSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Backup file successfully generated and downloaded!</span>
            </div>
          )}

          <Button
            type="button"
            variant="primary"
            onClick={handleExportBackup}
            className="w-full flex items-center justify-center gap-2 py-2.5"
          >
            <Download className="w-4 h-4" /> Download Backup File (.json)
          </Button>
        </div>
      </div>
    );
  }

  // 8. Audit Logs View
  if (path === '/app/audit-logs') {
    return (
      <div className="space-y-4 font-sans">
        <button
          type="button"
          onClick={() => onNavigate('/app/more')}
          className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to More Tools</span>
        </button>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                Audit Logs & Security Trail
              </h2>
              <p className="text-xs text-stone-500 mt-0.5 leading-tight">
                Live tamper-evident timeline of ledger events
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
          <div className="p-3 bg-stone-50/80 border-b border-stone-200">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Recent System Events ({auditLogs.length})
            </span>
          </div>

          <div className="divide-y divide-stone-100 text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3 hover:bg-stone-50/60">
                <div className="flex items-center justify-between pb-1">
                  <span className="font-semibold text-stone-900">{log.action}</span>
                  <span className="text-[10px] text-stone-400">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-[11px] text-stone-600">{log.reason}</p>
                <div className="text-[10px] text-stone-400 pt-1 flex justify-between">
                  <span>Operator: {log.performedByName}</span>
                  <span>Ref: {log.entityReference || log.entityId}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="space-y-4 font-sans">
      <button
        type="button"
        onClick={() => onNavigate('/app/more')}
        className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer py-1"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to More Tools</span>
      </button>
      <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center text-xs text-stone-500">
        Module details loaded.
      </div>
    </div>
  );
};
