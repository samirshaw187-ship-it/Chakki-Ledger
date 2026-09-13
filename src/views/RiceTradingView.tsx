import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Plus, Search, ShoppingBag, Truck, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../modules/auth';
import { hasPermission, Permission } from '../modules/auth/permissions';
import { InventoryItemCode, UserRole } from '../types';
import { InventoryService } from '../services/inventory.service';
import { RiceTradingService } from '../services/rice-trading.service';
import { RiceProfitService } from '../services/rice-profit.service';

export interface RiceTradingViewProps { onNavigate: (path: string) => void; }
const kg = (value: number) => `${value.toLocaleString('en-IN', { maximumFractionDigits: 3 })} kg`;
const money = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const [refresh, setRefresh] = useState(0);
  const riceItem = InventoryService.getItemById(InventoryItemCode.RICE);
  const snapshot = InventoryService.getInventorySummary().find((item) => item.item.code === InventoryItemCode.RICE);
  const purchases = useMemo(() => RiceTradingService.getRicePurchases().filter((purchase) => !search || [purchase.transaction?.customerName, purchase.transaction?.customerCode, purchase.transaction?.transactionNumber].some((value) => value?.toLowerCase().includes(search.toLowerCase()))), [search, refresh]);
  const sales = useMemo(() => RiceTradingService.getWholesaleSales(), [refresh]);
  const profitSummary = useMemo(() => RiceProfitService.getRiceProfitSummary(), [refresh]);
  const wholesalers = useMemo(() => RiceTradingService.getWholesalers(), [refresh]);
  const saleValue = Math.round((Number(quantity) || 0) * (Number(rate) || 0) * 100) / 100;
  const paidValue = Math.min(Number(paid) || 0, saleValue);
  const canCreate = hasPermission(role, Permission.CREATE_WHOLESALE_SALE);

  const submitSale = async () => {
    if (!user) return;
    try {
      const sale = await RiceTradingService.createWholesaleSale({ wholesalerId, quantity: Number(quantity), sellingRate: Number(rate), amountPaid: Number(paid || 0), rateOverrideReason: reason }, user);
      setMessage(`${sale.transaction?.transactionNumber || 'Sale'} saved. ${kg(sale.quantity)} rice removed from stock.`);
      setShowSale(false); setQuantity(''); setPaid(''); setReason(''); setRefresh((value) => value + 1);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save wholesale sale.'); }
  };

  return <div className="space-y-4 font-sans pb-10 max-w-6xl mx-auto">
    <div className="flex items-center justify-between"><button type="button" onClick={() => onNavigate('/app/more')} className="text-xs font-semibold text-stone-600 flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> Back</button><Truck className="w-6 h-6 text-emerald-700" /></div>
    {message && <div className="flex justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><span className="flex gap-2"><CheckCircle2 className="w-4 h-4" />{message}</span><button type="button" onClick={() => setMessage(null)}><X className="w-4 h-4" /></button></div>}
    <div className="flex items-start justify-between gap-3"><div><h1 className="text-xl sm:text-2xl font-bold text-stone-950">Rice Trading</h1><p className="text-xs text-stone-500 mt-1">Customer procurement, rice stock, and wholesale dispatch.</p></div>{canCreate && <Button size="sm" variant="primary" onClick={() => setShowSale(true)} leftIcon={<Plus className="w-4 h-4" />}>New Rice Sale</Button>}</div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Metric label="Today's Purchased" value={kg(purchases.filter((purchase) => purchase.transaction?.date && new Date(purchase.transaction.date).toDateString() === new Date().toDateString()).reduce((sum, purchase) => sum + purchase.quantity, 0))} /><Metric label="Today's Sold" value={kg(sales.filter((sale) => sale.transaction?.date && new Date(sale.transaction.date).toDateString() === new Date().toDateString()).reduce((sum, sale) => sum + sale.quantity, 0))} /><Metric label="Current Rice Stock" value={kg(snapshot?.currentStock || 0)} /><Metric label="Receivables" value={money(sales.reduce((sum, sale) => sum + sale.amountDue, 0))} /></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Metric label="Revenue" value={money(profitSummary.revenue)} /><Metric label="Cost of Rice Sold" value={money(profitSummary.cogs)} /><Metric label={profitSummary.grossProfit >= 0 ? 'Gross Profit' : 'Gross Loss'} value={money(Math.abs(profitSummary.grossProfit))} /><Metric label="Gross Margin" value={`${profitSummary.grossMargin.toFixed(2)}%`} /></div>
    <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2"><Search className="w-4 h-4 text-stone-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer or transaction" className="w-full text-xs outline-none" /></div>
    <div className="grid lg:grid-cols-2 gap-4"><section className="bg-white border border-stone-200 rounded-2xl overflow-hidden"><div className="p-4 border-b border-stone-100 flex justify-between"><h2 className="font-bold text-sm">Recent Rice Purchases</h2><ShoppingBag className="w-4 h-4 text-emerald-700" /></div>{purchases.slice(0, 12).map((purchase) => <div key={purchase.transaction?.id || Math.random()} className="p-3 border-b border-stone-100 text-xs flex justify-between gap-3"><div><p className="font-semibold">{purchase.transaction?.customerName || 'Customer'}</p><p className="text-stone-500">{purchase.transaction?.transactionNumber || 'TXN'} · {purchase.transaction?.date ? new Date(purchase.transaction.date).toLocaleDateString('en-IN') : ''}</p></div><div className="text-right"><p className="font-bold">{kg(purchase.quantity)}</p><p className="text-stone-500">{money(purchase.purchaseRate)}/kg · {money(purchase.totalValue)}</p></div></div>)}</section><section className="bg-white border border-stone-200 rounded-2xl overflow-hidden"><div className="p-4 border-b border-stone-100 flex justify-between"><h2 className="font-bold text-sm">Wholesale Sales</h2><Truck className="w-4 h-4 text-sky-700" /></div>{sales.slice(0, 12).map((sale) => <div key={sale.transaction?.id || Math.random()} className="p-3 border-b border-stone-100 text-xs flex justify-between gap-3"><div><p className="font-semibold">{sale.wholesaler?.name || 'Wholesaler'}</p><p className="text-stone-500">{sale.transaction?.transactionNumber || 'TXN'} · {sale.transaction?.paymentStatus || 'RECORDED'}</p></div><div className="text-right"><p className="font-bold">{kg(sale.quantity)}</p><p className="text-stone-500">{money(sale.sellingRate)}/kg · {money(sale.saleValue)}</p></div></div>)}</section></div>
    {showSale && <div className="fixed inset-0 z-50 bg-stone-950/30 p-4 flex items-center justify-center"><div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-4"><div className="flex justify-between"><div><h2 className="font-bold">New Rice Sale</h2><p className="text-xs text-stone-500">Available: {kg(snapshot?.currentStock || 0)}</p></div><button type="button" onClick={() => setShowSale(false)}><X className="w-5 h-5" /></button></div><label className="block text-xs font-semibold">Wholesaler<select value={wholesalerId} onChange={(event) => setWholesalerId(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5"><option value="">Select wholesaler</option>{wholesalers.map((wholesaler) => <option key={wholesaler.id} value={wholesaler.id}>{wholesaler.name} · {wholesaler.wholesalerCode}</option>)}</select></label><label className="block text-xs font-semibold">Rice quantity (kg)<input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><label className="block text-xs font-semibold">Wholesale selling rate<input type="number" min="0.01" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><div className="rounded-lg bg-stone-50 p-3 text-sm flex justify-between"><span>Sale value</span><strong>{money(saleValue)}</strong></div><label className="block text-xs font-semibold">Amount paid<input type="number" min="0" step="0.01" max={saleValue} value={paid} onChange={(event) => setPaid(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><p className="text-xs text-stone-500">Remaining due: <strong>{money(Math.max(0, saleValue - paidValue))}</strong></p><label className="block text-xs font-semibold">Rate override reason (optional)<input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" placeholder="Negotiated bulk rate" /></label><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setShowSale(false)}>Cancel</Button><Button variant="primary" className="flex-1" onClick={submitSale}>Confirm Sale</Button></div></div></div>}
  </div>;
};

const Metric = ({ label, value }: { label: string; value: string }) => <div className="bg-white border border-stone-200 rounded-xl p-3"><span className="block text-[10px] uppercase tracking-wide text-stone-500">{label}</span><strong className="block text-lg font-black mt-1">{value}</strong></div>;