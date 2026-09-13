import React from 'react';
import { Customer, CustomerStatus } from '../../types';
import { Phone, MapPin, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';

export interface CustomerCardProps {
  customer: Customer;
  onClick?: () => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({ customer, onClick }) => {
  const isInactive = customer.status === CustomerStatus.INACTIVE || customer.isActive === false;
  const displayCode = customer.customerCode || customer.id;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`bg-white rounded-xl border p-3.5 sm:p-4 shadow-2xs hover:border-stone-300 transition-all cursor-pointer active:bg-stone-50 select-none ${
        isInactive ? 'border-stone-200/70 opacity-80 bg-stone-50/50' : 'border-stone-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-stone-900 truncate">
              {customer.name}
            </h3>
            <span className="text-[11px] font-mono font-medium text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200 shrink-0">
              {displayCode}
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0 ${
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
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-stone-600">
            {customer.phone ? (
              <span className="inline-flex items-center gap-1 font-mono">
                <Phone className="w-3 h-3 text-stone-400" />
                +91 {customer.phone}
              </span>
            ) : (
              <span className="text-stone-400 italic text-[11px]">No phone</span>
            )}
            {(customer.address || customer.villageOrArea) && (
              <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                {customer.address || customer.villageOrArea}
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-stone-400 shrink-0 mt-1" />
      </div>

      {/* Notice regarding ledger & balance coming after transaction module */}
      <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
        <span className="italic">Ledger balance: coming in transaction module</span>
        <span className="text-emerald-700 font-medium">View Profile &rarr;</span>
      </div>
    </div>
  );
};
