import React, { useState, useMemo } from 'react';
import { TransactionType, TransactionStatus } from '../types';
import { TransactionService } from '../services/transaction.service';
import { TRANSACTION_DEFINITIONS } from '../modules/transactions/definitions';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { formatRupees, formatKg } from '../utils/precision';
import {
  Search,
  Plus,
  Filter,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Eye,
  Receipt,
  Layers,
  X,
} from 'lucide-react';

export interface AdminTransactionsViewProps {
  onNavigate: (path: string) => void;
}

export const AdminTransactionsView: React.FC<AdminTransactionsViewProps> = ({
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Query transactions via TransactionService
  const queryResult = useMemo(() => {
    return TransactionService.getTransactions({
      search: searchTerm,
      type: selectedType === 'ALL' ? undefined : (selectedType as TransactionType),
      status: selectedStatus === 'ALL' ? undefined : (selectedStatus as TransactionStatus),
      page: currentPage,
      limit: pageSize,
    });
  }, [searchTerm, selectedType, selectedStatus, currentPage]);

  const hasActiveFilters = selectedType !== 'ALL' || selectedStatus !== 'ALL' || searchTerm !== '';

  return (
    <div className="space-y-4 font-sans pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 leading-tight">
            Transaction Ledger Registry
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Complete central transaction ledger records ({queryResult.total} entries)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => onNavigate('/app/transactions/new')}
          >
            New Transaction
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-stone-200 p-3.5 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by TXN number, customer, phone, code..."
              className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
            >
              <option value="ALL">All Types ({Object.keys(TRANSACTION_DEFINITIONS).length})</option>
              {Object.values(TRANSACTION_DEFINITIONS).map((def) => (
                <option key={def.type} value={def.type}>
                  {def.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
            >
              <option value="ALL">All Statuses</option>
              <option value={TransactionStatus.CONFIRMED}>CONFIRMED</option>
              <option value={TransactionStatus.SETTLED}>SETTLED</option>
              <option value={TransactionStatus.PARTIAL}>PARTIAL</option>
              <option value={TransactionStatus.DUE}>DUE</option>
              <option value={TransactionStatus.CREDIT}>CREDIT</option>
              <option value={TransactionStatus.CORRECTED}>CORRECTED</option>
              <option value={TransactionStatus.REVERSED}>REVERSED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Desktop Transactions Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Transaction No.</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Operation Type</th>
                <th className="py-3 px-4">Items / Details</th>
                <th className="py-3 px-4 text-right">Settlement / Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {queryResult.transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-stone-500">
                    No transactions matching your criteria.
                  </td>
                </tr>
              ) : (
                queryResult.transactions.map((t) => {
                  const def = TRANSACTION_DEFINITIONS[t.type];
                  return (
                    <tr
                      key={t.id}
                      onClick={() => onNavigate(`/app/transactions/${t.id}`)}
                      className="hover:bg-stone-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                          {t.transactionNumber}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-stone-600">
                        <div>
                          {new Date(t.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                        <span className="text-[10px] text-stone-400">
                          {new Date(t.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-stone-900 block">
                          {t.customerName || 'Walk-in'}
                        </span>
                        {t.customerCode && (
                          <span className="text-[10px] font-mono text-stone-500">
                            #{t.customerCode}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-stone-800">
                          {def?.label || t.type.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-stone-600 max-w-xs truncate">
                        {t.description || t.notes || (t.items?.[0] ? `${formatKg(t.items[0].quantity)}` : '-')}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                        {t.type === TransactionType.RICE_ATTA_SETTLEMENT ? (
                          t.balanceDelta < 0 ? (
                            <span className="text-emerald-800">
                              Receives {formatRupees(Math.abs(t.balanceDelta))}
                            </span>
                          ) : t.balanceDelta > 0 ? (
                            <span className="text-rose-800">
                              Pays {formatRupees(t.balanceDelta)}
                            </span>
                          ) : (
                            'Settled'
                          )
                        ) : t.netAmount > 0 ? (
                          formatRupees(t.netAmount)
                        ) : (
                          t.items?.[0] ? `${formatKg(t.items[0].quantity)}` : '₹0'
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <StatusBadge status={t.status} />
                          {t.status === TransactionStatus.CORRECTED && t.netCorrectionDiff && (
                            <span className="text-[10px] font-mono text-amber-800 font-semibold">
                              {t.netCorrectionDiff}
                            </span>
                          )}
                          {t.status === TransactionStatus.REVERSED && (
                            <span className="text-[10px] text-rose-700 font-medium">
                              Neutralized
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate(`/app/transactions/${t.id}`);
                          }}
                          className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 ml-auto px-2 py-1 rounded hover:bg-emerald-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate(`/app/transactions/${t.id}/receipt`);
                          }}
                          className="text-xs font-semibold text-stone-700 hover:text-stone-950 flex items-center gap-1 ml-auto px-2 py-1 rounded hover:bg-stone-100"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {queryResult.totalPages > 1 && (
          <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600">
            <span>
              Page {queryResult.page} of {queryResult.totalPages} ({queryResult.total} total)
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= queryResult.totalPages}
                onClick={() => setCurrentPage((p) => Math.min(queryResult.totalPages, p + 1))}
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
