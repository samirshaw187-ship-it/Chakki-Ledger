import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Plus,
  Search,
  ShoppingBag,
  Truck,
  Wheat,
  X,
  TrendingUp,
  AlertCircle,
  IndianRupee,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../modules/auth';
import { hasPermission, Permission } from '../modules/auth/permissions';
import { InventoryItemCode, UserRole } from '../types';
import { InventoryService } from '../services/inventory.service';
import { RiceTradingService } from '../services/rice-trading.service';
import { RiceProfitService } from '../services/rice-profit.service';
import { dbRepository } from '../db/in-memory-db';

export interface RiceTradingViewProps {
  onNavigate: (path: string) => void;
}

const kg = (value: number) =>
  `${(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg`;

const money = (value: number) =>
  `₹${(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const RiceTradingView: React.FC<RiceTradingViewProps> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  const [showSale, setShowSale] = useState(false);
  const [search, setSearch] = useState('');
  const [wholesalerId, setWholesalerId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('31');
  const [paid, setPaid] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsub = dbRepository.subscribe(() => {
      setRefresh((val) => val + 1);
    });
    return unsub;
  }, []);

  const snapshot = useMemo(
    () => InventoryService.getInventorySummary().find((item) => item.item.code === InventoryItemCode.RICE),
    [refresh]
  );

  const purchases = useMemo(
    () =>
      RiceTradingService.getRicePurchases().filter((purchase) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return [
          purchase.transaction?.customerName,
          purchase.transaction?.customerCode,
          purchase.transaction?.transactionNumber,
        ].some((val) => val?.toLowerCase().includes(q));
      }),
    [search, refresh]
  );

  const sales = useMemo(() => RiceTradingService.getWholesaleSales(), [refresh]);
  const profitSummary = useMemo(() => RiceProfitService.getRiceProfitSummary(), [refresh]);
  const wholesalers = useMemo(
    () => RiceTradingService.getWholesalers().filter((w) => w.status === 'ACTIVE'),
    [refresh]
  );

  const saleValue = Math.round((Number(quantity) || 0) * (Number(rate) || 0) * 100) / 100;
  const paidValue = Math.min(Number(paid) || 0, saleValue);
  const dueValue = Math.max(0, saleValue - paidValue);
  const canCreate = hasPermission(role, Permission.CREATE_WHOLESALE_SALE);

  const todayPurchased = purchases
    .filter(
      (p) => p.transaction?.date && new Date(p.transaction.date).toDateString() === new Date().toDateString()
    )
    .reduce((sum, p) => sum + p.quantity, 0);

  const todaySold = sales
    .filter(
      (s) => s.transaction?.date && new Date(s.transaction.date).toDateString() === new Date().toDateString()
    )
    .reduce((sum, s) => sum + s.quantity, 0);

  const totalReceivables = sales.reduce((sum, s) => sum + s.amountDue, 0);

  const submitSale = async () => {
    if (!user) return;
    setErrorMessage(null);
    if (!wholesalerId) {
      setErrorMessage('Please select an active wholesaler.');
      return;
    }
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setErrorMessage('Please enter a valid rice quantity in kg.');
      return;
    }
    const currentRiceStock = snapshot?.currentStock || 0;
    if (qty > currentRiceStock) {
      setErrorMessage(`Insufficient rice stock. Available: ${kg(currentRiceStock)}`);
      return;
    }
    const sellRate = Number(rate);
    if (!sellRate || sellRate <= 0) {
      setErrorMessage('Please enter a valid selling rate.');
      return;
    }

    try {
      const sale = await RiceTradingService.createWholesaleSale(
        {
          wholesalerId,
          quantity: qty,
          sellingRate: sellRate,
          amountPaid: Number(paid || 0),
          rateOverrideReason: reason.trim() || undefined,
        },
        user
      );
      setMessage(
        `Wholesale sale ${sale.transaction?.transactionNumber || 'TXN'} confirmed. ${kg(
          sale.quantity
        )} rice dispatched from stock.`
      );
      setShowSale(false);
      setQuantity('');
      setPaid('');
      setReason('');
      setRefresh((val) => val + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to complete wholesale sale.');
    }
  };

  return (
    <div className="space-y-4 font-sans pb-12 max-w-6xl mx-auto px-1 sm:px-0">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onNavigate(role === UserRole.ADMIN ? '/admin/dashboard' : '/app/more')}
          className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1.5 py-1 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {role === UserRole.ADMIN ? 'Dashboard' : 'More'}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/app/wholesalers')}
            className="text-xs font-semibold text-stone-600 hover:text-stone-900 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 transition-colors"
          >
            Manage Wholesalers
          </button>
          {canCreate && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setShowSale(true);
                setErrorMessage(null);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              New Wholesale Sale
            </Button>
          )}
        </div>
      </div>

      {/* Main Banner */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-700 text-white flex items-center justify-center shadow-2xs shrink-0">
              <Wheat className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-stone-950 tracking-tight">Ration Rice Trading</h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Customer grain procurement, inventory balance, and wholesale mandi dispatches
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-stone-50 rounded-xl p-3 border border-stone-200/80">
            <div>
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Physical Rice Stock</span>
              <p className="text-base font-black text-amber-900 leading-tight mt-0.5">{kg(snapshot?.currentStock || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {message && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 animate-in fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{message}</span>
          </span>
          <button type="button" onClick={() => setMessage(null)} className="text-emerald-700 hover:text-emerald-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 animate-in fade-in">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>{errorMessage}</span>
          </span>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-700 hover:text-rose-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Daily Volume & Flow Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-2xs">
          <span className="block text-[10px] uppercase font-bold text-stone-500 tracking-wider">Today Procured</span>
          <p className="text-lg font-black text-stone-900 mt-0.5">+{kg(todayPurchased)}</p>
          <span className="text-[11px] text-stone-400 block mt-1">From customer counter khata</span>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-2xs">
          <span className="block text-[10px] uppercase font-bold text-stone-500 tracking-wider">Today Dispatched</span>
          <p className="text-lg font-black text-stone-900 mt-0.5">-{kg(todaySold)}</p>
          <span className="text-[11px] text-stone-400 block mt-1">To wholesale mandi buyers</span>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-2xs">
          <span className="block text-[10px] uppercase font-bold text-stone-500 tracking-wider">Stock Available</span>
          <p className="text-lg font-black text-emerald-800 mt-0.5">{kg(snapshot?.currentStock || 0)}</p>
          <span className="text-[11px] text-stone-400 block mt-1">Ready for next mandi dispatch</span>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-2xs">
          <span className="block text-[10px] uppercase font-bold text-rose-700 tracking-wider">Wholesaler Dues</span>
          <p className="text-lg font-black text-rose-800 mt-0.5">{money(totalReceivables)}</p>
          <span className="text-[11px] text-stone-400 block mt-1">Total pending payment khata</span>
        </div>
      </div>

      {/* Financial & Profitability Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Wholesale Revenue</span>
          <strong className="text-base font-bold text-stone-900 block mt-0.5">{money(profitSummary.revenue)}</strong>
        </div>
        <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Cost of Rice (COGS)</span>
          <strong className="text-base font-bold text-stone-900 block mt-0.5">{money(profitSummary.cogs)}</strong>
        </div>
        <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
            {profitSummary.grossProfit >= 0 ? 'Gross Trading Profit' : 'Gross Trading Loss'}
          </span>
          <strong
            className={`text-base font-bold block mt-0.5 ${
              profitSummary.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {money(profitSummary.grossProfit)}
          </strong>
        </div>
        <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Profit Margin</span>
          <strong className="text-base font-bold text-stone-900 block mt-0.5">
            {profitSummary.grossMargin.toFixed(1)}%
          </strong>
        </div>
      </div>

      {/* Search Field */}
      <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2 shadow-2xs">
        <Search className="w-4 h-4 text-stone-400 shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter customer name, receipt code or transaction ID..."
          className="w-full text-xs text-stone-900 outline-none bg-transparent"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="text-stone-400 hover:text-stone-700">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Two-Column Lists: Purchases vs Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Purchases from Customers */}
        <section className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-700" />
              <h2 className="font-bold text-sm text-stone-900">Procurement From Customers</h2>
            </div>
            <span className="text-xs text-stone-400">{purchases.length} records</span>
          </div>
          <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto">
            {purchases.map((purchase) => (
              <div
                key={purchase.transaction.id}
                className="p-3 hover:bg-stone-50/80 transition-colors flex items-start justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-stone-900">{purchase.transaction.customerName || 'Customer'}</p>
                    <span className="font-mono text-[10px] text-stone-500 bg-stone-100 px-1 py-0.2 rounded">
                      {purchase.transaction.transactionNumber}
                    </span>
                  </div>
                  <p className="text-stone-500 text-[11px]">
                    {new Date(purchase.transaction.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    · Rate: @{money(purchase.purchaseRate)}/kg
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-amber-900 block">+{kg(purchase.quantity)}</span>
                  <span className="text-[11px] text-stone-500">{money(purchase.totalValue)}</span>
                </div>
              </div>
            ))}
            {purchases.length === 0 && (
              <div className="p-8 text-center text-xs text-stone-400">No rice purchases recorded yet.</div>
            )}
          </div>
        </section>

        {/* Wholesale Sales to Mandi Buyers */}
        <section className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-sky-700" />
              <h2 className="font-bold text-sm text-stone-900">Wholesale Mandi Dispatches</h2>
            </div>
            <span className="text-xs text-stone-400">{sales.length} records</span>
          </div>
          <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto">
            {sales.map((sale) => (
              <div
                key={sale.transaction.id}
                className="p-3 hover:bg-stone-50/80 transition-colors flex items-start justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-stone-900">{sale.wholesaler?.name || 'Wholesaler'}</p>
                    <span className="font-mono text-[10px] text-stone-500 bg-stone-100 px-1 py-0.2 rounded">
                      {sale.transaction.transactionNumber}
                    </span>
                  </div>
                  <p className="text-stone-500 text-[11px]">
                    {new Date(sale.transaction.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    · Sold @{money(sale.sellingRate)}/kg
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-sky-900 block">-{kg(sale.quantity)}</span>
                  <div className="text-[11px]">
                    <span className="text-stone-700 font-semibold">{money(sale.saleValue)}</span>
                    {sale.amountDue > 0 && (
                      <span className="text-rose-600 block text-[10px]">Due: {money(sale.amountDue)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {sales.length === 0 && (
              <div className="p-8 text-center text-xs text-stone-400">No wholesale dispatches recorded yet.</div>
            )}
          </div>
        </section>
      </div>

      {/* New Wholesale Sale Modal */}
      {showSale && (
        <div className="fixed inset-0 z-50 bg-stone-950/40 p-4 flex items-center justify-center backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-4 border border-stone-200 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-base text-stone-950">Record Wholesale Rice Dispatch</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Current physical stock: <strong>{kg(snapshot?.currentStock || 0)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSale(false)}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900">
                {errorMessage}
              </div>
            )}

            <div className="space-y-3 text-xs font-semibold text-stone-700">
              <label className="block">
                Select Wholesaler / Buyer *
                <select
                  value={wholesalerId}
                  onChange={(e) => setWholesalerId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                >
                  <option value="">-- Choose Mandi Wholesaler --</option>
                  {wholesalers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.wholesalerCode}) {w.companyName ? `- ${w.companyName}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  Rice Quantity (kg) *
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 500"
                    className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs font-normal focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </label>
                <label className="block">
                  Selling Rate (₹/kg) *
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="e.g. 31.0"
                    className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs font-normal focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </label>
              </div>

              {/* Total Sale Value Banner */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 flex items-center justify-between text-xs">
                <span className="text-stone-500 font-semibold">Total Invoice Amount:</span>
                <strong className="text-base font-bold text-stone-900">{money(saleValue)}</strong>
              </div>

              <label className="block">
                Amount Paid Today (₹)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={saleValue}
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs font-normal focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </label>

              <div className="flex items-center justify-between text-xs text-stone-500 px-1">
                <span>Remaining Khata Due:</span>
                <strong className={dueValue > 0 ? 'text-rose-700' : 'text-emerald-700'}>{money(dueValue)}</strong>
              </div>

              <label className="block">
                Notes / Rate Override Justification (optional)
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Mandi spot price negotiation"
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs font-normal focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </label>
            </div>

            <div className="flex gap-2 pt-2 border-t border-stone-100">
              <Button variant="outline" className="flex-1" onClick={() => setShowSale(false)}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" onClick={submitSale}>
                Confirm Wholesale Dispatch
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
