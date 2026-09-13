import React from 'react';
import {
  LedgerDirection,
  LedgerEntry,
  LedgerEntryType,
  LedgerStatus,
  LedgerUnit,
} from '../../types';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wheat,
  Coins,
  Receipt,
  Scale,
  ChevronRight,
  Clock,
} from 'lucide-react';

export interface LedgerTimelineItemProps {
  entry: LedgerEntry;
  onClick?: (transactionId: string) => void;
}

export const LedgerTimelineItem: React.FC<LedgerTimelineItemProps> = ({
  entry,
  onClick,
}) => {
  const isIncoming = entry.direction === LedgerDirection.IN;

  // Icon depending on entry type
  const getIcon = () => {
    switch (entry.entryType) {
      case LedgerEntryType.WHEAT:
        return <Wheat className="w-4 h-4 text-amber-700" />;
      case LedgerEntryType.ATTA:
        return <Scale className="w-4 h-4 text-stone-700" />;
      case LedgerEntryType.RICE:
        return <Receipt className="w-4 h-4 text-sky-700" />;
      case LedgerEntryType.CASH:
        return <Coins className="w-4 h-4 text-emerald-700" />;
      default:
        return <Clock className="w-4 h-4 text-stone-600" />;
    }
  };

  // Status badge styling
  const renderStatusBadge = () => {
    if (!entry.status) return null;

    let badgeClasses = 'bg-stone-100 text-stone-700 border-stone-200';
    if (entry.status === LedgerStatus.SETTLED || entry.status === LedgerStatus.PAID) {
      badgeClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    } else if (entry.status === LedgerStatus.CREDIT) {
      badgeClasses = 'bg-indigo-50 text-indigo-800 border-indigo-200';
    } else if (entry.status === LedgerStatus.DUE) {
      badgeClasses = 'bg-red-50 text-red-800 border-red-200';
    } else if (entry.status === LedgerStatus.PARTIAL) {
      badgeClasses = 'bg-amber-50 text-amber-800 border-amber-200';
    }

    return (
      <span
        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeClasses} inline-flex items-center gap-1`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            entry.status === LedgerStatus.SETTLED || entry.status === LedgerStatus.PAID
              ? 'bg-emerald-600'
              : entry.status === LedgerStatus.CREDIT
              ? 'bg-indigo-600'
              : entry.status === LedgerStatus.DUE
              ? 'bg-red-600'
              : 'bg-amber-600'
          }`}
        />
        {entry.status}
      </span>
    );
  };

  // Format primary quantity/amount
  const renderQuantityOrAmount = () => {
    if (entry.unit === LedgerUnit.RUPEE || entry.entryType === LedgerEntryType.CASH) {
      return (
        <span className="font-mono font-bold text-sm text-stone-900">
          ₹{(entry.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      );
    }

    return (
      <div className="text-right">
        <span className="font-mono font-bold text-sm text-stone-900">
          {entry.quantity ?? 0} {entry.unit.toLowerCase()}
        </span>
        {entry.rate && entry.amount && (
          <span className="block text-[10px] font-mono text-stone-500">
            @ ₹{entry.rate}/kg = ₹{entry.amount}
          </span>
        )}
      </div>
    );
  };

  const formattedDate = new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = new Date(entry.date || entry.createdAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      onClick={() => onClick && onClick(entry.transactionId)}
      className="group relative bg-white border border-stone-200/80 rounded-xl p-3 sm:p-3.5 hover:border-emerald-700/40 hover:shadow-2xs transition-all cursor-pointer flex items-center justify-between gap-3 text-left font-sans"
    >
      <div className="flex items-start gap-3 min-w-0">
        {/* Direction Icon Badge */}
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
            isIncoming
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-700'
              : 'bg-amber-50/80 border-amber-200 text-amber-700'
          }`}
        >
          {getIcon()}
        </div>

        {/* Details */}
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-stone-900 leading-tight">
              {entry.description}
            </span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                isIncoming
                  ? 'bg-emerald-100/80 text-emerald-800'
                  : 'bg-stone-100 text-stone-700'
              }`}
            >
              {entry.direction}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-stone-500">
            <span>
              {formattedDate} • {formattedTime}
            </span>
            <span>•</span>
            <span className="font-mono text-stone-600 font-medium">
              {entry.transactionNumber || entry.transactionId}
            </span>
          </div>

          {entry.notes && (
            <p className="text-[11px] text-stone-500 italic truncate max-w-xs pt-0.5">
              "{entry.notes}"
            </p>
          )}
        </div>
      </div>

      {/* Right side: Amount & Status & Arrow */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right space-y-1">
          {renderQuantityOrAmount()}
          <div>{renderStatusBadge()}</div>
        </div>
        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all" />
      </div>
    </div>
  );
};
