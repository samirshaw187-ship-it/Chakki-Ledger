import React from 'react';
import { Transaction, TransactionType, TransactionStatus } from '../../types';
import { StatusBadge } from '../ui/StatusBadge';
import { Clock, ChevronRight, Scale, Wheat, ShoppingBag, ArrowLeftRight, Banknote, Receipt, ShieldAlert, RotateCcw, Truck, FileText } from 'lucide-react';
import { TRANSACTION_DEFINITIONS } from '../../modules/transactions/definitions';
import { formatRupees, formatKg } from '../../utils/precision';

export interface TransactionCardProps {
  transaction: Transaction;
  onClick?: () => void;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({ transaction, onClick }) => {
  if (!transaction) return null;

  const definition = TRANSACTION_DEFINITIONS[transaction.type as TransactionType];

  const timeFormatted = transaction.createdAt
    ? new Date(transaction.createdAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : 'Just now';

  const dateFormatted = transaction.date
    ? new Date(transaction.date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      })
    : '';

  // Get icon for transaction type
  const renderIcon = () => {
    const iconClass = 'w-4 h-4';
    switch (transaction.type) {
      case TransactionType.WHEAT_DEPOSIT:
        return <Scale className={`${iconClass} text-emerald-700`} />;
      case TransactionType.WHEAT_ATTA_EXCHANGE:
        return <Wheat className={`${iconClass} text-amber-700`} />;
      case TransactionType.RICE_PURCHASE:
      case TransactionType.ATTA_PURCHASE:
        return <ShoppingBag className={`${iconClass} text-sky-700`} />;
      case TransactionType.RICE_ATTA_SETTLEMENT:
        return <ArrowLeftRight className={`${iconClass} text-emerald-700`} />;
      case TransactionType.RICE_CASH_SETTLEMENT:
      case TransactionType.WHEAT_CASH_SETTLEMENT:
        return <Banknote className={`${iconClass} text-teal-700`} />;
      case TransactionType.CASH_PAYMENT:
      case TransactionType.EXPENSE:
        return <Receipt className={`${iconClass} text-stone-700`} />;
      case TransactionType.CORRECTION:
        return <ShieldAlert className={`${iconClass} text-amber-700`} />;
      case TransactionType.REVERSAL:
        return <RotateCcw className={`${iconClass} text-rose-700`} />;
      case TransactionType.RICE_WHOLESALE_SALE:
        return <Truck className={`${iconClass} text-sky-700`} />;
      default:
        return <FileText className={`${iconClass} text-stone-700`} />;
    }
  };

  // Determine settlement text display
  const renderSettlementHighlight = () => {
    if (transaction.type === TransactionType.RICE_ATTA_SETTLEMENT) {
      if (transaction.balanceDelta < 0) {
        return (
          <span className="font-semibold text-emerald-800">
            Customer receives {formatRupees(Math.abs(transaction.balanceDelta))}
          </span>
        );
      } else if (transaction.balanceDelta > 0) {
        return (
          <span className="font-semibold text-rose-800">
            Customer pays {formatRupees(transaction.balanceDelta)}
          </span>
        );
      }
      return <span className="font-semibold text-stone-700">Fully Settled</span>;
    }

    if (transaction.type === TransactionType.WHEAT_ATTA_EXCHANGE) {
      const wheatItem = transaction.items?.find((i) => i.direction === 'IN' || i.itemType === 'WHEAT') || transaction.items?.[0];
      const attaItem = transaction.items?.find((i) => i.direction === 'OUT' || i.itemType === 'ATTA') || transaction.items?.[1];
      const wheatQty = wheatItem?.quantity || 0;
      const rate = attaItem?.ratePerUnit || wheatItem?.ratePerUnit || 10;
      const isChali = (attaItem as any)?.attaType === 'CHALI_ATTA';

      if (transaction.balanceDelta > 0) {
        return (
          <span className="font-semibold text-rose-800">
            {formatKg(wheatQty)} Wheat → {isChali ? 'Chali' : 'Roll'} Atta (Due: {formatRupees(transaction.balanceDelta)})
          </span>
        );
      }
      return (
        <span className="font-semibold text-amber-900">
          {formatKg(wheatQty)} Wheat → {isChali ? 'Chali' : 'Roll'} Atta @ ₹{rate}/kg (Settled)
        </span>
      );
    }

    if (transaction.type === TransactionType.WHEAT_DEPOSIT) {
      const item = transaction.items?.[0];
      return (
        <span className="font-semibold text-emerald-800">
          +{formatKg(item?.quantity || 0)} Wheat Deposited
        </span>
      );
    }

    if (transaction.type === TransactionType.CASH_PAYMENT) {
      return (
        <span className="font-semibold text-emerald-800">
          Payment received: {formatRupees(transaction.netAmount)}
        </span>
      );
    }

    if (transaction.type === TransactionType.RICE_CASH_SETTLEMENT || transaction.type === TransactionType.WHEAT_CASH_SETTLEMENT) {
      return (
        <span className="font-semibold text-teal-800">
          Paid out: {formatRupees(transaction.netAmount)}
        </span>
      );
    }

    if (transaction.netAmount > 0) {
      return (
        <span className="font-semibold text-stone-900 font-mono">
          {formatRupees(transaction.netAmount)}
        </span>
      );
    }

    return <span className="font-medium text-stone-600">{transaction.description || 'Completed'}</span>;
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs hover:border-stone-300 transition-all cursor-pointer active:bg-stone-50/70"
    >
      {/* Top Header: Transaction Number, Customer Name & Time */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
              {transaction.transactionNumber || 'TXN'}
            </span>
            {transaction.customerCode && (
              <span className="text-[10px] font-mono font-medium text-stone-500 bg-stone-50 px-1.5 py-0.5 rounded">
                #{transaction.customerCode}
              </span>
            )}
          </div>
          <div className="pt-0.5">
            <span className="text-sm sm:text-base font-bold text-stone-900 leading-tight">
              {transaction.customerName || 'Walk-in Customer'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-stone-600 font-medium">
            {renderIcon()}
            <span>{definition?.label || transaction.type.replace(/_/g, ' ')}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="flex items-center justify-end gap-1 text-[11px] text-stone-500 font-medium">
            <Clock className="w-3 h-3 text-stone-400" />
            <span>{dateFormatted ? `${dateFormatted}, ` : ''}{timeFormatted}</span>
          </div>
          <div className="mt-1.5">
            <StatusBadge status={transaction.status} />
          </div>
        </div>
      </div>

      {/* Items Breakdown summary */}
      {transaction.items && transaction.items.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-stone-100 space-y-1 text-xs text-stone-600">
          {transaction.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <span>
                {formatKg(item.quantity)} {item.grainType ? String(item.grainType).replace(/_/g, ' ') : item.itemType || ''}
                {item.ratePerUnit > 0 ? ` @ ₹${item.ratePerUnit}` : ''}
              </span>
              <span className="font-mono text-stone-700 font-medium">
                {item.totalAmount > 0 ? formatRupees(item.totalAmount) : '-'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Prominent Corrected / Reversed Status Ribbon */}
      {transaction.status === TransactionStatus.CORRECTED && (
        <div className="mt-2 p-2 bg-amber-50/90 rounded-lg border border-amber-200 text-[11px] text-amber-950 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>CORRECTED</span>
          </div>
          {transaction.netCorrectionDiff ? (
            <span className="font-mono text-amber-900 font-bold">
              Adj: {transaction.netCorrectionDiff}
            </span>
          ) : (
            <span className="text-amber-800 text-[10px]">
              Compensating entry linked
            </span>
          )}
        </div>
      )}

      {transaction.status === TransactionStatus.REVERSED && (
        <div className="mt-2 p-2 bg-rose-50/90 rounded-lg border border-rose-200 text-[11px] text-rose-950 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 font-semibold text-rose-900">
            <RotateCcw className="w-3.5 h-3.5 text-rose-700 shrink-0" />
            <span>REVERSED</span>
          </div>
          <span className="text-rose-800 text-[10px] font-medium">
            Financial &amp; grain effects neutralized
          </span>
        </div>
      )}

      {/* Bottom Settlement Line with Visual Hierarchy */}
      <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
        <div>
          <span className="text-stone-500 text-[11px] mr-1">Settlement:</span>
          {renderSettlementHighlight()}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onClick) onClick();
          }}
          className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 flex items-center gap-0.5 px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
        >
          <span>View</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
