import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Edit3,
  Phone,
  Plus,
  Search,
  Truck,
  X,
  MapPin,
  FileText,
  BadgeAlert,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../modules/auth';
import { hasPermission, Permission } from '../modules/auth/permissions';
import { RiceTradingService } from '../services/rice-trading.service';
import { dbRepository } from '../db/in-memory-db';
import { Wholesaler, WholesalerStatus } from '../types';

export interface WholesalersViewProps {
  onNavigate: (path: string) => void;
  wholesalerId?: string;
}

export const WholesalersView: React.FC<WholesalersViewProps> = ({ onNavigate, wholesalerId }) => {
  const { user, role } = useAuth();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingWholesaler, setEditingWholesaler] = useState<Wholesaler | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  // Form states
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Subscribe to real-time updates
  useEffect(() => {
    const unsub = dbRepository.subscribe(() => {
      setRefresh((val) => val + 1);
    });
    return unsub;
  }, []);

  const canCreate = hasPermission(role, Permission.CREATE_WHOLESALER);
  const canManage = hasPermission(role, Permission.MANAGE_WHOLESALERS);

  const allWholesalers = useMemo(() => dbRepository.getWholesalers(), [refresh]);
  const wholesaler = wholesalerId ? dbRepository.getWholesalerById(wholesalerId) : undefined;
  const sales = wholesaler ? RiceTradingService.getWholesalerSales(wholesaler.id) : [];

  const filteredWholesalers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allWholesalers;
    return allWholesalers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.wholesalerCode.toLowerCase().includes(q) ||
        (w.companyName && w.companyName.toLowerCase().includes(q)) ||
        (w.phone && w.phone.includes(q))
    );
  }, [allWholesalers, search]);

  const openAddModal = () => {
    setEditingWholesaler(null);
    setName('');
    setCompany('');
    setPhone('');
    setAddress('');
    setNotes('');
    setErrorMessage(null);
    setShowForm(true);
  };

  const openEditModal = (w: Wholesaler) => {
    setEditingWholesaler(w);
    setName(w.name);
    setCompany(w.companyName || '');
    setPhone(w.phone || '');
    setAddress(w.address || '');
    setNotes(w.notes || '');
    setErrorMessage(null);
    setShowForm(true);
  };

  const save = () => {
    if (!user) return;
    setErrorMessage(null);
    if (!name.trim()) {
      setErrorMessage('Wholesaler name is required.');
      return;
    }

    try {
      if (editingWholesaler) {
        RiceTradingService.updateWholesaler(
          editingWholesaler.id,
          {
            name: name.trim(),
            companyName: company.trim() || undefined,
            phone: phone.trim() || undefined,
            address: address.trim() || undefined,
            notes: notes.trim() || undefined,
          },
          user
        );
        setMessage(`Wholesaler ${name} updated successfully.`);
      } else {
        const created = RiceTradingService.createWholesaler(
          {
            name: name.trim(),
            companyName: company.trim() || undefined,
            phone: phone.trim() || undefined,
            address: address.trim() || undefined,
            notes: notes.trim() || undefined,
          },
          user
        );
        setMessage(`${created.name} registered as ${created.wholesalerCode}.`);
      }
      setShowForm(false);
      setRefresh((val) => val + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save wholesaler.');
    }
  };

  const toggleStatus = (w: Wholesaler) => {
    if (!user) return;
    const newStatus = w.status === WholesalerStatus.ACTIVE ? WholesalerStatus.INACTIVE : WholesalerStatus.ACTIVE;
    try {
      RiceTradingService.updateWholesaler(w.id, { status: newStatus }, user);
      setMessage(`Wholesaler marked as ${newStatus}.`);
      setRefresh((val) => val + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update status.');
    }
  };

  // Single Wholesaler Detail View
  if (wholesaler) {
    const totalPurchasedKg = sales.reduce((sum, sale) => sum + sale.quantity, 0);
    const totalSalesValue = sales.reduce((sum, sale) => sum + sale.saleValue, 0);
    const totalOutstanding = sales.reduce((sum, sale) => sum + sale.amountDue, 0);

    return (
      <div className="space-y-4 font-sans pb-12 max-w-4xl mx-auto px-1 sm:px-0">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate('/app/wholesalers')}
            className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1.5 py-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> All Wholesalers
          </button>
          <div className="flex items-center gap-2">
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openEditModal(wholesaler)}
                leftIcon={<Edit3 className="w-3.5 h-3.5" />}
              >
                Edit
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              onClick={() => onNavigate('/app/rice-trading')}
              leftIcon={<Truck className="w-3.5 h-3.5" />}
            >
              New Wholesale Dispatch
            </Button>
          </div>
        </div>

        {/* Wholesaler Header Card */}
        <section className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-800 text-white flex items-center justify-center font-bold text-lg shadow-2xs shrink-0">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-stone-950">{wholesaler.name}</h1>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      wholesaler.status === WholesalerStatus.ACTIVE
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-stone-100 text-stone-600 border-stone-200'
                    }`}
                  >
                    {wholesaler.status}
                  </span>
                </div>
                <p className="font-mono text-xs text-stone-500 mt-0.5">{wholesaler.wholesalerCode}</p>
              </div>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => toggleStatus(wholesaler)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                  wholesaler.status === WholesalerStatus.ACTIVE
                    ? 'border-amber-200 text-amber-800 hover:bg-amber-50'
                    : 'border-emerald-200 text-emerald-800 hover:bg-emerald-50'
                }`}
              >
                {wholesaler.status === WholesalerStatus.ACTIVE ? 'Mark Inactive' : 'Activate Wholesaler'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Company / Business</span>
              <strong className="text-stone-900 text-sm block mt-0.5">{wholesaler.companyName || 'Individual Trader'}</strong>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Phone</span>
              <strong className="text-stone-900 text-sm block mt-0.5">{wholesaler.phone || 'Not recorded'}</strong>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Address</span>
              <strong className="text-stone-900 text-sm block mt-0.5">{wholesaler.address || 'Local Mandi'}</strong>
            </div>
          </div>

          {/* Trade Summary Strip */}
          <div className="grid grid-cols-3 gap-3 pt-2 text-center">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/60">
              <span className="text-[10px] uppercase font-semibold text-stone-500 block">Total Rice Lifted</span>
              <p className="text-base font-bold text-stone-900 mt-0.5">
                {totalPurchasedKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg
              </p>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/60">
              <span className="text-[10px] uppercase font-semibold text-stone-500 block">Total Business</span>
              <p className="text-base font-bold text-stone-900 mt-0.5">₹{totalSalesValue.toLocaleString('en-IN')}</p>
            </div>
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
              <span className="text-[10px] uppercase font-semibold text-rose-700 block">Outstanding Khata</span>
              <p className="text-base font-bold text-rose-800 mt-0.5">₹{totalOutstanding.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </section>

        {/* Sales History */}
        <section className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between">
            <h2 className="font-bold text-sm text-stone-900">Wholesale Rice Dispatches</h2>
            <span className="text-xs text-stone-400">{sales.length} transactions</span>
          </div>
          {sales.length ? (
            <div className="divide-y divide-stone-100">
              {sales.map((sale) => (
                <div
                  key={sale.transaction.id}
                  className="p-4 hover:bg-stone-50/80 transition-colors flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-stone-900">{sale.transaction.transactionNumber}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                          sale.amountDue === 0
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {sale.amountDue === 0 ? 'Fully Paid' : `Due: ₹${sale.amountDue.toLocaleString('en-IN')}`}
                      </span>
                    </div>
                    <p className="text-stone-500 text-[11px]">
                      {new Date(sale.transaction.date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}{' '}
                      · {sale.quantity} kg @ ₹{sale.sellingRate}/kg
                    </p>
                  </div>
                  <div className="text-right">
                    <strong className="text-sm font-bold text-stone-950 block">₹{sale.saleValue.toLocaleString('en-IN')}</strong>
                    <span className="text-[11px] text-stone-500">Paid: ₹{sale.amountPaid.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-stone-500 text-xs">
              No wholesale dispatches recorded yet for this buyer.
            </div>
          )}
        </section>
      </div>
    );
  }

  // List of All Wholesalers View
  return (
    <div className="space-y-4 font-sans pb-12 max-w-4xl mx-auto px-1 sm:px-0">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onNavigate('/app/more')}
          className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1.5 py-1 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> More
        </button>
        {canCreate && (
          <Button size="sm" variant="primary" onClick={openAddModal} leftIcon={<Plus className="w-4 h-4" />}>
            Add Wholesaler
          </Button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-800 text-white flex items-center justify-center shadow-2xs shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-950 tracking-tight">Wholesalers & Mandi Buyers</h1>
            <p className="text-xs text-stone-500 mt-0.5">Bulk buyers for ration rice collected from customers</p>
          </div>
        </div>
      </div>

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

      {/* Search Input */}
      <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2.5 shadow-2xs">
        <Search className="w-4 h-4 text-stone-400 shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, mobile or code..."
          className="w-full text-xs text-stone-900 outline-none bg-transparent"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="text-stone-400 hover:text-stone-700">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Wholesaler Cards */}
      <div className="space-y-2.5">
        {filteredWholesalers.map((item) => {
          const itemSales = RiceTradingService.getWholesalerSales(item.id);
          const totalOut = itemSales.reduce((sum, s) => sum + s.amountDue, 0);

          return (
            <div
              key={item.id}
              onClick={() => onNavigate(`/app/wholesalers/${item.id}`)}
              className="w-full text-left bg-white border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-500 hover:shadow-2xs transition-all cursor-pointer"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-stone-950">{item.name}</p>
                  <span className="font-mono text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.2 rounded">
                    {item.wholesalerCode}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      item.status === WholesalerStatus.ACTIVE
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-stone-100 text-stone-600 border-stone-200'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="text-xs text-stone-500 flex items-center gap-2 flex-wrap">
                  {item.companyName && <span className="font-medium text-stone-700">{item.companyName}</span>}
                  {item.phone && <span>· 📞 {item.phone}</span>}
                  {item.address && <span>· 📍 {item.address}</span>}
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                <div className="text-left sm:text-right">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">Pending Due</span>
                  <strong className={`text-sm ${totalOut > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    ₹{totalOut.toLocaleString('en-IN')}
                  </strong>
                </div>
                <span className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200/60 shrink-0">
                  View Khata →
                </span>
              </div>
            </div>
          );
        })}

        {filteredWholesalers.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs">
            No wholesalers found matching "{search}".
          </div>
        )}
      </div>

      {/* Add / Edit Wholesaler Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-stone-950/40 p-4 flex items-center justify-center backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-4 border border-stone-200 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-base text-stone-950">
                  {editingWholesaler ? 'Edit Wholesaler' : 'Register New Wholesaler'}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">Bulk buyer details for rice sales</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-700 p-1">
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
                Trader / Contact Name *
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs font-normal focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </label>
              <label className="block">
                Company / Agency Name
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Kisan Rice Traders"
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs font-normal focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </label>
              <label className="block">
                Mobile / Phone Number
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs font-normal focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </label>
              <label className="block">
                Address / Mandi Location
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Anaaj Mandi, Shop #12"
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs font-normal focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </label>
            </div>

            <div className="flex gap-2 pt-2 border-t border-stone-100">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" onClick={save}>
                {editingWholesaler ? 'Save Changes' : 'Register Wholesaler'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
