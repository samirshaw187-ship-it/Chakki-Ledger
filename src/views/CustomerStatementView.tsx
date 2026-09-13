import React, { useState } from 'react';
import { CustomerService } from '../services/customer.service';
import { LedgerService } from '../services/ledger.service';
import { downloadStatementPdf } from '../services/receipt.service';
import { Customer, LedgerDirection, LedgerEntryType, LedgerStatus, LedgerUnit } from '../types';
import { Button } from '../components/ui/Button';
import {
  ArrowLeft,
  Calendar,
  Search,
  Printer,
  Receipt,
  FileSpreadsheet,
  AlertTriangle,
  Wheat,
  Scale,
  CreditCard,
  ExternalLink,
  X,
  Layers,
} from 'lucide-react';

export interface CustomerStatementViewProps {
  customerId: string;
  onNavigate: (path: string) => void;
}

type DatePreset = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

export const CustomerStatementView: React.FC<CustomerStatementViewProps> = ({
  customerId,
  onNavigate,
}) => {
  const [customer] = useState<Customer | undefined>(() =>
    CustomerService.getCustomerById(customerId)
  );

  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  if (!customer) {
    return (
      <div className="space-y-4 font-sans max-w-lg mx-auto p-6 text-center">
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
          <h2 className="text-lg font-bold text-stone-900">Customer Not Found</h2>
          <p className="text-xs text-stone-600">
            Could not generate statement for customer ID "{customerId}".
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

  // Generate statement through LedgerService
  const statement = LedgerService.getCustomerStatement(customer.id, {
    preset: datePreset,
    startDate: datePreset === 'CUSTOM' ? (customStart ? `${customStart}T00:00:00.000Z` : undefined) : undefined,
    endDate: datePreset === 'CUSTOM' ? (customEnd ? `${customEnd}T23:59:59.999Z` : undefined) : undefined,
    search: searchQuery,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 font-sans max-w-4xl mx-auto pb-10">
      {/* Top Controls (Back & Print) */}
      <div className="flex items-center justify-between gap-3 no-print">
        <button
          type="button"
          onClick={() => onNavigate(`/app/customers/${customer.id}`)}
          className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customer Profile</span>
        </button>

        <Button
          size="sm"
          variant="outline"
          leftIcon={<Printer className="w-3.5 h-3.5" />}
          onClick={handlePrint}
          className="cursor-pointer text-xs"
        >
          Print Statement
        </Button>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
          onClick={() => downloadStatementPdf(statement)}
          className="cursor-pointer text-xs"
        >
          Download PDF
        </Button>
      </div>

      {/* Formal Statement Header (Printable) */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-800" />
              <h1 className="text-xl font-bold text-stone-900 tracking-tight">
                Chakki Ledger
              </h1>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Customer Account & Grain Milling Statement
            </p>
          </div>

          <div className="sm:text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
              Statement Period
            </span>
            <span className="text-xs font-bold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-block mt-0.5">
              {statement.periodLabel}
            </span>
          </div>
        </div>

        {/* Customer & Mill Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-stone-50 p-4 rounded-xl border border-stone-200">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
              Customer Details
            </span>
            <h2 className="text-base font-bold text-stone-900 mt-0.5">
              {customer.name}
            </h2>
            <div className="mt-1 space-y-0.5 text-stone-600">
              <p>
                Customer ID:{' '}
                <strong className="font-mono text-stone-800">
                  {customer.customerCode || customer.id}
                </strong>
              </p>
              {customer.phone && (
                <p>
                  Mobile: <span className="font-mono">+91 {customer.phone}</span>
                </p>
              )}
              {customer.address && (
                <p>
                  Address: <span>{customer.address}</span>
                </p>
              )}
            </div>
          </div>

          <div className="sm:text-right sm:border-l sm:border-stone-200/80 sm:pl-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
              Account Status
            </span>
            <div className="mt-1 space-y-1">
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block ${
                  customer.status === 'INACTIVE'
                    ? 'bg-stone-200 text-stone-700'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {customer.status || 'ACTIVE'}
              </span>
              <p className="text-[11px] text-stone-500">
                Total ledger records in period:{' '}
                <strong>{statement.entries.length}</strong>
              </p>
              <p className="text-[10px] text-stone-400">
                Generated: {new Date().toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Date Filtering Controls (Non-printed on hard copy) */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs space-y-3 no-print">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700 uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-emerald-800" />
            <span>Filter Period</span>
          </div>
          <span className="text-[11px] text-stone-500">
            Preset date windows
          </span>
        </div>

        {/* Preset Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {[
            { id: 'ALL', label: 'All Time' },
            { id: 'TODAY', label: 'Today' },
            { id: 'THIS_WEEK', label: 'This Week' },
            { id: 'THIS_MONTH', label: 'This Month' },
            { id: 'LAST_MONTH', label: 'Last Month' },
            { id: 'CUSTOM', label: 'Custom Range' },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setDatePreset(preset.id as DatePreset)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer min-h-[34px] ${
                datePreset === preset.id
                  ? 'bg-stone-900 text-white font-semibold shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom Range Inputs */}
        {datePreset === 'CUSTOM' && (
          <div className="pt-2 border-t border-stone-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
              />
            </div>
          </div>
        )}

        {/* Search within Statement */}
        <div className="relative pt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none mt-0.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by transaction # or description..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer mt-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* STATEMENT TRANSACTIONS - Desktop Table & Mobile Cards */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-900">
            Transaction Activity ({statement.entries.length})
          </h3>
          <span className="text-xs text-stone-500">
            {statement.periodLabel}
          </span>
        </div>

        {statement.entries.length > 0 ? (
          <>
            {/* Desktop Table (hidden on small mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-stone-50 border-b border-stone-200 font-semibold text-stone-600 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Txn #</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-center">Type</th>
                    <th className="p-3 text-center">Dir</th>
                    <th className="p-3 text-right">Quantity / Unit</th>
                    <th className="p-3 text-right">Rate / Amount</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right no-print">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {statement.entries.map((entry) => {
                    const isIncoming = entry.direction === LedgerDirection.IN;
                    return (
                      <tr key={entry.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="p-3 text-stone-600 whitespace-nowrap">
                          {new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="p-3 font-mono font-semibold text-stone-800 whitespace-nowrap">
                          {entry.transactionNumber || entry.transactionId}
                        </td>
                        <td className="p-3 text-stone-900 font-medium max-w-[200px] truncate">
                          {entry.description}
                          {entry.notes && (
                            <span className="block text-[10px] text-stone-400 italic truncate">
                              {entry.notes}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center font-semibold text-stone-600">
                          {entry.entryType}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                              isIncoming
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {entry.direction}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-stone-700">
                          {entry.quantity !== undefined
                            ? `${entry.quantity} ${entry.unit.toLowerCase()}`
                            : '-'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-stone-900">
                          {entry.amount !== undefined
                            ? `₹${entry.amount.toFixed(2)}`
                            : '-'}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              entry.status === LedgerStatus.CORRECTED
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                : entry.status === LedgerStatus.REVERSED
                                ? 'bg-rose-100 text-rose-900 border border-rose-300 font-bold'
                                : entry.status === LedgerStatus.SETTLED || entry.status === LedgerStatus.PAID
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : entry.status === LedgerStatus.CREDIT
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                : entry.status === LedgerStatus.DUE
                                ? 'bg-red-50 text-red-800 border border-red-200'
                                : 'bg-stone-100 text-stone-700 border border-stone-200'
                            }`}
                          >
                            {entry.status || 'RECORDED'}
                          </span>
                        </td>
                        <td className="p-3 text-right no-print">
                          <button
                            type="button"
                            title="View Original Transaction"
                            onClick={() => onNavigate(`/app/transactions/${entry.transactionId}`)}
                            className="p-1 text-stone-500 hover:text-emerald-700 transition-colors cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards (shown on mobile screens) */}
            <div className="md:hidden divide-y divide-stone-100">
              {statement.entries.map((entry) => {
                const isIncoming = entry.direction === LedgerDirection.IN;
                return (
                  <div
                    key={entry.id}
                    onClick={() => onNavigate(`/app/transactions/${entry.transactionId}`)}
                    className="p-3.5 space-y-1.5 hover:bg-stone-50/80 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] text-stone-500">
                      <span>
                        {new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="font-mono font-medium text-stone-700">
                        {entry.transactionNumber || entry.transactionId}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-stone-900">
                          {entry.description}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                            isIncoming
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {entry.direction}
                        </span>
                      </div>

                      <div className="text-right">
                        {entry.amount !== undefined ? (
                          <span className="font-mono font-bold text-xs text-stone-900">
                            ₹{entry.amount.toFixed(2)}
                          </span>
                        ) : (
                          <span className="font-mono font-bold text-xs text-stone-900">
                            {entry.quantity} {entry.unit.toLowerCase()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span className="text-stone-500">
                        Type: <strong>{entry.entryType}</strong>
                        {entry.quantity !== undefined && entry.amount !== undefined && (
                          <span> ({entry.quantity} {entry.unit.toLowerCase()})</span>
                        )}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                          entry.status === LedgerStatus.CORRECTED
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                            : entry.status === LedgerStatus.REVERSED
                            ? 'bg-rose-100 text-rose-900 border border-rose-300 font-bold'
                            : entry.status === LedgerStatus.SETTLED || entry.status === LedgerStatus.PAID
                            ? 'bg-emerald-50 text-emerald-800'
                            : entry.status === LedgerStatus.CREDIT
                            ? 'bg-indigo-50 text-indigo-800'
                            : entry.status === LedgerStatus.DUE
                            ? 'bg-red-50 text-red-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {entry.status || 'RECORDED'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-stone-500 space-y-1">
            <p className="font-semibold text-sm text-stone-800">No ledger entries in this period</p>
            <p className="text-xs text-stone-400">
              No milling or payment activity was recorded matching the selected filter.
            </p>
          </div>
        )}
      </div>

      {/* STATEMENT PERIOD TOTALS SUMMARY (Section 11 Requirement) */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-stone-200 pb-2.5">
          <Layers className="w-4 h-4 text-emerald-800" />
          <h3 className="text-sm font-bold text-stone-900">
            Statement Period Totals
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-sans">
          {/* Wheat In / Out */}
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1">
            <div className="flex items-center justify-between text-stone-500">
              <span className="font-bold uppercase tracking-wider text-[10px]">Total Wheat</span>
              <Wheat className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="pt-1 text-stone-700 space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Received (IN):</span>
                <strong className="font-mono">{statement.summary.totalWheatInKg} kg</strong>
              </div>
              <div className="flex justify-between">
                <span>Delivered (OUT):</span>
                <strong className="font-mono">{statement.summary.totalWheatOutKg} kg</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-200 font-bold text-stone-900">
                <span>Net in Period:</span>
                <strong className="font-mono">{statement.summary.netWheatBalanceKg} kg</strong>
              </div>
            </div>
          </div>

          {/* Atta In / Out */}
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1">
            <div className="flex items-center justify-between text-stone-500">
              <span className="font-bold uppercase tracking-wider text-[10px]">Total Atta</span>
              <Scale className="w-3.5 h-3.5 text-stone-600" />
            </div>
            <div className="pt-1 text-stone-700 space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Produced (IN):</span>
                <strong className="font-mono">{statement.summary.totalAttaInKg} kg</strong>
              </div>
              <div className="flex justify-between">
                <span>Given (OUT):</span>
                <strong className="font-mono">{statement.summary.totalAttaOutKg} kg</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-200 font-bold text-stone-900">
                <span>Net in Period:</span>
                <strong className="font-mono">{statement.summary.netAttaBalanceKg} kg</strong>
              </div>
            </div>
          </div>

          {/* Rice Traded */}
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1">
            <div className="flex items-center justify-between text-stone-500">
              <span className="font-bold uppercase tracking-wider text-[10px]">Total Rice</span>
              <Receipt className="w-3.5 h-3.5 text-sky-600" />
            </div>
            <div className="pt-1 text-stone-700 space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Traded (IN):</span>
                <strong className="font-mono">{statement.summary.totalRiceInKg} kg</strong>
              </div>
              <div className="flex justify-between">
                <span>Adjusted (OUT):</span>
                <strong className="font-mono">{statement.summary.totalRiceOutKg} kg</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-200 font-bold text-stone-900">
                <span>Net in Period:</span>
                <strong className="font-mono">{statement.summary.netRiceBalanceKg} kg</strong>
              </div>
            </div>
          </div>

          {/* Cash In / Out */}
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1">
            <div className="flex items-center justify-between text-stone-500">
              <span className="font-bold uppercase tracking-wider text-[10px]">Total Cash</span>
              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="pt-1 text-stone-700 space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Received (IN):</span>
                <strong className="font-mono">₹{statement.summary.totalCashInAmount.toFixed(0)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Billed (OUT):</span>
                <strong className="font-mono">₹{statement.summary.totalCashOutAmount.toFixed(0)}</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-200 font-bold text-stone-900">
                <span>Period Net:</span>
                <strong className="font-mono">
                  {statement.summary.netCashCreditAmount > 0
                    ? `+₹${statement.summary.netCashCreditAmount.toFixed(0)} Cr`
                    : statement.summary.netCashDueAmount > 0
                    ? `-₹${statement.summary.netCashDueAmount.toFixed(0)} Due`
                    : '₹0'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CURRENT CLOSING BALANCES (Overall Account Truth) */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Current Closing Balances (All-Time Ledger Status)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-sans">
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
            <span className="text-[10px] font-bold uppercase text-stone-500 block">Wheat Balance</span>
            <span className="text-base font-bold font-mono text-stone-900 block mt-0.5">
              {statement.balances.wheatBalanceKg} kg
            </span>
            <span className="text-[10px] text-stone-400">Available in mill</span>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
            <span className="text-[10px] font-bold uppercase text-stone-500 block">Atta Balance</span>
            <span className="text-base font-bold font-mono text-stone-900 block mt-0.5">
              {statement.balances.attaBalanceKg} kg
            </span>
            <span className="text-[10px] text-stone-400">Pending pickup</span>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
            <span className="text-[10px] font-bold uppercase text-stone-500 block">Cash Credit</span>
            <span className="text-base font-bold font-mono text-emerald-700 block mt-0.5">
              ₹{statement.balances.cashCreditAmount.toFixed(2)}
            </span>
            <span className="text-[10px] text-stone-400">Shop owes customer</span>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
            <span className="text-[10px] font-bold uppercase text-stone-500 block">Cash Due</span>
            <span className="text-base font-bold font-mono text-red-700 block mt-0.5">
              ₹{statement.balances.cashDueAmount.toFixed(2)}
            </span>
            <span className="text-[10px] text-stone-400">Customer owes shop</span>
          </div>
        </div>
      </div>
    </div>
  );
};
