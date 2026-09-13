import React, { useState, useMemo } from 'react';
import { TransactionType, TransactionStatus } from '../types';
import { TransactionService } from '../services/transaction.service';
import { TRANSACTION_DEFINITIONS } from '../modules/transactions/definitions';
import { TransactionCard } from '../components/domain/TransactionCard';
import { Button } from '../components/ui/Button';
import {
  Search,
  Plus,
  Filter,
  Layers,
  Calendar,
  X,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react';

export interface MobileTransactionsListViewProps {
  onNavigate: (path: string) => void;
}

export const MobileTransactionsListView: React.FC<MobileTransactionsListViewProps> = ({
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Query transactions via TransactionService
  const queryResult = useMemo(() => {
    return TransactionService.getTransactions({
      search: searchTerm,
      type: selectedType === 'ALL' ? undefined : (selectedType as TransactionType),
      status: selectedStatus === 'ALL' ? undefined : (selectedStatus as TransactionStatus),
      limit: 100,
    });
  }, [searchTerm, selectedType, selectedStatus]);

  const hasActiveFilters = selectedType !== 'ALL' || selectedStatus !== 'ALL' || searchTerm !== '';

  return (
    <div className="space-y-3.5 font-sans pb-8">
      {/* Header & New Action */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-stone-900 leading-tight">
            Transactions
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            {queryResult.total} total business transactions recorded
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => onNavigate('/app/transactions/new')}
        >
          New Transaction
        </Button>
      </div>

      {/* Search Bar & Filter Toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search TXN-..., customer, phone..."
            className="w-full pl-9 pr-8 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-700 shadow-2xs"
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

        <button
          type="button"
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs ${
            hasActiveFilters
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-emerald-700 ml-0.5" />
          )}
        </button>
      </div>

      {/* Expandable Filter Drawer */}
      {isFilterOpen && (
        <div className="bg-stone-50 rounded-xl border border-stone-200 p-3.5 space-y-3 text-xs">
          <div className="flex items-center justify-between font-bold text-stone-800 text-[11px] uppercase tracking-wider">
            <span>Filter Transactions</span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedType('ALL');
                  setSelectedStatus('ALL');
                }}
                className="text-emerald-800 hover:underline cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                Transaction Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              >
                <option value="ALL">All Types</option>
                {Object.values(TRANSACTION_DEFINITIONS).map((def) => (
                  <option key={def.type} value={def.type}>
                    {def.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                Transaction Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
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
      )}

      {/* Transactions List */}
      {queryResult.transactions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-stone-900">No transactions found</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'Try adjusting your search query or filter options.'
                : 'Start by recording your first transaction using the button below.'}
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => onNavigate('/app/transactions/new')}
          >
            Create Transaction
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {queryResult.transactions.map((t) => (
            <TransactionCard
              key={t.id}
              transaction={t}
              onClick={() => onNavigate(`/app/transactions/${t.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
