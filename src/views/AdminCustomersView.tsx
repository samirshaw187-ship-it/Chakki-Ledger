import React, { useState } from 'react';
import { CustomerService } from '../services/customer.service';
import { LedgerService } from '../services/ledger.service';
import { Customer, CustomerStatus, UserRole } from '../types';
import { useAuth } from '../modules/auth';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import {
  Search,
  Plus,
  Eye,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
  Calendar,
  X,
  FileText,
  Wheat,
  Scale,
  CreditCard,
  Receipt,
  ExternalLink,
  Users,
} from 'lucide-react';

export interface AdminCustomersViewProps {
  onNavigate: (path: string) => void;
}

export const AdminCustomersView: React.FC<AdminCustomersViewProps> = ({ onNavigate }) => {
  const { user, role } = useAuth();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CustomerStatus>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_LIMIT = 10;

  // Selected customer for View Modal
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);

  // Selected customer for Edit Modal
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAltPhone, setEditAltPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Selected customer for Deactivate Modal
  const [deactivateCustomer, setDeactivateCustomer] = useState<Customer | null>(null);

  // New Customer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addDuplicateMatch, setAddDuplicateMatch] = useState<Customer | null>(null);
  const [addBypassDuplicate, setAddBypassDuplicate] = useState(false);

  // Permissions
  const isOwner = role === UserRole.OWNER;
  const isStaff = role === UserRole.STAFF;
  const canEdit = isOwner || isStaff;
  const canToggleStatus = isOwner;
  const canAdd = isOwner || isStaff;

  // Query customers
  const queryResult = CustomerService.getCustomers({
    search: searchQuery,
    status: statusFilter,
    page: currentPage,
    limit: PAGE_LIMIT,
    sortBy: 'customerCode',
    sortOrder: 'asc',
  });

  const totalAll = CustomerService.getCustomers({ status: 'ALL', limit: 9999 }).total;
  const totalActive = CustomerService.getCustomers({ status: CustomerStatus.ACTIVE, limit: 9999 }).total;
  const totalInactive = CustomerService.getCustomers({ status: CustomerStatus.INACTIVE, limit: 9999 }).total;

  // Summary metrics across all customers from LedgerService
  const allCustomers = CustomerService.getCustomers({ limit: 9999 }).customers;
  const balancesMap: Record<string, ReturnType<typeof LedgerService.getCustomerBalance>> = {};
  let totalWheatHeld = 0;
  let totalCashDue = 0;
  let totalCashAdvance = 0;

  for (const c of allCustomers) {
    const bal = LedgerService.getCustomerBalance(c.id);
    balancesMap[c.id] = bal;
    totalWheatHeld += bal.wheatBalanceKg;
    totalCashDue += bal.cashDueAmount;
    totalCashAdvance += bal.cashCreditAmount;
  }

  // Handle Edit Click
  const handleOpenEdit = (customer: Customer) => {
    setEditCustomer(customer);
    setEditName(customer.name);
    setEditPhone(customer.phone || '');
    setEditAltPhone(customer.alternatePhone || '');
    setEditAddress(customer.address || customer.villageOrArea || '');
    setEditNotes(customer.notes || '');
    setEditError(null);
  };

  // Submit Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustomer || !user) return;
    setEditError(null);

    setIsSaving(true);
    try {
      CustomerService.updateCustomer(
        editCustomer.id,
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
          role: role || UserRole.STAFF,
        }
      );
      setEditCustomer(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update customer.');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Activate/Deactivate
  const handleToggleStatus = (cust: Customer) => {
    if (!user) return;
    if (cust.status === CustomerStatus.ACTIVE) {
      setDeactivateCustomer(cust);
    } else {
      try {
        CustomerService.setCustomerStatus(
          cust.id,
          CustomerStatus.ACTIVE,
          {
            id: user.id,
            name: user.name,
            role: role || UserRole.OWNER,
          },
          `Customer reactivated by ${user.name}`
        );
        // Force refresh
        setCurrentPage((p) => p);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleConfirmDeactivate = () => {
    if (!deactivateCustomer || !user) return;
    try {
      CustomerService.setCustomerStatus(
        deactivateCustomer.id,
        CustomerStatus.INACTIVE,
        {
          id: user.id,
          name: user.name,
          role: role || UserRole.OWNER,
        },
        `Customer deactivated by ${user.name}`
      );
      setDeactivateCustomer(null);
      setCurrentPage((p) => p);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Add Customer Submit
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAddError(null);

    if (addDuplicateMatch && !addBypassDuplicate) {
      setAddError('A customer with this phone number already exists.');
      return;
    }

    setIsAdding(true);
    try {
      CustomerService.createCustomer(
        {
          name: newName,
          phone: newPhone || undefined,
          address: newAddress || undefined,
          notes: newNotes || undefined,
        },
        {
          id: user.id,
          name: user.name,
          role: role || UserRole.STAFF,
        }
      );
      setIsAddModalOpen(false);
      setNewName('');
      setNewPhone('');
      setNewAddress('');
      setNewNotes('');
      setAddDuplicateMatch(null);
      setAddBypassDuplicate(false);
      setCurrentPage(1);
    } catch (err: any) {
      setAddError(err.message || 'Failed to add customer.');
    } finally {
      setIsAdding(false);
    }
  };

  const handlePhoneInputChange = (val: string) => {
    const cleaned = val.replace(/[^\d\s-]/g, '');
    setNewPhone(cleaned);
    setAddBypassDuplicate(false);

    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length >= 10) {
      const check = CustomerService.checkDuplicatePhone(digitsOnly);
      if (check.hasDuplicate && check.existingCustomer) {
        setAddDuplicateMatch(check.existingCustomer);
      } else {
        setAddDuplicateMatch(null);
      }
    } else {
      setAddDuplicateMatch(null);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        title="Customer Directory & Ledger"
        description="Master directory of registered atta chakki customers and live account balances"
        breadcrumbs={['Admin', 'Customers']}
        action={
          canAdd ? (
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsAddModalOpen(true)}
            >
              Add Customer
            </Button>
          ) : undefined
        }
      />

      {/* 4 Summary Cards (Section 24 Requirement) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Customers */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Customers</span>
            <Users className="w-4 h-4 text-stone-700" />
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900 leading-none pt-1">
            {allCustomers.length}
          </p>
          <p className="text-[11px] text-stone-500">{totalActive} active accounts</p>
        </div>

        {/* Total Wheat Held */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Wheat Held</span>
            <Wheat className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900 leading-none pt-1">
            {totalWheatHeld.toLocaleString('en-IN')} kg
          </p>
          <p className="text-[11px] text-stone-500">Customer grain stored in mill</p>
        </div>

        {/* Total Cash Due */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Cash Due</span>
            <CreditCard className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-red-700 leading-none pt-1">
            ₹{totalCashDue.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] text-stone-500">Pending receivables from customers</p>
        </div>

        {/* Total Cash Advance */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Cash Advance</span>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-800 leading-none pt-1">
            ₹{totalCashAdvance.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] text-stone-500">Customer khata credit advance</p>
        </div>
      </div>

      {/* Control Bar: Search & Status Filter */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search name, phone or customer ID..."
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 text-xs">
          {[
            { key: 'ALL', label: 'All', count: totalAll },
            { key: CustomerStatus.ACTIVE, label: 'Active', count: totalActive },
            { key: CustomerStatus.INACTIVE, label: 'Inactive', count: totalInactive },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatusFilter(tab.key as any);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === tab.key
                  ? 'bg-stone-900 text-white shadow-2xs font-semibold'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === tab.key
                    ? 'bg-stone-700 text-stone-200'
                    : 'bg-white text-stone-600 border border-stone-200'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Table with Balances (Section 24 Requirement) */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 font-semibold text-stone-600 uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Customer Name</th>
                <th className="p-3.5">Customer ID</th>
                <th className="p-3.5">Phone</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Wheat Balance</th>
                <th className="p-3.5 text-right">Atta Balance</th>
                <th className="p-3.5 text-right">Cash Balance</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-sans">
              {queryResult.customers.length > 0 ? (
                queryResult.customers.map((c) => {
                  const isInactive = c.status === CustomerStatus.INACTIVE || c.isActive === false;
                  const displayCode = c.customerCode || c.id;
                  const bal = balancesMap[c.id] || LedgerService.getCustomerBalance(c.id);

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-stone-50/80 transition-colors ${
                        isInactive ? 'bg-stone-50/40 text-stone-500' : ''
                      }`}
                    >
                      {/* Name */}
                      <td className="p-3.5 font-bold text-stone-900">
                        <button
                          type="button"
                          onClick={() => onNavigate(`/app/customers/${c.id}`)}
                          className="hover:text-emerald-700 transition-colors text-left font-bold cursor-pointer"
                        >
                          {c.name}
                        </button>
                        {c.address && (
                          <span className="block text-[11px] text-stone-400 font-normal truncate max-w-[150px]">
                            {c.address}
                          </span>
                        )}
                      </td>

                      {/* Customer ID */}
                      <td className="p-3.5 font-mono font-semibold text-stone-800 whitespace-nowrap">
                        {displayCode}
                      </td>

                      {/* Phone */}
                      <td className="p-3.5 font-mono text-stone-600 whitespace-nowrap">
                        {c.phone ? `+91 ${c.phone}` : <span className="text-stone-400 italic">None</span>}
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center">
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
                      </td>

                      {/* Wheat Balance */}
                      <td className="p-3.5 text-right font-mono font-semibold text-stone-900 whitespace-nowrap">
                        {bal.wheatBalanceKg} kg
                      </td>

                      {/* Atta Balance */}
                      <td className="p-3.5 text-right font-mono font-semibold text-stone-900 whitespace-nowrap">
                        {bal.attaBalanceKg} kg
                      </td>

                      {/* Cash Balance */}
                      <td className="p-3.5 text-right font-mono whitespace-nowrap">
                        {bal.cashCreditAmount > 0 ? (
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                            +₹{bal.cashCreditAmount.toFixed(0)} Cr
                          </span>
                        ) : bal.cashDueAmount > 0 ? (
                          <span className="font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 text-[11px]">
                            -₹{bal.cashDueAmount.toFixed(0)} Due
                          </span>
                        ) : (
                          <span className="text-stone-400 font-normal">₹0.00</span>
                        )}
                      </td>

                      {/* Actions: Open Profile, View Statement, Edit, Deactivate */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Open Profile */}
                          <button
                            type="button"
                            title="Open Customer Profile"
                            onClick={() => onNavigate(`/app/customers/${c.id}`)}
                            className="px-2 py-1 text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Profile</span>
                          </button>

                          {/* View Statement */}
                          <button
                            type="button"
                            title="View Customer Statement"
                            onClick={() => onNavigate(`/app/customers/${c.id}/statement`)}
                            className="px-2 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Statement</span>
                          </button>

                          {/* Edit */}
                          {canEdit && (
                            <button
                              type="button"
                              title="Edit Customer"
                              onClick={() => handleOpenEdit(c)}
                              className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Activate / Deactivate Toggle */}
                          {canToggleStatus && (
                            <button
                              type="button"
                              title={isInactive ? 'Activate Customer' : 'Deactivate Customer'}
                              onClick={() => handleToggleStatus(c)}
                              className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                                isInactive
                                  ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                  : 'text-stone-500 hover:text-red-700 hover:bg-red-50'
                              }`}
                            >
                              {isInactive ? 'Activate' : 'Deactivate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-stone-500">
                    <p className="font-semibold text-sm text-stone-800">No customer accounts found</p>
                    <p className="text-xs text-stone-400 mt-1">
                      {searchQuery
                        ? `No results match "${searchQuery}". Try a different search query.`
                        : 'No customers currently registered in this view.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer: Pagination */}
        <div className="bg-stone-50 border-t border-stone-200 p-3.5 flex items-center justify-between text-xs text-stone-600">
          <span>
            Showing <strong>{queryResult.customers.length}</strong> of <strong>{queryResult.total}</strong> customers
            {queryResult.totalPages > 1 && ` (Page ${queryResult.page} of ${queryResult.totalPages})`}
          </span>

          {queryResult.totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={queryResult.page <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                disabled={queryResult.page >= queryResult.totalPages}
                onClick={() => setCurrentPage((p) => Math.min(queryResult.totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* VIEW CUSTOMER MODAL */}
      {viewCustomer && (
        <Modal
          isOpen={true}
          onClose={() => setViewCustomer(null)}
          title="Customer Profile Details"
          subtitle={`${viewCustomer.name} (${viewCustomer.customerCode || viewCustomer.id})`}
          maxWidth="md"
        >
          <div className="space-y-4 font-sans text-left text-xs">
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-medium">Customer Code (ID)</span>
                <span className="font-mono font-bold text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">
                  {viewCustomer.customerCode || viewCustomer.id}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-medium">Full Name</span>
                <span className="font-bold text-stone-900 text-sm">{viewCustomer.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-medium">Primary Phone</span>
                <span className="font-mono text-stone-800">
                  {viewCustomer.phone ? `+91 ${viewCustomer.phone}` : 'Not provided'}
                </span>
              </div>
              {viewCustomer.alternatePhone && (
                <div className="flex justify-between items-center">
                  <span className="text-stone-500 font-medium">Alternate Phone</span>
                  <span className="font-mono text-stone-800">+91 {viewCustomer.alternatePhone}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-medium">Address / Village</span>
                <span className="text-stone-800">{viewCustomer.address || viewCustomer.villageOrArea || 'None'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-medium">Registration Date</span>
                <span className="text-stone-700">
                  {new Date(viewCustomer.createdAt).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-medium">Status</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                    viewCustomer.status === CustomerStatus.INACTIVE
                      ? 'bg-stone-100 text-stone-600 border border-stone-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {viewCustomer.status || 'ACTIVE'}
                </span>
              </div>
            </div>

            {viewCustomer.notes && (
              <div className="bg-white p-3 rounded-xl border border-stone-200">
                <span className="font-semibold text-stone-700 block mb-1">Notes:</span>
                <p className="text-stone-600 italic leading-relaxed">{viewCustomer.notes}</p>
              </div>
            )}

            {/* Financial Status Placeholder Notice */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-stone-600">
              <span className="font-semibold text-stone-800 block mb-0.5">Ledger Balances:</span>
              <p className="italic text-[11px]">
                Financial balances and running transaction history will be activated in the upcoming Transaction & Ledger module.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewCustomer(null)}
              >
                Close
              </Button>
              {canEdit && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    const target = viewCustomer;
                    setViewCustomer(null);
                    handleOpenEdit(target);
                  }}
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* EDIT MODAL */}
      {editCustomer && (
        <Modal
          isOpen={true}
          onClose={() => setEditCustomer(null)}
          title="Edit Customer"
          subtitle={`Editing ${editCustomer.name} (${editCustomer.customerCode || editCustomer.id})`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveEdit} className="space-y-3 font-sans text-left text-xs">
            {editError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {editError}
              </div>
            )}

            <div>
              <label className="block font-semibold text-stone-500 mb-1">Customer Code (Read-Only)</label>
              <input
                type="text"
                disabled
                value={editCustomer.customerCode || editCustomer.id}
                className="w-full px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg font-mono text-stone-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">
                Full Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Phone Number</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value.replace(/[^\d\s-]/g, ''))}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Alternate Phone</label>
              <input
                type="tel"
                value={editAltPhone}
                onChange={(e) => setEditAltPhone(e.target.value.replace(/[^\d\s-]/g, ''))}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Address / Village</label>
              <input
                type="text"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditCustomer(null)}
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
      )}

      {/* DEACTIVATE CONFIRMATION MODAL */}
      {deactivateCustomer && (
        <Modal
          isOpen={true}
          onClose={() => setDeactivateCustomer(null)}
          title={`Deactivate ${deactivateCustomer.name}?`}
          subtitle="Customer status change"
          maxWidth="sm"
        >
          <div className="space-y-4 font-sans text-left text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Important Notice:</p>
                <p>
                  This customer will remain in the system and historical records will be preserved.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeactivateCustomer(null)}
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
      )}

      {/* ADD CUSTOMER MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Customer"
        subtitle="Register customer in ledger"
        maxWidth="md"
      >
        <form onSubmit={handleAddSubmit} className="space-y-3 font-sans text-left text-xs">
          {addError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {addError}
            </div>
          )}

          <div>
            <label className="block font-semibold text-stone-800 mb-1">
              Full Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Subir Karmakar"
              required
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-800 mb-1">Phone Number (Optional)</label>
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => handlePhoneInputChange(e.target.value)}
              placeholder="10-digit number"
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          {/* Duplicate phone warning */}
          {addDuplicateMatch && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-2">
              <p className="font-bold">A customer with this phone number already exists.</p>
              <p className="text-[11px]">
                Matching customer: <strong>{addDuplicateMatch.name}</strong> ({addDuplicateMatch.customerCode || addDuplicateMatch.id})
              </p>
              <div className="pt-1 flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddBypassDuplicate(true);
                    setAddError(null);
                  }}
                  className={`text-xs ${
                    addBypassDuplicate ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-stone-700'
                  }`}
                >
                  {addBypassDuplicate ? '✓ Continuing anyway' : 'Continue Anyway'}
                </Button>
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-stone-800 mb-1">Address / Village (Optional)</label>
            <input
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="e.g. Rampur Village"
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-800 mb-1">Notes (Optional)</label>
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              rows={2}
              placeholder="Account notes or preferences"
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isAdding}
            >
              Save Customer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
