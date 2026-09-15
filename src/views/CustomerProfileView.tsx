import React, { useState } from 'react';
import { CustomerService } from '../services/customer.service';
import { LedgerService } from '../services/ledger.service';
import { dbRepository } from '../db/in-memory-db';
import { Customer, CustomerStatus, Payment, PaymentType, UserRole } from '../types';
import { useAuth } from '../modules/auth';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { LedgerTimelineItem } from '../components/domain/LedgerTimelineItem';
import { PaymentModal } from '../components/domain/PaymentModal';
import { formatRupees, formatDate } from '../utils/precision';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Edit2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Wheat,
  Scale,
  CreditCard,
  Receipt,
  Layers,
  FileSpreadsheet,
  Banknote,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

export interface CustomerProfileViewProps {
  customerId: string;
  onNavigate: (path: string) => void;
}

export const CustomerProfileView: React.FC<CustomerProfileViewProps> = ({
  customerId,
  onNavigate,
}) => {
  const { user, role } = useAuth();

  // Load customer by ID or customer code
  const [customer, setCustomer] = useState<Customer | undefined>(() =>
    CustomerService.getCustomerById(customerId)
  );

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentModalAction, setPaymentModalAction] = useState<PaymentType>(PaymentType.RECEIVE_PAYMENT);
  const [activeProfileTab, setActiveProfileTab] = useState<'ACTIVITY' | 'PAYMENTS'>('ACTIVITY');
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Keep customer data synchronized upon payment or updates
  React.useEffect(() => {
    setCustomer(CustomerService.getCustomerById(customerId));
  }, [customerId, refreshCounter]);

  // Edit Form State
  const [editName, setEditName] = useState(customer?.name || '');
  const [editPhone, setEditPhone] = useState(customer?.phone || '');
  const [editAltPhone, setEditAltPhone] = useState(customer?.alternatePhone || '');
  const [editAddress, setEditAddress] = useState(customer?.address || customer?.villageOrArea || '');
  const [editNotes, setEditNotes] = useState(customer?.notes || '');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Action status message
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Role permissions
  const isOwner = role === UserRole.OWNER;
  const isAdmin = role === UserRole.ADMIN;
  const canEdit = isOwner || isAdmin;
  const canToggleStatus = isOwner || isAdmin;

  if (!customer) {
    return (
      <div className="space-y-4 font-sans max-w-lg mx-auto p-4 text-center">
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
          <h2 className="text-lg font-bold text-stone-900">Customer Not Found</h2>
          <p className="text-xs text-stone-600">
            No customer was found matching the identifier "{customerId}".
          </p>
          <div className="pt-2">
            <Button variant="primary" size="sm" onClick={() => onNavigate('/app/customers')}>
              Back to Customers
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Derive live ledger balances and timeline from LedgerService (strictly transaction-based)
  const balances = LedgerService.getCustomerBalance(customer.id);
  const timelineResult = LedgerService.getCustomerLedger(customer.id, { limit: 15 });
  const customerPayments = dbRepository
    .getPayments()
    .filter((p) => p.customerId === customer.id)
    .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

  const isInactive = customer.status === CustomerStatus.INACTIVE || customer.isActive === false;
  const displayCode = customer.customerCode || customer.id;

  // Open Edit Modal with current values
  const handleOpenEdit = () => {
    setEditName(customer.name);
    setEditPhone(customer.phone || '');
    setEditAltPhone(customer.alternatePhone || '');
    setEditAddress(customer.address || customer.villageOrArea || '');
    setEditNotes(customer.notes || '');
    setEditError(null);
    setIsEditModalOpen(true);
  };

  // Submit Edit Form
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    if (!user) return;

    setIsSaving(true);
    try {
      const updated = CustomerService.updateCustomer(
        customer.id,
        {
          name: editName,
          phone: editPhone,
          alternatePhone: editAltPhone,
          address: editAddress,
          notes: editNotes,
        },
        {
          id: user.id,
          name: user.name,
          role: role || UserRole.ADMIN,
        }
      );

      setCustomer(updated);
      setIsEditModalOpen(false);
      setActionSuccessMessage('Customer details updated successfully.');
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update customer details.');
    } finally {
      setIsSaving(false);
    }
  };

  // Deactivate Customer
  const handleConfirmDeactivate = () => {
    if (!user) return;
    try {
      const updated = CustomerService.setCustomerStatus(
        customer.id,
        CustomerStatus.INACTIVE,
        {
          id: user.id,
          name: user.name,
          role: role || UserRole.OWNER,
        },
        `Customer deactivated by ${user.name}`
      );
      setCustomer(updated);
      setIsDeactivateModalOpen(false);
      setActionSuccessMessage(`${customer.name} has been deactivated.`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Activate Customer
  const handleConfirmActivate = () => {
    if (!user) return;
    try {
      const updated = CustomerService.setCustomerStatus(
        customer.id,
        CustomerStatus.ACTIVE,
        {
          id: user.id,
          name: user.name,
          role: role || UserRole.OWNER,
        },
        `Customer activated by ${user.name}`
      );
      setCustomer(updated);
      setIsActivateModalOpen(false);
      setActionSuccessMessage(`${customer.name} has been activated.`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4 font-sans max-w-xl mx-auto pb-6">
      {/* Back Button */}
      <button
        type="button"
        onClick={() => onNavigate('/app/customers')}
        className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer py-1"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Customers</span>
      </button>

      {/* Success Notification Banner */}
      {actionSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-white shadow-2xs shrink-0 ${
                isInactive ? 'bg-stone-500' : 'bg-emerald-700'
              }`}
            >
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-stone-900 leading-tight">
                  {customer.name}
                </h1>
                <span className="text-xs font-mono font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                  {displayCode}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                    isInactive
                      ? 'bg-stone-100 text-stone-600 border border-stone-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {isInactive ? (
                    <>
                      <XCircle className="w-3 h-3 text-stone-500" />
                      INACTIVE
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ACTIVE
                    </>
                  )}
                </span>
                {customer.phone && (
                  <span className="text-xs font-mono text-stone-600">
                    +91 {customer.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Contact & Basic Information Section */}
        <div className="bg-stone-50/80 rounded-xl p-3.5 border border-stone-200/80 space-y-2.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Primary Phone */}
            <div className="flex items-start gap-2">
              <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] text-stone-500 block">Primary Phone</span>
                {customer.phone ? (
                  <a
                    href={`tel:${customer.phone}`}
                    className="font-mono font-semibold text-stone-900 hover:text-emerald-700"
                  >
                    +91 {customer.phone}
                  </a>
                ) : (
                  <span className="text-stone-400 italic">Not provided</span>
                )}
              </div>
            </div>

            {/* Alternate Phone */}
            <div className="flex items-start gap-2">
              <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] text-stone-500 block">Alternate Phone</span>
                {customer.alternatePhone ? (
                  <a
                    href={`tel:${customer.alternatePhone}`}
                    className="font-mono font-semibold text-stone-900 hover:text-emerald-700"
                  >
                    +91 {customer.alternatePhone}
                  </a>
                ) : (
                  <span className="text-stone-400 italic">None</span>
                )}
              </div>
            </div>

            {/* Address / Village */}
            <div className="flex items-start gap-2 sm:col-span-2">
              <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] text-stone-500 block">Address / Village</span>
                <span className="text-stone-800 font-medium">
                  {customer.address || customer.villageOrArea || 'No address specified'}
                </span>
              </div>
            </div>

            {/* Notes */}
            {customer.notes && (
              <div className="flex items-start gap-2 sm:col-span-2 bg-white p-2.5 rounded-lg border border-stone-200">
                <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-stone-500 block">Notes</span>
                  <span className="text-stone-800 italic">{customer.notes}</span>
                </div>
              </div>
            )}

            {/* Registration Date */}
            <div className="flex items-start gap-2 sm:col-span-2 pt-1 border-t border-stone-200/60 text-[11px] text-stone-500">
              <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
              <span>
                Registered on{' '}
                {new Date(customer.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Primary Action Buttons: New Transaction, Settle Khata, Statement, Edit */}
        <div className="flex flex-wrap gap-2 pt-1">
          {/* New Transaction */}
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            disabled={isInactive}
            onClick={() => {
              if (isInactive) {
                alert('This customer is inactive. Please activate the customer before recording transactions.');
                return;
              }
              onNavigate(`/app/transactions/new?customerId=${encodeURIComponent(customer.id)}`);
            }}
            className="flex-1 min-w-[140px]"
          >
            New Transaction
          </Button>

          {/* Quick Payment / Settle Khata */}
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Banknote className="w-3.5 h-3.5 text-emerald-700" />}
            disabled={isInactive}
            onClick={() => {
              if (isInactive) {
                alert('This customer is inactive. Please activate the customer first.');
                return;
              }
              setPaymentModalAction(
                balances.cashDueAmount > 0 ? PaymentType.RECEIVE_PAYMENT : PaymentType.PAY_CUSTOMER
              );
              setIsPaymentModalOpen(true);
            }}
            className="border-emerald-300 text-emerald-950 hover:bg-emerald-50"
          >
            Record Payment
          </Button>

          {/* View Statement (Direct Route) */}
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Receipt className="w-3.5 h-3.5" />}
            onClick={() => onNavigate(`/app/customers/${customer.id}/statement`)}
          >
            View Statement
          </Button>

          {/* Edit Customer */}
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={handleOpenEdit}
            >
              Edit
            </Button>
          )}

          {/* Activate / Deactivate Toggle (Owner Only) */}
          {canToggleStatus && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (isInactive) {
                  setIsActivateModalOpen(true);
                } else {
                  setIsDeactivateModalOpen(true);
                }
              }}
              className={`text-xs ${
                isInactive ? 'text-emerald-700 hover:text-emerald-800' : 'text-red-700 hover:text-red-800'
              }`}
            >
              {isInactive ? 'Activate' : 'Deactivate'}
            </Button>
          )}
        </div>
      </div>

      {/* ACCOUNT SUMMARY - 4 Simple Balance Cards Derived from Ledger Service */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-800" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Account Summary
            </h2>
          </div>
          <span className="text-[10px] text-stone-500">
            {balances.totalEntriesCount} ledger records
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 font-sans">
          {/* Wheat Card */}
          <div className="bg-white rounded-xl border border-stone-200 p-3.5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Wheat
              </span>
              <Wheat className="w-4 h-4 text-amber-600" />
            </div>
            <div className="pt-0.5">
              <span className="text-lg sm:text-xl font-bold font-mono text-stone-900 leading-none">
                {balances.wheatBalanceKg} kg
              </span>
            </div>
            <p className="text-[10px] text-stone-500 leading-tight pt-0.5">
              Wheat available in mill
            </p>
          </div>

          {/* Atta Card */}
          <div className="bg-white rounded-xl border border-stone-200 p-3.5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Atta
              </span>
              <Scale className="w-4 h-4 text-stone-600" />
            </div>
            <div className="pt-0.5">
              <span className="text-lg sm:text-xl font-bold font-mono text-stone-900 leading-none">
                {balances.attaBalanceKg} kg
              </span>
            </div>
            <p className="text-[10px] text-stone-500 leading-tight pt-0.5">
              Atta pending pickup
            </p>
          </div>

          {/* Cash Credit Card (Shop owes customer) */}
          <div
            className={`rounded-xl border p-3.5 shadow-2xs space-y-1.5 ${
              balances.cashCreditAmount > 0
                ? 'bg-emerald-50/60 border-emerald-300'
                : 'bg-white border-stone-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Cash Credit
              </span>
              <CreditCard className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="pt-0.5">
              <span
                className={`text-lg sm:text-xl font-bold font-mono leading-none ${
                  balances.cashCreditAmount > 0 ? 'text-emerald-800' : 'text-stone-900'
                }`}
              >
                ₹{balances.cashCreditAmount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <p className="text-[10px] text-stone-500 leading-tight">
              Advance (Shop owes customer)
            </p>
            {balances.cashCreditAmount > 0 && !isInactive && (
              <button
                type="button"
                onClick={() => {
                  setPaymentModalAction(PaymentType.PAY_CUSTOMER);
                  setIsPaymentModalOpen(true);
                }}
                className="mt-1 w-full py-1 px-2 bg-emerald-700 text-white rounded-lg text-[11px] font-bold hover:bg-emerald-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <ArrowUpRight className="w-3 h-3" />
                Pay Customer
              </button>
            )}
          </div>

          {/* Cash Due Card (Customer owes shop) */}
          <div
            className={`rounded-xl border p-3.5 shadow-2xs space-y-1.5 ${
              balances.cashDueAmount > 0
                ? 'bg-rose-50/60 border-rose-300'
                : 'bg-white border-stone-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Cash Due
              </span>
              <CreditCard className="w-4 h-4 text-rose-600" />
            </div>
            <div className="pt-0.5">
              <span
                className={`text-lg sm:text-xl font-bold font-mono leading-none ${
                  balances.cashDueAmount > 0 ? 'text-rose-700' : 'text-stone-900'
                }`}
              >
                ₹{balances.cashDueAmount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <p className="text-[10px] text-stone-500 leading-tight">
              Pending (Customer owes shop)
            </p>
            {balances.cashDueAmount > 0 && !isInactive && (
              <button
                type="button"
                onClick={() => {
                  setPaymentModalAction(PaymentType.RECEIVE_PAYMENT);
                  setIsPaymentModalOpen(true);
                }}
                className="mt-1 w-full py-1 px-2 bg-rose-700 text-white rounded-lg text-[11px] font-bold hover:bg-rose-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <ArrowDownLeft className="w-3 h-3" />
                Receive Payment
              </button>
            )}
          </div>
        </div>

        {/* Both Credit and Due Offset Alert Banner */}
        {balances.cashCreditAmount > 0 && balances.cashDueAmount > 0 && !isInactive && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-amber-950">
            <div className="space-y-0.5">
              <div className="font-bold flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                <span>Credit and Due Balance Present</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Customer has ₹{balances.cashCreditAmount} credit and owes ₹{balances.cashDueAmount} due.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPaymentModalAction(PaymentType.APPLY_CREDIT);
                setIsPaymentModalOpen(true);
              }}
              className="bg-white border-amber-400 text-amber-950 hover:bg-amber-100 shrink-0 text-xs font-bold"
            >
              Apply Credit
            </Button>
          </div>
        )}
      </div>

      {/* TABS: Activity / Payments & Receipts */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 border-b border-stone-200 pb-0">
          <button
            type="button"
            onClick={() => setActiveProfileTab('ACTIVITY')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeProfileTab === 'ACTIVITY'
                ? 'border-emerald-700 text-emerald-950'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Ledger Activity</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-stone-100 text-stone-700">
              {timelineResult.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveProfileTab('PAYMENTS')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeProfileTab === 'PAYMENTS'
                ? 'border-emerald-700 text-emerald-950'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Payments & Receipts</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-stone-100 text-stone-700">
              {customerPayments.length}
            </span>
          </button>
        </div>

        {/* TAB 1: LEDGER ACTIVITY */}
        {activeProfileTab === 'ACTIVITY' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Recent Ledger Events
              </span>
              {timelineResult.total > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate(`/app/customers/${customer.id}/statement`)}
                  className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Full Statement ({timelineResult.total})</span>
                </button>
              )}
            </div>

            {timelineResult.entries.length > 0 ? (
              <div className="space-y-2">
                {timelineResult.entries.map((entry) => (
                  <LedgerTimelineItem
                    key={entry.id}
                    entry={entry}
                    onClick={(txnId) => onNavigate(`/app/transactions/${txnId}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto border border-stone-200">
                  <Clock className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-stone-900">No activity yet</h4>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Transactions, wheat deposits, and milling payments will appear here as they are recorded.
                </p>
                {!isInactive && (
                  <div className="pt-2">
                    <Button
                      size="sm"
                      variant="primary"
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={() => onNavigate('/app/transactions/new')}
                    >
                      Record First Transaction
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PAYMENTS & RECEIPTS */}
        {activeProfileTab === 'PAYMENTS' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Receipt Records ({customerPayments.length})
              </span>
              {!isInactive && (
                <button
                  type="button"
                  onClick={() => {
                    setPaymentModalAction(
                      balances.cashDueAmount > 0 ? PaymentType.RECEIVE_PAYMENT : PaymentType.PAY_CUSTOMER
                    );
                    setIsPaymentModalOpen(true);
                  }}
                  className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record Payment</span>
                </button>
              )}
            </div>

            {customerPayments.length > 0 ? (
              <div className="space-y-2">
                {customerPayments.map((p) => {
                  const isReceive = p.paymentType === PaymentType.RECEIVE_PAYMENT;
                  const isPayCust = p.paymentType === PaymentType.PAY_CUSTOMER;
                  const isApplyCredit = p.paymentType === PaymentType.APPLY_CREDIT;

                  return (
                    <div
                      key={p.id}
                      className="bg-white rounded-xl border border-stone-200 p-3.5 shadow-2xs space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded border border-stone-200 text-[11px]">
                            {p.receiptNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              isReceive
                                ? 'bg-emerald-100 text-emerald-800'
                                : isPayCust
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {isReceive
                              ? 'Payment Received'
                              : isPayCust
                              ? 'Shop Paid Customer'
                              : 'Credit Applied'}
                          </span>
                          <span className="text-[10px] font-mono text-stone-500 bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200">
                            {p.paymentMode}
                          </span>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-sm font-mono font-bold ${
                              isReceive
                                ? 'text-emerald-700'
                                : isPayCust
                                ? 'text-amber-700'
                                : 'text-sky-700'
                            }`}
                          >
                            {formatRupees(p.amount)}
                          </span>
                        </div>
                      </div>

                      {/* Breakdown summary */}
                      <div className="bg-stone-50/80 rounded-lg p-2 border border-stone-200/60 font-mono text-[11px] space-y-0.5 text-stone-600">
                        {p.appliedToBillAmount > 0 && (
                          <div className="flex justify-between">
                            <span>Applied to Dues:</span>
                            <span className="font-bold text-stone-900">
                              {formatRupees(p.appliedToBillAmount)}
                            </span>
                          </div>
                        )}
                        {p.advanceCreditCreated > 0 && (
                          <div className="flex justify-between text-emerald-700 font-bold">
                            <span>Advance Credit Added:</span>
                            <span>+{formatRupees(p.advanceCreditCreated)}</span>
                          </div>
                        )}
                        {p.transactionNumber && (
                          <div className="flex justify-between pt-0.5 text-[10px] text-stone-500">
                            <span>Ref Transaction:</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (p.transactionId) {
                                  onNavigate(`/app/transactions/${p.transactionId}`);
                                }
                              }}
                              className="font-bold text-emerald-800 hover:underline cursor-pointer"
                            >
                              {p.transactionNumber}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Metadata footer */}
                      <div className="flex items-center justify-between text-[10px] text-stone-400 pt-0.5">
                        <span>{formatDate(p.createdAt)}</span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => onNavigate(`/app/payments/${p.id}/receipt`)}
                            className="font-semibold text-emerald-800 hover:underline cursor-pointer"
                          >
                            View Receipt
                          </button>
                          {p.receivedByName && <span>Processed by {p.receivedByName}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto border border-stone-200">
                  <Receipt className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-stone-900">No payment receipts yet</h4>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Payments received at counter or credit payouts will appear here with instant receipts.
                </p>
                {!isInactive && (
                  <div className="pt-2">
                    <Button
                      size="sm"
                      variant="primary"
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={() => {
                        setPaymentModalAction(
                          balances.cashDueAmount > 0
                            ? PaymentType.RECEIVE_PAYMENT
                            : PaymentType.PAY_CUSTOMER
                        );
                        setIsPaymentModalOpen(true);
                      }}
                    >
                      Record Payment
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* EDIT CUSTOMER MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Customer Profile"
        subtitle={`Editing ${customer.name} (${displayCode})`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-3.5 text-left font-sans">
          {editError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {editError}
            </div>
          )}

          {/* Customer Code (Read-Only) */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-500">
              Customer Code (Permanent)
            </label>
            <input
              type="text"
              disabled
              value={displayCode}
              className="w-full px-3 py-2 text-xs bg-stone-100 border border-stone-200 rounded-lg font-mono text-stone-600 cursor-not-allowed"
            />
          </div>

          {/* Full Name */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-800">
              Full Name <span className="text-red-600 font-bold">*</span>
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-800">
              Mobile Number
            </label>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value.replace(/[^\d\s-]/g, ''))}
              placeholder="10-digit number"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          {/* Alternate Phone */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-800">
              Alternate Phone (Optional)
            </label>
            <input
              type="tel"
              value={editAltPhone}
              onChange={(e) => setEditAltPhone(e.target.value.replace(/[^\d\s-]/g, ''))}
              placeholder="Secondary contact"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          {/* Address */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-800">
              Address / Village
            </label>
            <input
              type="text"
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              placeholder="Village or ward"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-800">
              Notes
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSaving}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* DEACTIVATE CONFIRMATION MODAL */}
      <Modal
        isOpen={isDeactivateModalOpen}
        onClose={() => setIsDeactivateModalOpen(false)}
        title={`Deactivate ${customer.name}?`}
        subtitle="Customer account status modification"
        maxWidth="sm"
      >
        <div className="space-y-4 text-left font-sans">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Important Notice:</p>
              <p>
                This customer will remain in the system and historical records will be preserved.
                No data will be deleted.
              </p>
            </div>
          </div>

          <p className="text-xs text-stone-600">
            When deactivated, the customer will be marked as INACTIVE and new transactions will be disabled until reactivated.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeactivateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmDeactivate}
            >
              Deactivate
            </Button>
          </div>
        </div>
      </Modal>

      {/* ACTIVATE CONFIRMATION MODAL */}
      <Modal
        isOpen={isActivateModalOpen}
        onClose={() => setIsActivateModalOpen(false)}
        title={`Activate ${customer.name}?`}
        subtitle="Re-enable customer account"
        maxWidth="sm"
      >
        <div className="space-y-4 text-left font-sans">
          <p className="text-xs text-stone-600">
            Re-activating <strong>{customer.name}</strong> will allow recording new milling entries, rice transactions, and payments.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsActivateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmActivate}
            >
              Activate Customer
            </Button>
          </div>
        </div>
      </Modal>

      {/* QUICK PAYMENT / SETTLEMENT MODAL */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        customer={customer}
        initialAction={paymentModalAction}
        onPaymentSuccess={(result) => {
          setActionSuccessMessage(
            `Payment ${result.payment.receiptNumber} recorded successfully. Applied ₹${result.breakdown.appliedToDues} to dues${
              result.breakdown.advanceCreditAdded > 0 ? `, added ₹${result.breakdown.advanceCreditAdded} to advance credit` : ''
            }.`
          );
          setRefreshCounter((prev) => prev + 1);
          setIsPaymentModalOpen(false);
        }}
      />
    </div>
  );
};
