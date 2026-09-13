import React, { useState, useEffect } from 'react';
import { CustomerService } from '../services/customer.service';
import { CustomerCard } from '../components/domain/CustomerCard';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Search, Plus, Users, ChevronLeft, ChevronRight, X, UserPlus } from 'lucide-react';
import { Customer, CustomerStatus } from '../types';

export interface MobileCustomersViewProps {
  onNavigate: (path: string) => void;
}

export const MobileCustomersView: React.FC<MobileCustomersViewProps> = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CustomerStatus>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const PAGE_LIMIT = 10;

  // Query customers via CustomerService
  const queryResult = CustomerService.getCustomers({
    search: searchQuery,
    status: statusFilter,
    page: currentPage,
    limit: PAGE_LIMIT,
  });

  // Reset pagination when search query or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const allCustomersCount = CustomerService.getCustomers({ status: 'ALL', limit: 9999 }).total;
  const activeCustomersCount = CustomerService.getCustomers({
    status: CustomerStatus.ACTIVE,
    limit: 9999,
  }).total;
  const inactiveCustomersCount = CustomerService.getCustomers({
    status: CustomerStatus.INACTIVE,
    limit: 9999,
  }).total;

  return (
    <div className="space-y-3.5 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-stone-900 leading-tight">
            Customers
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            {allCustomersCount} registered accounts ({activeCustomersCount} active)
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
          onClick={() => onNavigate('/app/customers/new')}
          className="shrink-0"
        >
          Add Customer
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search name, phone or customer ID"
          className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 shadow-2xs min-h-[44px]"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter Tabs (All, Active, Inactive) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
        {[
          { key: 'ALL', label: 'All', count: allCustomersCount },
          { key: CustomerStatus.ACTIVE, label: 'Active', count: activeCustomersCount },
          { key: CustomerStatus.INACTIVE, label: 'Inactive', count: inactiveCustomersCount },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setStatusFilter(item.key as any)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer min-h-[36px] flex items-center gap-1.5 ${
              statusFilter === item.key
                ? 'bg-emerald-800 text-white font-semibold shadow-2xs'
                : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            <span>{item.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                statusFilter === item.key
                  ? 'bg-emerald-900 text-emerald-100'
                  : 'bg-stone-100 text-stone-600'
              }`}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {/* Customer List */}
      <div className="space-y-2.5 pt-0.5">
        {queryResult.customers.length > 0 ? (
          queryResult.customers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onClick={() => onNavigate(`/app/customers/${customer.id}`)}
            />
          ))
        ) : searchQuery ? (
          <EmptyState
            icon={Search}
            title="No customers found"
            description={`No customer matching "${searchQuery}". Check the phone number, code or spelling.`}
            actionLabel="Clear Search"
            onAction={() => setSearchQuery('')}
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No customers registered yet"
            description="Start by adding your first customer to the ledger."
            actionLabel="+ Add Customer"
            onAction={() => onNavigate('/app/customers/new')}
          />
        )}
      </div>

      {/* Pagination Controls */}
      {queryResult.totalPages > 1 && (
        <div className="pt-2 flex items-center justify-between border-t border-stone-200 text-xs text-stone-600">
          <span>
            Page <strong>{queryResult.page}</strong> of <strong>{queryResult.totalPages}</strong> ({queryResult.total} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={queryResult.page <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer min-h-[36px]"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              type="button"
              disabled={queryResult.page >= queryResult.totalPages}
              onClick={() => setCurrentPage((p) => Math.min(queryResult.totalPages, p + 1))}
              className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer min-h-[36px]"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
