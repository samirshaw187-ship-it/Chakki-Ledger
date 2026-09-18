import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Boxes,
  CheckCircle2,
  Edit3,
  History,
  IndianRupee,
  Package,
  Plus,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useAuth } from '../modules/auth';
import { hasPermission, Permission } from '../modules/auth/permissions';
import { InventoryService, InventoryStockSnapshot } from '../services/inventory.service';
import { RateService } from '../services/rate.service';
import { dbRepository } from '../db/in-memory-db';
import { InventoryItemCode, ItemDirection, UserRole } from '../types';
import { Button } from '../components/ui/Button';

export interface InventoryViewProps {
  onNavigate: (path: string) => void;
}

const formatKg = (value: number) =>
  `${(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg`;

const formatCurrency = (value: number) =>
  `₹${(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getItemUnitRate(code: InventoryItemCode): number {
  const rates = RateService.getCurrentRates();
  switch (code) {
    case InventoryItemCode.WHEAT:
      return rates.wheatCashPurchaseRate || 24;
    case InventoryItemCode.CHALI_ATTA:
      return rates.chaliAttaSellingRate || 35;
    case InventoryItemCode.ROLL_ATTA:
      return rates.rollAttaSellingRate || 40;
    case InventoryItemCode.RICE:
      return rates.ricePurchaseRate || 21;
    default:
      return 25;
  }
}

export const InventoryView: React.FC<InventoryViewProps> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustDirection, setAdjustDirection] = useState<ItemDirection>(ItemDirection.OUT);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  // Subscribe to real-time database changes
  useEffect(() => {
    const unsub = dbRepository.subscribe(() => {
      setRefresh((val) => val + 1);
    });
    return unsub;
  }, []);

  const summary = useMemo(() => InventoryService.getInventorySummary(), [refresh]);

  // Default selection to first item if none selected
  useEffect(() => {
    if (!selectedId && summary.length > 0) {
      setSelectedId(summary[0].item.id);
    }
  }, [selectedId, summary]);

  const visibleSummary = summary.filter((snapshot) => {
    if (filter === 'LOW') return snapshot.status === 'LOW STOCK';
    if (filter === 'OUT') return snapshot.status === 'OUT OF STOCK';
    return true;
  });

  const selected = summary.find((snapshot) => snapshot.item.id === selectedId) || summary[0];
  const movements = selected ? InventoryService.getStockMovementHistory(selected.item.id).slice(0, 30) : [];
  const canAdjust = hasPermission(role, Permission.ADJUST_INVENTORY);

  // Valuation calculations
  const totalStockKg = summary.reduce((acc, s) => acc + Math.max(0, s.currentStock), 0);
  const totalValuation = summary.reduce((acc, s) => {
    const rate = getItemUnitRate(s.item.code);
    return acc + Math.max(0, s.currentStock) * rate;
  }, 0);

  const selectedRate = selected ? getItemUnitRate(selected.item.code) : 0;
  const selectedValue = selected ? Math.max(0, selected.currentStock) * selectedRate : 0;

  const handleAdjustment = () => {
    if (!selected || !user) return;
    setErrorMessage(null);
    const qty = Number(adjustQuantity);
    if (!qty || qty <= 0) {
      setErrorMessage('Please enter a valid quantity greater than 0.');
      return;
    }
    if (!adjustReason || adjustReason.trim().length < 4) {
      setErrorMessage('Please provide a reason of at least 4 characters for the audit log.');
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
      setMessage(
        `Successfully adjusted ${selected.item.name}: ${adjustDirection === ItemDirection.IN ? '+' : '-'}${formatKg(
          qty
        )}. Logged in audit trail.`
      );
      setAdjustQuantity('');
      setAdjustReason('');
      setIsAdjusting(false);
      setRefresh((val) => val + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to adjust stock.');
    }
  };

  return (
    <div className="space-y-4 font-sans pb-12 max-w-5xl mx-auto px-1 sm:px-0">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate(role === UserRole.ADMIN ? '/admin/dashboard' : '/app/more')}
          className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1.5 py-1 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {role === UserRole.ADMIN ? 'Dashboard' : 'More'}
        </button>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            Live Sync
          </span>
        </div>
      </div>

      {/* Main Title & Overall Inventory Valuation */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-2xs shrink-0">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-stone-950 tracking-tight">Grain & Atta Inventory</h1>
              <p className="text-xs text-stone-500 mt-0.5">Real-time physical stock and valuation across all chakki silos</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-stone-50 rounded-xl p-3 border border-stone-200/80 self-stretch sm:self-auto justify-between sm:justify-end">
            <div>
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Total Physical Stock</span>
              <p className="text-base font-bold text-stone-900 leading-tight mt-0.5">{formatKg(totalStockKg)}</p>
            </div>
            <div className="h-7 w-px bg-stone-300/80" />
            <div>
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Stock Valuation</span>
              <p className="text-base font-bold text-emerald-800 leading-tight mt-0.5">{formatCurrency(totalValuation)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Messages */}
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
            <X className="w-4 h-4 text-rose-700 shrink-0" />
            <span>{errorMessage}</span>
          </span>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-700 hover:text-rose-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {(['ALL', 'LOW', 'OUT'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
              filter === value
                ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
            }`}
          >
            {value === 'ALL' ? 'All Silos (4)' : value === 'LOW' ? 'Low Stock' : 'Out of Stock'}
          </button>
        ))}
      </div>

      {/* Stock Cards (Non-overlapping, responsive grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {visibleSummary.map((snapshot) => {
          const rate = getItemUnitRate(snapshot.item.code);
          const value = Math.max(0, snapshot.currentStock) * rate;
          const isSelected = selectedId === snapshot.item.id;

          const statusColor =
            snapshot.status === 'IN STOCK'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : snapshot.status === 'LOW STOCK'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-rose-50 text-rose-800 border-rose-200';

          return (
            <div
              key={snapshot.item.id}
              onClick={() => setSelectedId(snapshot.item.id)}
              className={`bg-white rounded-2xl border p-4 shadow-2xs transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-emerald-600 ring-2 ring-emerald-600/20 bg-emerald-50/10 shadow-sm'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <div>
                {/* Card Header: Item Name and Status Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-stone-950 truncate">{snapshot.item.name}</h2>
                    <span className="text-[10px] text-stone-400 font-mono block uppercase">{snapshot.item.code}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${statusColor}`}>
                    {snapshot.status}
                  </span>
                </div>

                {/* Main Stock Number */}
                <div className="mt-3">
                  <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">Current Stock</span>
                  <p className="text-2xl font-black tracking-tight text-stone-950 mt-0.5">
                    {formatKg(snapshot.currentStock)}
                  </p>
                </div>

                {/* Stock Valuation */}
                <div className="mt-2.5 p-2 bg-stone-50 rounded-xl border border-stone-100 flex items-center justify-between text-xs">
                  <span className="text-stone-500">Valuation:</span>
                  <div className="text-right">
                    <strong className="text-stone-900 block font-semibold">{formatCurrency(value)}</strong>
                    <span className="text-[10px] text-stone-500 font-mono">@{formatCurrency(rate)}/kg</span>
                  </div>
                </div>
              </div>

              {/* Today Flow Footer */}
              <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between text-[11px]">
                <span className="text-stone-500 flex items-center gap-1">
                  <ArrowDown className="w-3 h-3 text-emerald-600" />
                  In: <strong className="text-emerald-700">+{formatKg(snapshot.todayIn)}</strong>
                </span>
                <span className="text-stone-500 flex items-center gap-1">
                  <ArrowUp className="w-3 h-3 text-rose-600" />
                  Out: <strong className="text-rose-700">-{formatKg(snapshot.todayOut)}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Item Detail & Stock Movements */}
      {selected && (
        <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
          {/* Header of Selected Item */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-stone-950">{selected.item.name}</h2>
                <span className="font-mono text-xs px-2 py-0.5 bg-stone-100 text-stone-600 rounded">
                  {selected.item.code}
                </span>
                <span className="text-xs text-stone-400 capitalize">({selected.item.category.toLowerCase().replace(/_/g, ' ')})</span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Reorder threshold: <strong className="text-stone-700">{formatKg(selected.item.reorderLevel)}</strong> · Valuation Rate:{' '}
                <strong className="text-emerald-800">{formatCurrency(selectedRate)}/kg</strong>
              </p>
            </div>
            {canAdjust && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setIsAdjusting(true);
                  setErrorMessage(null);
                }}
                leftIcon={<Edit3 className="w-3.5 h-3.5" />}
              >
                Adjust Stock
              </Button>
            )}
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/60">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 block">Today In</span>
              <strong className="text-sm font-bold text-emerald-700 block mt-0.5">+{formatKg(selected.todayIn)}</strong>
            </div>
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/60">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 block">Today Out</span>
              <strong className="text-sm font-bold text-rose-700 block mt-0.5">-{formatKg(selected.todayOut)}</strong>
            </div>
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/60">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 block">This Week In</span>
              <strong className="text-sm font-bold text-stone-900 block mt-0.5">+{formatKg(selected.weekIn)}</strong>
            </div>
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/60">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 block">This Week Out</span>
              <strong className="text-sm font-bold text-stone-900 block mt-0.5">-{formatKg(selected.weekOut)}</strong>
            </div>
          </div>

          {/* Movement Audit Trail */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-600">
                <History className="w-4 h-4 text-stone-400" /> Stock Movement History
              </h3>
              <span className="text-[11px] text-stone-400">Latest 30 recorded movements</span>
            </div>

            {movements.length > 0 ? (
              <div className="divide-y divide-stone-100 border border-stone-100 rounded-xl overflow-hidden">
                {movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="p-3 bg-white hover:bg-stone-50/80 transition-colors flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900">{movement.movementType.replace(/_/g, ' ')}</span>
                        {movement.transactionNumber && (
                          <span className="font-mono text-[11px] text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
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
                      {movement.reason && <p className="text-stone-600 text-[11px] italic">"{movement.reason}"</p>}
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono font-bold text-sm inline-flex items-center gap-1 ${
                          movement.direction === ItemDirection.IN ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {movement.direction === ItemDirection.IN ? (
                          <ArrowDown className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUp className="w-3.5 h-3.5" />
                        )}
                        {movement.direction === ItemDirection.IN ? '+' : '-'}
                        {formatKg(movement.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-stone-50 rounded-xl border border-stone-100">
                <Package className="w-8 h-8 text-stone-300 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-stone-600">No stock movements recorded for {selected.item.name}</p>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Transactions involving this item will automatically record movements here.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjusting && selected && (
        <div className="fixed inset-0 z-50 bg-stone-950/40 p-4 flex items-center justify-center backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl space-y-4 border border-stone-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-stone-950">Adjust {selected.item.name} Stock</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Current physical stock: <strong>{formatKg(selected.currentStock)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjusting(false)}
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

            {/* Direction toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 block">Adjustment Direction</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustDirection(ItemDirection.IN)}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    adjustDirection === ItemDirection.IN
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <Plus className="w-4 h-4 text-emerald-600" />
                  Stock In (+ Intake)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustDirection(ItemDirection.OUT)}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    adjustDirection === ItemDirection.OUT
                      ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-2xs'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <ArrowUp className="w-4 h-4 text-rose-600" />
                  Stock Out (- Loss/Damage)
                </button>
              </div>
            </div>

            {/* Quantity Input */}
            <label className="block text-xs font-semibold text-stone-700">
              Quantity to Adjust (kg) *
              <input
                type="number"
                min="0.001"
                step="0.001"
                required
                value={adjustQuantity}
                onChange={(event) => setAdjustQuantity(event.target.value)}
                placeholder="e.g. 50.0"
                className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </label>

            {/* Reason Input */}
            <label className="block text-xs font-semibold text-stone-700">
              Reason / Justification (Audit Log) *
              <input
                value={adjustReason}
                required
                onChange={(event) => setAdjustReason(event.target.value)}
                placeholder="e.g. Physical stock count verification, bag damage..."
                className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </label>

            {/* Projected Stock Preview */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-xs space-y-1">
              <div className="flex justify-between text-stone-500">
                <span>Resulting Stock:</span>
                <strong className="text-stone-900 font-bold">
                  {formatKg(
                    selected.currentStock +
                      (adjustDirection === ItemDirection.IN ? Number(adjustQuantity || 0) : -Number(adjustQuantity || 0))
                  )}
                </strong>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Resulting Value:</span>
                <strong className="text-emerald-800 font-bold">
                  {formatCurrency(
                    Math.max(
                      0,
                      selected.currentStock +
                        (adjustDirection === ItemDirection.IN
                          ? Number(adjustQuantity || 0)
                          : -Number(adjustQuantity || 0))
                    ) * selectedRate
                  )}
                </strong>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-stone-100">
              <Button variant="outline" className="flex-1" onClick={() => setIsAdjusting(false)}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" onClick={handleAdjustment}>
                Confirm Adjustment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
