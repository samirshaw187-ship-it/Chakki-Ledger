import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface SummaryCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  variant?: 'emerald' | 'amber' | 'stone' | 'red';
  onClick?: () => void;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  variant = 'stone',
  onClick,
}) => {
  const iconBgVariants = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    stone: 'bg-stone-100 text-stone-700 border-stone-200',
    red: 'bg-red-50 text-red-700 border-red-100',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs ${
        onClick ? 'cursor-pointer hover:border-stone-300 active:bg-stone-50 transition-all' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-semibold text-stone-500 uppercase tracking-wider truncate">
            {label}
          </p>
          <p className="text-xl sm:text-2xl font-bold text-stone-900 mt-1 tracking-tight truncate">
            {value}
          </p>
          {subtext && (
            <p className="text-[11px] text-stone-500 mt-1 truncate">
              {subtext}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-2 sm:p-2.5 rounded-xl border ${iconBgVariants[variant]} shrink-0`}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        )}
      </div>
    </div>
  );
};
