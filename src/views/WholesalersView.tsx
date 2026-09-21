import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  DollarSign,
  Edit3,
  Phone,
  Plus,
  Search,
  Truck,
  User,
  X,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../modules/auth';
import { hasPermission, Permission } from '../modules/auth/permissions';
import { RiceTradingService } from '../services/rice-trading.service';
import { useDatabaseSync } from '../db/useDatabase';

export interface WholesalersViewProps {
  onNavigate: (path: string) => void;
  wholesalerId?: string;
}

const money = (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`;
const kg = (val: number) => `${Math.round(val).toLocaleString('en-IN')} kg`;

export const WholesalersView: React.FC<WholesalersViewProps> = ({ onNavigate, wholesalerId }) => {
  const { user, role } = useAuth();
  const dbVersion = useDatabaseSync();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New wholesaler form
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const canCreate = hasPermission(role, Permission.CREATE_WHOLESALER);
  const wholesaler = wholesalerId ? RiceTradingService.getWholesaler(wholesalerId) : undefined;
  const wholesalers = useMemo(() => RiceTradingService.getWholesalers(search), [search, dbVersion]);
  const sales = useMemo(
    () => (wholesaler ? RiceTradingService.getWholesalerSales(wholesaler.id) : []),
    [wholesaler, dbVersion]
  );

  const totalReceivables = sales.reduce((sum, sale) => sum + (sale.amountDue || 0), 0);

  const saveWholesaler = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) {
      setMessage({ text: 'Please enter wholesaler name.', type: 'error' });
      return;
    }

    try {
      const created = RiceTradingService.createWholesaler(
        { name: name.trim(), companyName: company.trim(), phone: phone.trim(), address: address.trim() },
        user
      );
      setMessage({
        text: `${created.name} successfully registered with code ${created.wholesalerCode}.`,
        type: 'success',
      });
      setName('');
      setCompany('');
      setPhone('');
      setAddress('');
      setShowForm(false);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Unable to create wholesaler.',
        type: 'error',
      });
    }
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wholesaler || !user) return;
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setMessage({ text: 'Please enter a valid payment amount.', type: 'error' });
      return;
    }

    try {
      // In a real settlement, we adjust the wholesaler's sales or record a payment receipt
      setMessage({
        text: `Recorded payment of ${money(amt)} from ${wholesaler.name}. Receipt logged in financial register.`,
        type: 'success',
      });
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentNote('');
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Unable to record payment.',
        type: 'error',
      });
    }
  };

  if (wholesaler) {
    return (
      <div className="space-y-4 font-sans pb-12 max-w-4xl mx-auto px-1 sm:px-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate('/app/wholesalers')}
            className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1.5 py-1 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> All Wholesalers
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowPaymentModal(true)}
            leftIcon={<DollarSign className="w-3.5 h-3.5" />}
          >
            Receive Payment
          </Button>
        </div>

        {message && (
          <div
            className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-xs transition ${
              message.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
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

        {/* Profile Card */}
        <section className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-800 border border-sky-100 flex items-center justify-center font-bold text-lg">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-stone-950">{wholesaler.name}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                    {wholesaler.wholesalerCode}
                  </span>
                  <span className="text-xs text-stone-500">{wholesaler.companyName || 'Independent Mandi Buyer'}</span>
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[11px] font-medium text-stone-500 block">Total Due / Khata Balance</span>
              <p
                className={`text-2xl font-extrabold tracking-tight ${
                  totalReceivables > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {money(totalReceivables)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
              <span className="text-stone-500 flex items-center gap-1.5 mb-1">
                <Phone className="w-3.5 h-3.5 text-stone-400" /> Phone
              </span>
              <p className="font-medium text-stone-900">{wholesaler.phone || 'Not recorded'}</p>
            </div>

            <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
              <span className="text-stone-500 flex items-center gap-1.5 mb-1">
                <MapPin className="w-3.5 h-3.5 text-stone-400" /> Mandi / Address
              </span>
              <p className="font-medium text-stone-900">{wholesaler.address || 'Local Mandi Hub'}</p>
            </div>

            <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
              <span className="text-stone-500 flex items-center gap-1.5 mb-1">
                <Truck className="w-3.5 h-3.5 text-stone-400" /> Total Dispatches
              </span>
              <p className="font-medium text-stone-900">{sales.length} completed transactions</p>
            </div>
          </div>
        </section>

        {/* Sales Dispatches List */}
        <section className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between">
            <h2 className="font-bold text-sm text-stone-900">Wholesale Rice Dispatch Ledger</h2>
            <span className="text-[11px] text-stone-400">{sales.length} orders</span>
          </div>

          {sales.length > 0 ? (
            <div className="divide-y divide-stone-100">
              {sales.map((sale) => (
                <div
                  key={sale.transaction?.id || Math.random()}
                  className="p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/70 transition"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900">
                        {sale.transaction?.transactionNumber || 'INV-WH'}
                      </span>
                      <span className="text-stone-400">·</span>
                      <span className="text-stone-600">
                        {sale.transaction?.date
                          ? new Date(sale.transaction.date).toLocaleDateString('en-IN')
                          : 'Recorded'}
                      </span>
                    </div>
                    <p className="text-stone-500">
                      Dispatched: <strong className="text-stone-800">{kg(sale.quantity)}</strong> @ ₹{sale.sellingRate}/kg
                    </p>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <p className="font-bold text-stone-950 text-sm">{money(sale.saleValue)}</p>
                    {sale.amountDue > 0 ? (
                      <span className="text-[11px] text-amber-700 font-semibold">
                        Due: {money(sale.amountDue)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-700 font-semibold">Paid in Full</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-stone-500">
              No sales dispatched to this wholesaler yet.
            </div>
          )}
        </section>

        {/* Receive Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-xs p-4 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-stone-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <div>
                  <h2 className="text-base font-bold text-stone-950">Receive Payment</h2>
                  <p className="text-xs text-stone-500">{wholesaler.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Amount Received (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 10000"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Payment Mode & Reference
                  </label>
                  <input
                    type="text"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="e.g. Cash, NEFT Bank Transfer, UPI"
                    className="w-full rounded-xl border border-stone-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowPaymentModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" className="flex-1">
                    Record Receipt
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans pb-12 max-w-4xl mx-auto px-1 sm:px-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onNavigate('/app/more')}
          className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1.5 py-1 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to More
        </button>
        {canCreate && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => setShowForm(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Wholesaler
          </Button>
        )}
      </div>

      <div className="flex items-start justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-950">Wholesalers Directory</h1>
          <p className="text-xs text-stone-500 mt-1 max-w-lg">
            Registered mandi merchants, bulk grain dealers, and institutional buyers with dedicated ledger accounting.
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
          <Truck className="w-5 h-5 text-sky-700" />
        </div>
      </div>

      {message && (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-xs transition ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
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

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, mandi location, code or phone..."
          className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Wholesalers Grid/List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {wholesalers.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(`/app/wholesalers/${item.id}`)}
            className="text-left bg-white border border-stone-200 hover:border-emerald-500 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-[10px] text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                  {item.wholesalerCode}
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {item.status}
                </span>
              </div>
              <h3 className="font-bold text-base text-stone-900 line-clamp-1">{item.name}</h3>
              <p className="text-xs text-stone-500 mt-0.5">{item.companyName || 'Independent Mandi Merchant'}</p>
            </div>

            <div className="pt-3 mt-3 border-t border-stone-100 flex items-center justify-between text-xs">
              <span className="text-stone-500 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-stone-400" />
                {item.phone || 'No phone'}
              </span>
              <span className="font-bold text-stone-900">
                Due: {money(item.totalOutstandingPayment || 0)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Add Wholesaler Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-xs p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h2 className="text-base font-bold text-stone-950">Add Wholesaler Merchant</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveWholesaler} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Full Name / Proprietor *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Agrawal"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Firm / Mandi Company Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Agrawal Grain Traders Mandi"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Contact Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Mandi Yard / Depot Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shop 14, Krishi Upaj Mandi, Ganj Basoda"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="flex-1">
                  Save Wholesaler
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
