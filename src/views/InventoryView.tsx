import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Boxes,
  CheckCircle2,
  Edit3,
  History,
  Plus,
  Search,
  SlidersHorizontal,
  Wheat,
  X,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../modules/auth';
import { hasPermission, Permission } from '../modules/auth/permissions';
import { InventoryService } from '../services/inventory.service';
import { InventoryItemCode, ItemDirection } from '../types';
import { Button } from '../components/ui/Button';
import { useDatabaseSync } from '../db/useDatabase';

export interface InventoryViewProps {
  onNavigate: (path: string) => void;
}

const formatKg = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`;
};

export const InventoryView: React.FC<InventoryViewProps> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  // Subscribe to real-time database updates
  const dbVersion = useDatabaseSync();

  const [selectedId, setSelectedId] = useState<string | null>('inv-wheat');
  const [filter, setFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustDirection, setAdjustDirection] = useState<ItemDirection>(ItemDirection.OUT);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Recalculates dynamically on any database mutation or local adjustment
  const summary = useMemo(() => {
    return InventoryService.getInventorySummary();
  }, [dbVersion]);

  const filteredSummary = useMemo(() => {
    return summary.filter((snapshot) => {
      const matchesFilter =
        filter === 'ALL' ||
        (filter === 'LOW' && snapshot.status === 'LOW STOCK') ||
        (filter === 'OUT' && snapshot.status === 'OUT OF STOCK');

      const matchesSearch =
        !searchQuery.trim() ||
        snapshot.item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        snapshot.item.code.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [summary, filter, searchQuery]);

  const selected = useMemo(() => {
    return summary.find((snapshot) => snapshot.item.id === selectedId) || summary[0];
  }, [summary, selectedId]);

  const movements = useMemo(() => {
    return selected ? InventoryService.getStockMovementHistory(selected.item.id).slice(0, 30) : [];
  }, [selected, dbVersion]);

  const canAdjust = hasPermission(role, Permission.ADJUST_INVENTORY);

  const handleAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !user) return;
    const qty = parseFloat(adjustQuantity);
    if (isNaN(qty) || qty <= 0) {
      setMessage({ text: 'Please enter a valid positive quantity.', type: 'error' });
      return;
    }
    if (!adjustReason.trim() || adjustReason.trim().length < 4) {
      setMessage({ text: 'Please provide a clear reason for the adjustment (min 4 characters).', type: 'error' });
      return;
    }

    try {
      InventoryService.createInventoryAdjustment(
        {
          itemId: selected.item.id,
          quantity: qty,
          direction: adjustDirection,
          reason: adjustReason.trim(),
        },
        user
      );
      setMessage({
        text: `Stock adjustment for ${selected.item.name} (${adjustDirection === ItemDirection.IN ? '+' : '-'}${qty} kg) recorded.`,
        type: 'success',
      });
      setAdjustQuantity('');
      setAdjustReason('');
      setIsAdjusting(false);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Unable to adjust stock.',
        type: 'error',
      });
    }
  };

  const getItemIcon = (code: InventoryItemCode) => {
    switch (code) {
      case InventoryItemCode.WHEAT:
        return <Wheat className="w-5 h-5 text-amber-700" />;
      case InventoryItemCode.CHALI_ATTA:
      case InventoryItemCode.ROLL_ATTA:
        return <Boxes className="w-5 h-5 text-emerald-700" />;
      case InventoryItemCode.RICE:
        return <TrendingUp className="w-5 h-5 text-blue-700" />;
      default:
        return <Boxes className="w-5 h-5 text-stone-600" />;
    }
  };

  return (
    <div className="space-y-4 font-sans pb-12 max-w-5xl mx-auto px-1 sm:px-2">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate('/app/more')}
          className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1.5 py-1 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to More
        </button>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Physical Stock
        </span>
      </div>

      <div className="flex items-start justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-950">
            Mill & Grain Inventory
          </h1>
          <p className="text-xs text-stone-500 mt-1 max-w-lg">
            Real-time physical stock tracked atomically across customer deposits, milling extractions, retail sales, and wholesale dispatches.
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
          <Boxes className="w-5 h-5 text-emerald-700" />
        </div>
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

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search grain or flour by name/code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {(['ALL', 'LOW', 'OUT'] as const).map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition cursor-pointer ${
                filter === val
                  ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              {val === 'ALL' ? 'All Stock' : val === 'LOW' ? 'Low Stock Alerts' : 'Out of Stock'}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Stock Cards - Clean Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {filteredSummary.map((snapshot) => {
          const isSelected = selected?.item.id === snapshot.item.id;
          return (
            <button
              key={snapshot.item.id}
              type="button"
              onClick={() => setSelectedId(snapshot.item.id)}
              className={`text-left bg-white rounded-2xl border p-4 shadow-2xs transition relative flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-stone-50 border border-stone-100">
                      {getItemIcon(snapshot.item.code)}
                    </div>
                    <span className="text-sm font-bold text-stone-900 line-clamp-1">
                      {snapshot.item.name}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      snapshot.status === 'IN STOCK'
                        ? 'bg-emerald-100 text-emerald-800'
                        : snapshot.status === 'LOW STOCK'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {snapshot.status}
                  </span>
                </div>

                <div className="mt-2">
                  <span className="text-[11px] font-medium text-stone-500">Current Stock</span>
                  <p className="text-2xl font-extrabold tracking-tight text-stone-950">
                    {formatKg(snapshot.currentStock)}
                  </p>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-stone-100 flex flex-col gap-1 text-[11px] text-stone-500">
                <div className="flex justify-between items-center">
                  <span>Today In:</span>
                  <span className="font-semibold text-emerald-700">+{formatKg(snapshot.todayIn)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Today Out:</span>
                  <span className="font-semibold text-rose-700">-{formatKg(snapshot.todayOut)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-stone-400 pt-0.5">
                  <span>Min reorder:</span>
                  <span>{formatKg(snapshot.item.reorderLevel)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Item Detailed Breakdown & Movement Ledger */}
      {selected && (
        <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-stone-100 border border-stone-200">
                  {getItemIcon(selected.item.code)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-stone-950 flex items-center gap-2">
                    {selected.item.name}
                    <span className="font-mono text-xs font-normal text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                      {selected.item.code}
                    </span>
                  </h2>
                  <p className="text-xs text-stone-500">
                    Reorder Threshold: <strong>{formatKg(selected.item.reorderLevel)}</strong> · Stock Category: {selected.item.category.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
            </div>

            {canAdjust && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setIsAdjusting(true)}
                leftIcon={<Edit3 className="w-3.5 h-3.5" />}
              >
                Record Stock Adjustment
              </Button>
            )}
          </div>

          {/* Metric Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
              <span className="text-[11px] font-medium text-stone-500 block">Today Inflow</span>
              <p className="text-base font-bold text-emerald-700 mt-1">
                +{formatKg(selected.todayIn)}
              </p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
              <span className="text-[11px] font-medium text-stone-500 block">Today Outflow</span>
              <p className="text-base font-bold text-rose-700 mt-1">
                -{formatKg(selected.todayOut)}
              </p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
              <span className="text-[11px] font-medium text-stone-500 block">This Week In</span>
              <p className="text-base font-bold text-stone-800 mt-1">
                +{formatKg(selected.weekIn)}
              </p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
              <span className="text-[11px] font-medium text-stone-500 block">This Week Out</span>
              <p className="text-base font-bold text-stone-800 mt-1">
                -{formatKg(selected.weekOut)}
              </p>
            </div>
          </div>

          {/* Movement Ledger Audit */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-600">
                <History className="w-4 h-4 text-stone-400" />
                Live Stock Movement Trail ({movements.length})
              </h3>
              <span className="text-[11px] text-stone-400">Chronological audit ledger</span>
            </div>

            {movements.length > 0 ? (
              <div className="divide-y divide-stone-100 border border-stone-100 rounded-xl overflow-hidden bg-stone-50/50">
                {movements.map((movement) => {
                  const isIn = movement.direction === ItemDirection.IN;
                  return (
                    <div
                      key={movement.id}
                      className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-stone-50/70 transition"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold text-stone-900 ${
                              isIn ? 'text-emerald-900' : 'text-stone-900'
                            }`}
                          >
                            {movement.movementType.replace(/_/g, ' ')}
                          </span>
                          {movement.transactionNumber && (
                            <span className="font-mono text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              {movement.transactionNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-stone-500 text-[11px]">
                          {new Date(movement.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          ·{' '}
                          {new Date(movement.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {movement.createdByName && ` · by ${movement.createdByName}`}
                        </p>
                        {movement.reason && (
                          <p className="text-stone-600 text-[11px] italic">"{movement.reason}"</p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`font-mono font-bold text-sm inline-flex items-center gap-1 ${
                            isIn ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isIn ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
                          {isIn ? '+' : '-'}
                          {formatKg(movement.quantity)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-stone-50 rounded-xl border border-stone-100 text-stone-500 text-xs">
                No movements recorded for this item yet.
              </div>
            )}
          </div>
        </section>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjusting && selected && (
        <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-xs p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div>
                <h2 className="text-base font-bold text-stone-950">
                  Stock Adjustment: {selected.item.name}
                </h2>
                <p className="text-xs text-stone-500">
                  Current Physical Stock: <strong>{formatKg(selected.currentStock)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjusting(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustment} className="space-y-4">
              {/* Direction Selector */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustDirection(ItemDirection.IN)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      adjustDirection === ItemDirection.IN
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs ring-1 ring-emerald-500'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <Plus className="w-4 h-4 text-emerald-700" />
                    Stock IN (Found/Deposit)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustDirection(ItemDirection.OUT)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      adjustDirection === ItemDirection.OUT
                        ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-2xs ring-1 ring-rose-500'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <ArrowUp className="w-4 h-4 text-rose-700" />
                    Stock OUT (Wastage/Loss)
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Adjustment Quantity (kg)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 25"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                {/* Preset quick buttons */}
                <div className="flex gap-1.5 mt-2">
                  {[5, 10, 25, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAdjustQuantity(String(preset))}
                      className="text-[11px] font-medium px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition cursor-pointer"
                    >
                      +{preset} kg
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Reason / Physical Verification Note
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Weekly physical tally, moisture loss, grain cleaning residue"
                  className="w-full rounded-xl border border-stone-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Projected Result */}
              {adjustQuantity && !isNaN(parseFloat(adjustQuantity)) && (
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs flex justify-between items-center">
                  <span className="text-stone-600">Calculated Post-Adjustment Stock:</span>
                  <strong className="text-stone-950 text-sm font-mono">
                    {formatKg(
                      Math.max(
                        0,
                        selected.currentStock +
                          (adjustDirection === ItemDirection.IN
                            ? parseFloat(adjustQuantity)
                            : -parseFloat(adjustQuantity))
                      )
                    )}
                  </strong>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsAdjusting(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="flex-1">
                  Confirm & Audit Log
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
