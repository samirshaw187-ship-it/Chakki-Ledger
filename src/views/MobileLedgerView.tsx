import React, { useState } from 'react';
import { LedgerService } from '../services/ledger.service';
import { LedgerDirection, LedgerEntryType, LedgerStatus } from '../types';
import { FilterBar } from '../components/ui/FilterBar';
import { EmptyState } from '../components/ui/EmptyState';
import {
  BookOpen,
  Calendar,
  Download,
  ExternalLink,
  ChevronRight,
  Wheat,
  Scale,
  CreditCard,
  Receipt,
  User as UserIcon,
} from 'lucide-react';

export interface MobileLedgerViewProps {
  onNavigate?: (path: string) => void;
}

export const MobileLedgerView: React.FC<MobileLedgerViewProps> = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [activeTab, setActiveTab] = useState<string>('ALL');

  const selectedEntryType =
    activeTab === 'WHEAT'
      ? LedgerEntryType.WHEAT
      : activeTab === 'ATTA'
      ? LedgerEntryType.ATTA
      : activeTab === 'RICE'
      ? LedgerEntryType.RICE
      : activeTab === 'CASH'
      ? LedgerEntryType.CASH
      : 'ALL';

  // Fetch actual data from LedgerService
  const { entries, total } = LedgerService.getGlobalLedger({
    search: searchQuery,
    startDate: dateFilter ? `${dateFilter}T00:00:00.000Z` : undefined,
    endDate: dateFilter ? `${dateFilter}T23:59:59.999Z` : undefined,
    entryType: selectedEntryType,
    limit: 50,
  });

  const handleTxnClick = (transactionId: string) => {
    if (onNavigate) {
      onNavigate(`/app/transactions/${transactionId}`);
    }
  };

  const handleCustomerClick = (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onNavigate) {
      onNavigate(`/app/customers/${customerId}`);
    }
  };

  return (
    <div className="space-y-4 font-sans max-w-5xl mx-auto pb-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-stone-900 leading-tight">
            General Ledger & Day Book
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Running record of grain deposits, milling outputs, and cash payments across customers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-md border border-stone-200">
            {total} records
          </span>
        </div>
      </div>

      {/* FilterBar with Search, Date Picker, and Filter Tabs */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search customer, description, or TX #..."
        dateValue={dateFilter}
        onDateChange={setDateFilter}
        options={[
          { id: 'ALL', label: 'All Entries' },
          { id: 'WHEAT', label: 'Wheat (Deposits)' },
          { id: 'ATTA', label: 'Atta (Milled)' },
          { id: 'RICE', label: 'Rice (Trade)' },
          { id: 'CASH', label: 'Cash (Payments)' },
        ]}
        activeOption={activeTab}
        onOptionChange={setActiveTab}
      />

      {/* Actual Data Views */}
      {entries.length > 0 ? (
        <div className="space-y-3">
          {/* Desktop Table (Visible on md+ screens) */}
          <div className="hidden md:block bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 font-semibold text-stone-600 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-center">Direction</th>
                    <th className="p-3 text-right">Quantity</th>
                    <th className="p-3 text-right">Rate</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3">Transaction ID</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-sans">
                  {entries.map((entry) => {
                    const isIncoming = entry.direction === LedgerDirection.IN;
                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-stone-50/80 transition-colors"
                      >
                        {/* Date */}
                        <td className="p-3 text-stone-600 whitespace-nowrap">
                          {new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        {/* Customer */}
                        <td className="p-3 font-semibold text-stone-900 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => handleCustomerClick(entry.customerId, e)}
                            className="hover:text-emerald-700 transition-colors cursor-pointer text-left"
                          >
                            {entry.customerName || 'General Customer'}
                          </button>
                        </td>

                        {/* Type */}
                        <td className="p-3 font-medium text-stone-700">
                          {entry.entryType}
                        </td>

                        {/* Direction */}
                        <td className="p-3 text-center">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                              isIncoming
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {entry.direction}
                          </span>
                        </td>

                        {/* Quantity */}
                        <td className="p-3 text-right font-mono text-stone-800">
                          {entry.quantity !== undefined
                            ? `${entry.quantity} ${entry.unit.toLowerCase()}`
                            : '-'}
                        </td>

                        {/* Rate */}
                        <td className="p-3 text-right font-mono text-stone-500">
                          {entry.rate !== undefined ? `₹${entry.rate}/kg` : '-'}
                        </td>

                        {/* Amount */}
                        <td className="p-3 text-right font-mono font-bold text-stone-900">
                          {entry.amount !== undefined ? `₹${entry.amount.toFixed(2)}` : '-'}
                        </td>

                        {/* Status */}
                        <td className="p-3 text-center">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              entry.status === LedgerStatus.SETTLED || entry.status === LedgerStatus.PAID
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

                        {/* Transaction ID */}
                        <td className="p-3 font-mono text-stone-700 whitespace-nowrap">
                          {entry.transactionNumber || entry.transactionId}
                        </td>

                        {/* Action */}
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleTxnClick(entry.transactionId)}
                            title="View Transaction"
                            className="p-1 text-stone-500 hover:text-emerald-700 hover:bg-stone-100 rounded transition-colors cursor-pointer"
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
          </div>

          {/* Mobile Ledger Cards (Visible on mobile screens) */}
          <div className="md:hidden space-y-2.5">
            {entries.map((entry) => {
              const isIncoming = entry.direction === LedgerDirection.IN;
              return (
                <div
                  key={entry.id}
                  onClick={() => handleTxnClick(entry.transactionId)}
                  className="bg-white rounded-xl border border-stone-200 p-3.5 shadow-2xs space-y-2 hover:border-emerald-700/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] text-stone-500 border-b border-stone-100 pb-1.5">
                    <span>
                      {new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="font-mono font-semibold text-stone-700">
                      {entry.transactionNumber || entry.transactionId}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={(e) => handleCustomerClick(entry.customerId, e)}
                        className="text-xs font-bold text-stone-900 hover:text-emerald-700 transition-colors text-left flex items-center gap-1 cursor-pointer"
                      >
                        <UserIcon className="w-3 h-3 text-stone-400" />
                        <span>{entry.customerName || 'General Customer'}</span>
                      </button>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        {entry.description}
                      </p>
                    </div>

                    <div className="text-right">
                      {entry.amount !== undefined ? (
                        <span className="text-sm font-mono font-bold text-stone-900 block">
                          ₹{entry.amount.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-sm font-mono font-bold text-stone-900 block">
                          {entry.quantity} {entry.unit.toLowerCase()}
                        </span>
                      )}
                      {entry.rate && (
                        <span className="text-[10px] font-mono text-stone-500">
                          @ ₹{entry.rate}/kg
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                          isIncoming
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {entry.direction}
                      </span>
                      <span className="font-semibold text-stone-600">
                        {entry.entryType}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                          entry.status === LedgerStatus.SETTLED || entry.status === LedgerStatus.PAID
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
                      <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No ledger entries found"
          description="No transactions match your search filter or selected date. Try clearing your search parameters."
          actionLabel="Reset Ledger Filters"
          onAction={() => {
            setSearchQuery('');
            setDateFilter('');
            setActiveTab('ALL');
          }}
        />
      )}
    </div>
  );
};
