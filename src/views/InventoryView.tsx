import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Boxes, CheckCircle2, Edit3, History, Plus, X } from 'lucide-react';
import { useAuth } from '../modules/auth';
import { hasPermission, Permission } from '../modules/auth/permissions';
import { InventoryService } from '../services/inventory.service';
import { InventoryItemCode, ItemDirection, UserRole } from '../types';
import { Button } from '../components/ui/Button';

export interface InventoryViewProps {
  onNavigate: (path: string) => void;
}

const formatKg = (value: number) => `${value.toLocaleString('en-IN', { maximumFractionDigits: 3 })} kg`;

export const InventoryView: React.FC<InventoryViewProps> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustDirection, setAdjustDirection] = useState<ItemDirection>(ItemDirection.OUT);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const summary = useMemo(() => InventoryService.getInventorySummary(), [refresh]);
  const visibleSummary = summary.filter((snapshot) => filter === 'ALL' || (filter === 'LOW' && snapshot.status === 'LOW STOCK') || (filter === 'OUT' && snapshot.status === 'OUT OF STOCK'));
  const selected = summary.find((snapshot) => snapshot.item.id === selectedId);
  const movements = selected ? InventoryService.getStockMovementHistory(selected.item.id).slice(0, 20) : [];
  const canAdjust = hasPermission(role, Permission.ADJUST_INVENTORY);

  const handleAdjustment = () => {
    if (!selected || !user) return;
    try {
      InventoryService.createInventoryAdjustment({ itemId: selected.item.id, quantity: Number(adjustQuantity), direction: adjustDirection, reason: adjustReason }, user);
      setMessage('Stock adjustment recorded and added to the audit trail.');
      setAdjustQuantity('');
      setAdjustReason('');
      setIsAdjusting(false);
      setRefresh((value) => value + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to adjust stock.');
    }
  };

  return (
    <div className="space-y-4 font-sans pb-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => onNavigate('/app/more')} className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 py-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-[10px] uppercase tracking-wider text-stone-400">Transaction-driven stock</span>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl sm:text-2xl font-bold text-stone-950">Inventory</h1><p className="text-xs text-stone-500 mt-1">Current physical stock from recorded movements.</p></div>
        <Boxes className="w-7 h-7 text-emerald-700" />
      </div>

      {message && <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><span className="flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />{message}</span><button type="button" onClick={() => setMessage(null)}><X className="w-4 h-4" /></button></div>}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['ALL', 'LOW', 'OUT'] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border ${filter === value ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200'}`}>{value === 'ALL' ? 'All Items' : value === 'LOW' ? 'Low Stock' : 'Out of Stock'}</button>)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {visibleSummary.map((snapshot) => <button key={snapshot.item.id} type="button" onClick={() => setSelectedId(snapshot.item.id)} className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition hover:border-emerald-400 ${selectedId === snapshot.item.id ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-stone-200'}`}>
          <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-stone-900">{snapshot.item.name}</span><span className={`text-[10px] font-bold ${snapshot.status === 'IN STOCK' ? 'text-emerald-700' : snapshot.status === 'LOW STOCK' ? 'text-amber-700' : 'text-rose-700'}`}>{snapshot.status}</span></div>
          <p className="text-2xl font-black tracking-tight text-stone-950 mt-3">{formatKg(snapshot.currentStock)}</p>
          <p className="text-[11px] text-stone-500 mt-1">Reorder level: {formatKg(snapshot.item.reorderLevel)}</p>
          <div className="mt-3 flex justify-between text-[11px] text-stone-500"><span>Today in <strong className="text-emerald-700">+{formatKg(snapshot.todayIn)}</strong></span><span>Out <strong className="text-rose-700">-{formatKg(snapshot.todayOut)}</strong></span></div>
        </button>)}
      </div>

      {selected && <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-lg font-bold text-stone-950">{selected.item.name}</h2><span className="font-mono text-[10px] text-stone-500">{selected.item.code}</span></div><p className="text-xs text-stone-500 mt-1">Current stock: <strong className="text-stone-900">{formatKg(selected.currentStock)}</strong> · Reorder level: {formatKg(selected.item.reorderLevel)}</p></div>{canAdjust && <Button size="sm" variant="outline" onClick={() => setIsAdjusting(true)} leftIcon={<Edit3 className="w-3.5 h-3.5" />}>Adjust Stock</Button>}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs"><div className="bg-stone-50 rounded-lg p-3"><span className="text-stone-500 block">Today In</span><strong className="text-emerald-700">+{formatKg(selected.todayIn)}</strong></div><div className="bg-stone-50 rounded-lg p-3"><span className="text-stone-500 block">Today Out</span><strong className="text-rose-700">-{formatKg(selected.todayOut)}</strong></div><div className="bg-stone-50 rounded-lg p-3"><span className="text-stone-500 block">This Week In</span><strong>+{formatKg(selected.weekIn)}</strong></div><div className="bg-stone-50 rounded-lg p-3"><span className="text-stone-500 block">This Week Out</span><strong>-{formatKg(selected.weekOut)}</strong></div></div>
        <div><h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500 mb-2"><History className="w-4 h-4" /> Recent Movements</h3>{movements.length ? <div className="divide-y divide-stone-100">{movements.map((movement) => <div key={movement.id} className="py-3 flex items-start justify-between gap-3 text-xs"><div><p className="font-semibold text-stone-900">{movement.movementType.replace(/_/g, ' ')}</p><p className="text-stone-500">{new Date(movement.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {new Date(movement.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>{movement.transactionNumber && <p className="font-mono text-stone-600 mt-0.5">{movement.transactionNumber}</p>}{movement.reason && <p className="text-stone-400 mt-0.5">{movement.reason}</p>}</div><span className={`font-mono font-bold flex items-center gap-1 ${movement.direction === ItemDirection.IN ? 'text-emerald-700' : 'text-rose-700'}`}>{movement.direction === ItemDirection.IN ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}{movement.direction === ItemDirection.IN ? '+' : '-'}{formatKg(movement.quantity)}</span></div>)}</div> : <p className="text-xs text-stone-500 py-4">No movements recorded.</p>}</div>
      </section>}

      {isAdjusting && selected && <div className="fixed inset-0 z-50 bg-stone-950/30 p-4 flex items-center justify-center"><div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl space-y-4"><div className="flex justify-between"><div><h2 className="text-base font-bold">Adjust {selected.item.name}</h2><p className="text-xs text-stone-500">Current stock: {formatKg(selected.currentStock)}</p></div><button type="button" onClick={() => setIsAdjusting(false)}><X className="w-5 h-5" /></button></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setAdjustDirection(ItemDirection.IN)} className={`p-2 rounded-lg border text-xs font-semibold ${adjustDirection === ItemDirection.IN ? 'bg-emerald-50 border-emerald-400 text-emerald-800' : 'border-stone-200'}`}><Plus className="w-4 h-4 inline mr-1" />Stock In</button><button type="button" onClick={() => setAdjustDirection(ItemDirection.OUT)} className={`p-2 rounded-lg border text-xs font-semibold ${adjustDirection === ItemDirection.OUT ? 'bg-rose-50 border-rose-400 text-rose-800' : 'border-stone-200'}`}><ArrowUp className="w-4 h-4 inline mr-1" />Stock Out</button></div><label className="block text-xs font-semibold">Quantity (kg)<input type="number" min="0.001" step="0.001" value={adjustQuantity} onChange={(event) => setAdjustQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><label className="block text-xs font-semibold">Reason<input value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} placeholder="Physical stock count" className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><p className="text-xs text-stone-500">New stock: <strong>{formatKg(selected.currentStock + (adjustDirection === ItemDirection.IN ? Number(adjustQuantity || 0) : -Number(adjustQuantity || 0)))}</strong></p><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setIsAdjusting(false)}>Cancel</Button><Button variant="primary" className="flex-1" onClick={handleAdjustment}>Confirm Adjustment</Button></div></div></div>}
    </div>
  );
};
