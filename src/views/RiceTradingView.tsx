import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Plus,
  Search,
  ShoppingBag,
  Truck,
  X,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Scale,
  Users,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../modules/auth';
import { hasPermission, Permission } from '../modules/auth/permissions';
import { InventoryItemCode } from '../types';
import { InventoryService } from '../services/inventory.service';
import { RiceTradingService } from '../services/rice-trading.service';
import { RiceProfitService } from '../services/rice-profit.service';
import { useDatabaseSync } from '../db/useDatabase';

export interface RiceTradingViewProps {
  onNavigate: (path: string) => void;
}

const kg = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`;
};

const money = (value: number) =>
  `₹${Math.round(value).toLocaleString('en-IN')}`;

export const RiceTradingView: React.FC<RiceTradingViewProps> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  const dbVersion = useDatabaseSync();

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SALES' | 'PURCHASES'>('OVERVIEW');
  const [showSale, setShowSale] = useState(false);
  const [search, setSearch] = useState('');
  const [wholesalerId, setWholesalerId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('31');
  const [paid, setPaid] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const snapshot = useMemo(() => {
    return InventoryService.getInventorySummary().find(
      (item) => item.item.code === InventoryItemCode.RICE
    );
  }, [dbVersion]);

  const purchases = useMemo(() => {
    return RiceTradingService.getRicePurchases().filter(
      (purchase) =>
        !search ||
        [
          purchase.transaction?.customerName,
          purchase.transaction?.customerCode,
          purchase.transaction?.transactionNumber,
        ].some((val) => val?.toLowerCase().includes(search.toLowerCase()))
    );
  }, [search, dbVersion]);

  const sales = useMemo(() => {
    return RiceTradingService.getWholesaleSales().filter(
      (sale) =>
        !search ||
        [
          sale.wholesaler?.name,
          sale.wholesaler?.wholesalerCode,
          sale.transaction?.transactionNumber,
        ].some((val) => val?.toLowerCase().includes(search.toLowerCase()))
    );
  }, [search, dbVersion]);

  const profitSummary = useMemo(() => {
    return RiceProfitService.getRiceProfitSummary();
  }, [dbVersion]);

  const wholesalers = useMemo(() => {
    return RiceTradingService.getWholesalers();
  }, [dbVersion]);

  const saleValue = Math.round((Number(quantity) || 0) * (Number(rate) || 0) * 100) / 100;
  const paidValue = Math.min(Number(paid) || 0, saleValue);
  const canCreate = hasPermission(role, Permission.CREATE_WHOLESALE_SALE);

  const submitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const qty = parseFloat(quantity);
    const saleRate = parseFloat(rate);

    if (!wholesalerId) {
      setMessage({ text: 'Please select a wholesaler.', type: 'error' });
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setMessage({ text: 'Please specify a valid positive quantity.', type: 'error' });
      return;
    }
    if (isNaN(saleRate) || saleRate <= 0) {
      setMessage({ text: 'Please enter a valid wholesale selling rate.', type: 'error' });
      return;
    }

    try {
      const sale = await RiceTradingService.createWholesaleSale(
        {
          wholesalerId,
          quantity: qty,
          sellingRate: saleRate,
          amountPaid: Number(paid || 0),
          rateOverrideReason: reason,
        },
        user
      );
      setMessage({
        text: `Wholesale sale ${sale.transaction?.transactionNumber || ''} confirmed. ${kg(
          sale.quantity
        )} rice dispatched from inventory.`,
        type: 'success',
      });
      setShowSale(false);
      setQuantity('');
      setPaid('');
      setReason('');
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Unable to save wholesale sale.',
        type: 'error',
      });
    }
  };

  return (
    <div className="space-y-4 font-sans pb-12 max-w-6xl mx-auto px-1 sm:px-2">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate('/app/more')}
          className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1.5 py-1 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to More
        </button>
        <button
          type="button"
          onClick={() => onNavigate('/app/wholesalers')}
          className="text-xs font-medium text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 hover:bg-sky-100 flex items-center gap-1.5 transition cursor-pointer"
        >
          <Users className="w-3.5 h-3.5" /> Manage Wholesalers
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-950">
            Ration Rice Trading
          </h1>
          <p className="text-xs text-stone-500 mt-1 max-w-lg">
            Complete grain trade flow: ration rice collected from cardholders, warehouse stock tracking, bulk mandi dispatches, and margin analytics.
          </p>
        </div>
        {canCreate && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => setShowSale(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Wholesale Dispatch
          </Button>
        )}
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-xs transition ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          <span className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-700" />
            )}
            {message.text}
          </span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-stone-400 hover:text-stone-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-2xs">
          <span className="block text-[11px] font-medium text-stone-500">Current Rice In Mill</span>
          <strong className="block text-2xl font-extrabold text-stone-950 mt-1">
            {kg(snapshot?.currentStock || 0)}
          </strong>
          <span className="text-[10px] text-stone-400 mt-1 block">Live inventory balance</span>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-2xs">
          <span className="block text-[11px] font-medium text-stone-500">Total Procured</span>
          <strong className="block text-2xl font-extrabold text-emerald-700 mt-1">
            {kg(purchases.reduce((sum, p) => sum + p.quantity, 0))}
          </strong>
          <span className="text-[10px] text-stone-400 mt-1 block">From ration cardholders</span>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-2xs">
          <span className="block text-[11px] font-medium text-stone-500">Total Wholesale Sold</span>
          <strong className="block text-2xl font-extrabold text-sky-700 mt-1">
            {kg(sales.reduce((sum, s) => sum + s.quantity, 0))}
          </strong>
          <span className="text-[10px] text-stone-400 mt-1 block">Dispatched to mandis</span>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-2xs">
          <span className="block text-[11px] font-medium text-stone-500">Wholesaler Receivables</span>
          <strong className="block text-2xl font-extrabold text-amber-700 mt-1">
            {money(sales.reduce((sum, s) => sum + s.amountDue, 0))}
          </strong>
          <span className="text-[10px] text-stone-400 mt-1 block">Outstanding dues to collect</span>
        </div>
      </div>

      {/* Financial & Margin Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
          <span className="block text-[11px] font-medium text-stone-500">Gross Revenue</span>
          <p className="text-xl font-bold text-stone-900 mt-1">{money(profitSummary.revenue)}</p>
        </div>
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
          <span className="block text-[11px] font-medium text-stone-500">Cost of Goods (COGS)</span>
          <p className="text-xl font-bold text-stone-900 mt-1">{money(profitSummary.cogs)}</p>
        </div>
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
          <span className="block text-[11px] font-medium text-stone-500">Trading Profit</span>
          <p
            className={`text-xl font-bold mt-1 ${
              profitSummary.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {money(Math.abs(profitSummary.grossProfit))}
          </p>
        </div>
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
          <span className="block text-[11px] font-medium text-stone-500">Gross Margin</span>
          <p className="text-xl font-bold text-emerald-700 mt-1">
            {profitSummary.grossMargin.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="flex gap-1.5 border-b border-stone-200 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'OVERVIEW'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Combined View
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SALES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'SALES'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Wholesale Dispatches ({sales.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PURCHASES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'PURCHASES'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Customer Purchases ({purchases.length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search wholesaler, customer or invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Wholesale Dispatches */}
        {(activeTab === 'OVERVIEW' || activeTab === 'SALES') && (
          <section
            className={`bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs ${
              activeTab === 'SALES' ? 'lg:col-span-2' : ''
            }`}
          >
            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-sky-700" />
                <h2 className="font-bold text-sm text-stone-900">Wholesale Rice Dispatches</h2>
              </div>
              <span className="text-[11px] text-stone-400">{sales.length} records</span>
            </div>

            {sales.length > 0 ? (
              <div className="divide-y divide-stone-100">
                {sales.slice(0, activeTab === 'SALES' ? 50 : 10).map((sale) => (
                  <div
                    key={sale.transaction?.id || Math.random()}
                    className="p-3.5 text-xs flex items-start justify-between gap-3 hover:bg-stone-50/70 transition"
                  >
                    <div>
                      <p className="font-bold text-stone-900">
                        {sale.wholesaler?.name || 'Wholesaler Mandi Buyer'}
                      </p>
                      <p className="text-stone-500 text-[11px] mt-0.5">
                        {sale.transaction?.transactionNumber || 'TXN'} ·{' '}
                        {sale.transaction?.date
                          ? new Date(sale.transaction.date).toLocaleDateString('en-IN')
                          : 'Recorded'}
                      </p>
                      {sale.amountDue > 0 ? (
                        <span className="inline-block mt-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                          Due: {money(sale.amountDue)}
                        </span>
                      ) : (
                        <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                          Fully Cleared
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-sm text-stone-950">{kg(sale.quantity)}</p>
                      <p className="text-stone-500 text-[11px] mt-0.5">
                        @{money(sale.sellingRate)}/kg · {money(sale.saleValue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-stone-500">
                No wholesale rice sales recorded yet.
              </div>
            )}
          </section>
        )}

        {/* Customer Purchases */}
        {(activeTab === 'OVERVIEW' || activeTab === 'PURCHASES') && (
          <section
            className={`bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs ${
              activeTab === 'PURCHASES' ? 'lg:col-span-2' : ''
            }`}
          >
            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-700" />
                <h2 className="font-bold text-sm text-stone-900">Customer Ration Rice Purchases</h2>
              </div>
              <span className="text-[11px] text-stone-400">{purchases.length} records</span>
            </div>

            {purchases.length > 0 ? (
              <div className="divide-y divide-stone-100">
                {purchases.slice(0, activeTab === 'PURCHASES' ? 50 : 10).map((purchase) => (
                  <div
                    key={purchase.transaction?.id || Math.random()}
                    className="p-3.5 text-xs flex items-start justify-between gap-3 hover:bg-stone-50/70 transition"
                  >
                    <div>
                      <p className="font-bold text-stone-900">
                        {purchase.transaction?.customerName || 'Customer'}
                      </p>
                      <p className="text-stone-500 text-[11px] mt-0.5">
                        {purchase.transaction?.transactionNumber || 'TXN'} ·{' '}
                        {purchase.transaction?.date
                          ? new Date(purchase.transaction.date).toLocaleDateString('en-IN')
                          : 'Recorded'}
                      </p>
                      {purchase.transaction?.customerCode && (
                        <span className="font-mono text-[10px] text-stone-500">
                          {purchase.transaction.customerCode}
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-sm text-emerald-700">
                        +{kg(purchase.quantity)}
                      </p>
                      <p className="text-stone-500 text-[11px] mt-0.5">
                        @{money(purchase.purchaseRate)}/kg · {money(purchase.totalValue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-stone-500">
                No customer rice purchases recorded yet.
              </div>
            )}
          </section>
        )}
      </div>

      {/* New Wholesale Sale Modal */}
      {showSale && (
        <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-xs p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div>
                <h2 className="text-base font-bold text-stone-950">Record Wholesale Rice Dispatch</h2>
                <p className="text-xs text-stone-500">
                  Available in mill: <strong>{kg(snapshot?.currentStock || 0)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSale(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitSale} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Registered Wholesaler
                </label>
                <select
                  value={wholesalerId}
                  onChange={(e) => setWholesalerId(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">-- Choose buyer wholesaler --</option>
                  {wholesalers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.wholesalerCode}) · Bal: {money(w.totalOutstandingPayment || 0)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Rice Quantity (kg)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    placeholder="e.g. 500"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Wholesale Rate (₹/kg)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 text-xs flex justify-between items-center">
                <span className="text-stone-600">Calculated Invoice Total:</span>
                <strong className="text-stone-950 font-bold text-sm font-mono">
                  {money(saleValue)}
                </strong>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Cash / Advance Paid Now (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  max={saleValue}
                  placeholder="0 if on credit"
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Remaining added to wholesaler's khata due:{' '}
                  <strong className="text-stone-900">{money(Math.max(0, saleValue - paidValue))}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Negotiation / Override Notes
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Mandi spot price contract, payment cleared via NEFT"
                  className="w-full rounded-xl border border-stone-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowSale(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="flex-1">
                  Confirm Dispatch
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
