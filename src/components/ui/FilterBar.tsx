import React from 'react';
import { Search, Calendar, Filter } from 'lucide-react';

export interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

export interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  dateValue?: string;
  onDateChange?: (date: string) => void;
  options?: FilterOption[];
  activeOption?: string;
  onOptionChange?: (id: string) => void;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  dateValue,
  onDateChange,
  options,
  activeOption,
  onOptionChange,
  className = '',
}) => {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Search and Date Row */}
      <div className="flex flex-col xs:flex-row items-stretch gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 shadow-2xs min-h-[42px]"
          />
        </div>

        {onDateChange && (
          <div className="relative shrink-0 flex items-center">
            <Calendar className="absolute left-3 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="date"
              value={dateValue || ''}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full xs:w-auto pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 shadow-2xs min-h-[42px]"
            />
          </div>
        )}
      </div>

      {/* Category Pills Row */}
      {options && options.length > 0 && onOptionChange && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {options.map((opt) => {
            const isActive = activeOption === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onOptionChange(opt.id)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 min-h-[36px] flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-2xs font-semibold'
                    : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50 active:bg-stone-100'
                }`}
              >
                <span>{opt.label}</span>
                {typeof opt.count === 'number' && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-emerald-800 text-emerald-100' : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {opt.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
