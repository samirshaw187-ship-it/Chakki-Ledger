import React, { useState, useMemo } from 'react';
import {
  PaymentType,
  Transaction,
  TransactionStatus,
  TransactionType,
  UserRole,
  AuditLogEntry,
  AuditAction,
} from '../types';
import { useAuth } from '../modules/auth/AuthContext';
import { hasPermission, Permission } from '../modules/auth/permissions';
import { dbRepository } from '../db/in-memory-db';
import { TRANSACTION_DEFINITIONS } from '../modules/transactions/definitions';
import {
  TransactionService,
  CorrectionItemUpdate,
  CorrectionImpactResult,
} from '../services/transaction.service';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PaymentModal } from '../components/domain/PaymentModal';
import { formatRupees, formatKg, safeMultiply, formatDate } from '../utils/precision';
import {
  ArrowLeft,
  User,
  Clock,
  Layers,
  FileText,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  Receipt,
  Scale,
  Wheat,
  ShoppingBag,
  ArrowLeftRight,
  Banknote,
  Check,
  CreditCard,
  Plus,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react';

export interface TransactionDetailViewProps {
  transactionId: string;
  onNavigate: (path: string) => void;
}

export const TransactionDetailView: React.FC<TransactionDetailViewProps> = ({
  transactionId,
  onNavigate,
}) => {
  const { role, user } = useAuth();
  const canCorrect = hasPermission(role, Permission.CORRECT_TRANSACTION);
  const canReverse = hasPermission(role, Permission.REVERSE_TRANSACTION);

  // Load transaction by ID or Transaction Number
  const [txn, setTxn] = useState<Transaction | undefined>(() =>
    TransactionService.getTransactionById(transactionId)
  );

  // Modals for non-destructive adjustment
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [isReversalModalOpen, setIsReversalModalOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [expandedAuditLogId, setExpandedAuditLogId] = useState<string | null>(null);

  // Editable items state for correction
  const [correctionItems, setCorrectionItems] = useState<
    Array<{
      itemId: string;
      originalQuantity: number;
      newQuantity: number;
      originalRate: number;
      newRate: number;
      label: string;
      unit: string;
      direction?: string;
      notes?: string;
    }>
  >([]);

  // Live calculation of correction impact
  const correctionImpact: CorrectionImpactResult | null = useMemo(() => {
    if (!txn || !isCorrectionModalOpen) return null;
    const updates: CorrectionItemUpdate[] = correctionItems.map((ci) => ({
      itemId: ci.itemId,
      newQuantity: ci.newQuantity,
      newRate: ci.newRate,
      notes: ci.notes,
    }));
    return TransactionService.calculateCorrectionImpact(txn, updates);
  }, [txn, correctionItems, isCorrectionModalOpen]);

  // Find any compensating transactions referencing this one
  const compensatingTransactions = useMemo(() => {
    if (!txn) return [];
    return dbRepository.getTransactions().filter((t) => t.isCorrectionOfId === txn.id);
  }, [txn]);

  // If this transaction is a correction or reversal, look up original
  const originalTransaction = useMemo(() => {
    if (!txn?.isCorrectionOfId) return undefined;
    return dbRepository.getTransactionById(txn.isCorrectionOfId);
  }, [txn]);

  // Comprehensive audit trail for this transaction
  const auditLogs = useMemo(() => {
    if (!txn) return [];
    return TransactionService.getAuditTrailForTransaction(txn.id);
  }, [txn]);

  if (!txn) {
    return (
      <div className="space-y-4 font-sans max-w-lg mx-auto p-4 text-center">
        <div className="bg-white rounded-2xl border border-stone-200 p-8 shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Transaction Not Found</h3>
          <p className="text-xs text-stone-500">
            Could not find any transaction record matching &ldquo;{transactionId}&rdquo;.
          </p>
          <Button variant="primary" size="sm" onClick={() => onNavigate('/app/transactions')}>
            View All Transactions
          </Button>
        </div>
      </div>
    );
  }

  const definition = TRANSACTION_DEFINITIONS[txn.type];

  // Fetch customer details if attached
  const customer = txn.customerId ? dbRepository.getCustomerById(txn.customerId) : undefined;
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Fetch linked payments / receipts
  const linkedPayments = dbRepository.getPayments().filter(
    (p) => p.transactionId === txn.id || (txn.transactionNumber && p.transactionNumber === txn.transactionNumber)
  );

  // Fetch linked ledger entries
  const linkedLedgerEntries = dbRepository.getLedgerEntries().filter(
    (entry) => entry.transactionId === txn.id || entry.transactionNumber === txn.transactionNumber
  );

  const handleOpenCorrectionModal = () => {
    setModalError(null);
    setCorrectionReason('');
    const items = (txn.items || []).map((it) => ({
      itemId: it.id,
      originalQuantity: it.quantity,
      newQuantity: it.quantity,
      originalRate: it.ratePerUnit,
      newRate: it.ratePerUnit,
      label: it.grainType ? String(it.grainType).replace(/_/g, ' ') : it.itemType || 'Line Item',
      unit: it.unit || 'kg',
      direction: it.direction,
      notes: it.notes || '',
    }));
    setCorrectionItems(items);
    setIsCorrectionModalOpen(true);
  };

  const handlePerformCorrection = async () => {
    try {
      setModalError(null);
      if (!correctionReason || correctionReason.trim().length < 4) {
        setModalError('A mandatory correction reason (minimum 4 characters) is required.');
        return;
      }

      setIsSubmittingAction(true);
      const actor = {
        id: user?.id || 'usr-owner',
        name: user?.name || 'Owner',
        role,
      };

      const itemUpdates: CorrectionItemUpdate[] = correctionItems.map((ci) => ({
        itemId: ci.itemId,
        newQuantity: ci.newQuantity,
        newRate: ci.newRate,
        notes: ci.notes,
      }));

      const res = await TransactionService.createCorrection(
        txn.id,
        {
          reason: correctionReason.trim(),
          items: itemUpdates,
        },
        actor
      );

      setTxn({ ...res.original });
      setActionSuccess(
        `Correction recorded successfully! Original transaction marked as CORRECTED. Compensating entry ${res.correctionTxn?.transactionNumber || 'adjustment'} created and ledger balances updated atomically.`
      );
      setIsCorrectionModalOpen(false);
      setCorrectionReason('');
    } catch (err: any) {
      setModalError(err.message || 'Correction failed.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handlePerformReversal = async () => {
    try {
      setModalError(null);
      if (!reversalReason || reversalReason.trim().length < 4) {
        setModalError('A mandatory reversal reason (minimum 4 characters) is required.');
        return;
      }

      setIsSubmittingAction(true);
      const actor = {
        id: user?.id || 'usr-owner',
        name: user?.name || 'Owner',
        role,
      };

      const res = await TransactionService.reverseTransaction(
        txn.id,
        reversalReason.trim(),
        actor
      );

      setTxn({ ...res.original });
      setActionSuccess(
        `Transaction ${txn?.transactionNumber || ''} safely reversed! Compensating reversal ${res.reversalTxn?.transactionNumber || 'entry'} created and opposite ledger entries posted.`
      );
      setIsReversalModalOpen(false);
      setReversalReason('');
    } catch (err: any) {
      setModalError(err.message || 'Reversal failed.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Handle Mark Settlement Payment as Paid (for Delayed Cash Payout / Collection)
  const handleMarkPaymentPaid = () => {
    try {
      const actor = {
        id: user?.id || 'usr-owner',
        name: user?.name || 'Owner',
        role,
      };
      const updated = TransactionService.updatePaymentStatus(
        txn.id,
        'PAID',
        actor,
        'Physical cash payment completed at counter'
      );
      setTxn({ ...updated });
      setActionSuccess('Settlement payment status updated to PAID. Ledger and customer khata synchronized.');
    } catch (err: any) {
      setActionSuccess(null);
      alert(err.message || 'Failed to update payment status.');
    }
  };

  const formattedDate = new Date(txn.date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = new Date(txn.createdAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="space-y-4 font-sans max-w-2xl mx-auto pb-10">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onNavigate('/app/transactions')}
          className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Transactions</span>
        </button>

        <div className="flex items-center gap-2">
          {txn.type === TransactionType.RICE_WHOLESALE_SALE && (
            <button
              type="button"
              onClick={() => onNavigate(`/app/rice-trading/profit/${txn.id}`)}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Profit Breakdown</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate(`/app/transactions/${txn.id}/receipt`)}
            className="text-xs font-semibold text-stone-700 hover:text-stone-950 flex items-center gap-1 cursor-pointer bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>View Receipt</span>
          </button>
          {txn.customerId && (
            <button
              type="button"
              onClick={() => onNavigate(`/app/customers/${txn.customerId}`)}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
            >
              <User className="w-3.5 h-3.5" />
              <span>Customer Ledger</span>
            </button>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-mono font-bold text-stone-900 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
                {txn.transactionNumber}
              </span>
              <StatusBadge status={txn.status} />
              {txn.paymentStatus && (
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    txn.paymentStatus === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : txn.paymentStatus === 'PARTIAL'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  Payment: {txn.paymentStatus}
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 pt-2 leading-tight">
              {definition?.label || txn.type.replace(/_/g, ' ')}
            </h1>
          </div>

          <div className="text-left sm:text-right text-xs text-stone-500 space-y-0.5">
            <div className="flex sm:justify-end items-center gap-1 font-medium">
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              <span>{formattedDate} at {formattedTime}</span>
            </div>
            {txn.createdByName && (
              <div className="text-[11px] text-stone-400">
                Recorded by: <span className="text-stone-600 font-medium">{txn.createdByName}</span>
              </div>
            )}
          </div>
        </div>

        {/* STATUS BANNER: CORRECTED TRANSACTION */}
        {txn.status === TransactionStatus.CORRECTED && (
          <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3.5 space-y-2 text-xs text-amber-950">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Transaction Has Been Corrected</span>
              </div>
              {(txn.correctedAt || (txn as any).correctionDate) && (
                <span className="text-[11px] text-amber-800 font-mono">
                  {formatDate(txn.correctedAt || (txn as any).correctionDate)}
                </span>
              )}
            </div>
            <p className="text-stone-700">
              This transaction was corrected by{' '}
              <strong className="text-stone-900">{txn.correctedByName || 'Authorized User'}</strong>.
              The original transaction record is permanently preserved for dispute prevention.
            </p>
            {txn.correctionReason && (
              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-800 block">
                  Mandatory Recorded Reason
                </span>
                <span className="text-stone-800 font-medium italic">
                  &ldquo;{txn.correctionReason}&rdquo;
                </span>
              </div>
            )}
            {txn.netCorrectionDiff && (
              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-900 uppercase">
                  Net Ledger Correction Diff:
                </span>
                <span className="font-mono font-bold text-stone-900">
                  {txn.netCorrectionDiff}
                </span>
              </div>
            )}
            {compensatingTransactions.length > 0 && (
              <div className="pt-1 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-amber-900 font-semibold">
                  Compensating Correction Entry:
                </span>
                {compensatingTransactions.map((ct) => (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => onNavigate(`/app/transactions/${ct.id}`)}
                    className="px-2.5 py-1 bg-amber-200/90 hover:bg-amber-300 text-amber-950 rounded-lg font-mono font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>{ct?.transactionNumber || 'TXN'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STATUS BANNER: REVERSED TRANSACTION */}
        {txn.status === TransactionStatus.REVERSED && (
          <div className="bg-rose-50/90 border border-rose-300 rounded-xl p-3.5 space-y-2 text-xs text-rose-950">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <RotateCcw className="w-4 h-4 text-rose-700 shrink-0" />
                <span>Transaction Has Been Reversed</span>
              </div>
              {txn.reversalDate && (
                <span className="text-[11px] text-rose-800 font-mono">
                  {formatDate(txn.reversalDate)}
                </span>
              )}
            </div>
            <p className="text-stone-700">
              This transaction was safely voided by{' '}
              <strong className="text-stone-900">{txn.reversedByName || 'Authorized User'}</strong>.
              All ledger entries and customer khata balances were neutralized via an atomic compensating reversal entry.
            </p>
            {txn.reversalReason && (
              <div className="bg-white/80 p-2.5 rounded-lg border border-rose-200">
                <span className="text-[10px] uppercase font-bold text-rose-800 block">
                  Mandatory Reversal Reason
                </span>
                <span className="text-stone-800 font-medium italic">
                  &ldquo;{txn.reversalReason}&rdquo;
                </span>
              </div>
            )}
            {compensatingTransactions.length > 0 && (
              <div className="pt-1 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-rose-900 font-semibold">
                  Compensating Reversal Entry:
                </span>
                {compensatingTransactions.map((ct) => (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => onNavigate(`/app/transactions/${ct.id}`)}
                    className="px-2.5 py-1 bg-rose-200/90 hover:bg-rose-300 text-rose-950 rounded-lg font-mono font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>{ct?.transactionNumber || 'TXN'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* COMPENSATING ENTRY BANNER */}
        {(txn.type === TransactionType.CORRECTION || txn.type === TransactionType.REVERSAL) && originalTransaction && (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-stone-500 shrink-0" />
              <div>
                <span className="font-bold text-stone-900 block">
                  Compensating Entry for {originalTransaction?.transactionNumber || 'Original Transaction'}
                </span>
                <span className="text-[11px] text-stone-500">
                  Created non-destructively to adjust financial ledger balances and prevent disputes.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(`/app/transactions/${originalTransaction.id}`)}
              className="px-2.5 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg text-xs font-semibold text-stone-800 flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
            >
              <span>View Original</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Customer Box */}
        <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
              {txn.customerName ? txn.customerName.charAt(0).toUpperCase() : 'W'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-stone-900">
                  {txn.customerName || 'Walk-in Customer'}
                </span>
                {txn.customerCode && (
                  <span className="text-[10px] font-mono text-stone-500 bg-stone-200/70 px-1 py-0.5 rounded">
                    #{txn.customerCode}
                  </span>
                )}
              </div>
              {txn.customerPhone && (
                <span className="text-[11px] text-stone-500 block">
                  +91 {txn.customerPhone}
                </span>
              )}
            </div>
          </div>

          {txn.customerId && (
            <button
              type="button"
              onClick={() => onNavigate(`/app/customers/${txn.customerId}`)}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-0.5 cursor-pointer"
            >
              <span>View Profile</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dedicated Wheat -> Atta Exchange Card */}
        {txn.type === 'WHEAT_ATTA_EXCHANGE' && (() => {
          const wheatItem = txn.items?.find((i) => i.direction === 'IN' || i.itemType === 'WHEAT') || txn.items?.[0];
          const attaItem = txn.items?.find((i) => i.direction === 'OUT' || i.itemType === 'ATTA') || txn.items?.[1];
          const wheatQty = wheatItem?.quantity || 0;
          const attaQty = attaItem?.quantity || 0;
          const rate = attaItem?.ratePerUnit || wheatItem?.ratePerUnit || 10;
          const isChali = (attaItem as any)?.attaType === 'CHALI_ATTA' || String(attaItem?.grainType).includes('CHALI');
          const attaName = isChali ? 'Chali Atta (Coarse)' : 'Roll Atta (Fine)';

          return (
            <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wheat className="w-5 h-5 text-amber-700" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-950">
                    Wheat → Atta Exchange Summary
                  </span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 border border-amber-300 font-mono">
                  Rate: ₹{rate}/kg
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-2.5 bg-white/80 rounded-lg border border-amber-200">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Wheat Received</span>
                  <span className="text-sm sm:text-base font-mono font-bold text-stone-900">
                    {formatKg(wheatQty)}
                  </span>
                  <span className="text-[10px] text-emerald-800 font-semibold block">Grain Inflow</span>
                </div>

                <div className="p-2.5 bg-white/80 rounded-lg border border-amber-200">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Flour Delivered</span>
                  <span className="text-sm sm:text-base font-mono font-bold text-stone-900">
                    {formatKg(attaQty)}
                  </span>
                  <span className="text-[10px] text-amber-800 font-semibold block">{attaName}</span>
                </div>
              </div>

              <div className="p-2.5 bg-white/80 rounded-lg border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Exchange Value</span>
                  <span className="text-xs text-stone-600 font-mono">{formatKg(wheatQty)} × ₹{rate}/kg</span>
                </div>
                <span className="text-base font-mono font-bold text-amber-950">
                  {formatRupees(txn.grossAmount)}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Dedicated Rice -> Atta Settlement Card */}
        {txn.type === 'RICE_ATTA_SETTLEMENT' && (() => {
          const riceItem = txn.items?.find((i) => i.itemType === 'RICE' || i.grainType === 'RATION_RICE');
          const attaItem = txn.items?.find((i) => i.itemType === 'ATTA' || String(i.grainType).includes('ATTA'));
          const cashItem = txn.items?.find((i) => i.itemType === 'CASH');

          const riceQty = riceItem?.quantity ?? 0;
          const riceRate = riceItem?.ratePerUnit ?? 21;
          const riceVal = riceItem?.totalAmount ?? safeMultiply(riceQty, riceRate);

          const attaQty = attaItem?.quantity ?? 0;
          const attaRate = attaItem?.ratePerUnit ?? 40;
          const attaVal = attaItem?.totalAmount ?? safeMultiply(attaQty, attaRate);
          const attaName = attaItem?.attaType === 'CHALI_ATTA' || String(attaItem?.grainType).includes('CHALI')
            ? 'Chali Atta'
            : 'Roll Atta';

          // Settlement = Atta Value - Rice Value
          const isCustomerReceives = txn.settlementDirection === 'CUSTOMER_RECEIVES' || txn.balanceDelta < 0;
          const isCustomerPays = txn.settlementDirection === 'CUSTOMER_PAYS' || txn.balanceDelta > 0;
          const isSettled = txn.settlementDirection === 'SETTLED' || (!isCustomerReceives && !isCustomerPays && txn.netAmount === 0);

          return (
            <div className="bg-sky-50/70 border border-sky-300 rounded-xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-sky-700" />
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-950">
                    Rice → Atta Settlement Summary
                  </span>
                </div>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-200/80 text-sky-900 border border-sky-300 font-mono">
                  Rice Credit Adjusted
                </span>
              </div>

              {/* 2-Column Grain Breakdown */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Rice Details */}
                <div className="p-3 bg-white/90 rounded-xl border border-sky-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-stone-500">Ration Rice</span>
                    <span className="text-[10px] font-mono text-sky-700 font-bold">Inflow (Shop buys)</span>
                  </div>
                  <div className="text-base font-mono font-bold text-stone-900">
                    {formatKg(riceQty)}
                  </div>
                  <div className="text-xs text-stone-600 font-mono flex items-center justify-between pt-1 border-t border-stone-100">
                    <span>Rate: ₹{riceRate}/kg</span>
                    <span className="font-bold text-sky-900">{formatRupees(riceVal)}</span>
                  </div>
                </div>

                {/* Atta Details */}
                <div className="p-3 bg-white/90 rounded-xl border border-amber-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-stone-500">{attaName}</span>
                    <span className="text-[10px] font-mono text-amber-700 font-bold">Outflow (Customer takes)</span>
                  </div>
                  <div className="text-base font-mono font-bold text-stone-900">
                    {formatKg(attaQty)}
                  </div>
                  <div className="text-xs text-stone-600 font-mono flex items-center justify-between pt-1 border-t border-stone-100">
                    <span>Rate: ₹{attaRate}/kg</span>
                    <span className="font-bold text-amber-950">{formatRupees(attaVal)}</span>
                  </div>
                </div>
              </div>

              {/* Prominent Settlement Calculation Card */}
              <div className="p-3.5 bg-white rounded-xl border border-sky-200 shadow-2xs space-y-2">
                <div className="text-xs text-stone-600 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span>RICE CREDIT (Shop owes customer):</span>
                    <span className="font-bold text-sky-900">{formatRupees(riceVal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ATTA BILL (Customer owes shop):</span>
                    <span className="font-bold text-amber-900">{formatRupees(attaVal)}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">
                    Settlement Outcome:
                  </span>
                  <span className={`text-base font-mono font-extrabold ${
                    isCustomerReceives
                      ? 'text-emerald-700'
                      : isCustomerPays
                      ? 'text-rose-700'
                      : 'text-stone-800'
                  }`}>
                    {isCustomerReceives
                      ? `CUSTOMER RECEIVES ${formatRupees(txn.netAmount)}`
                      : isCustomerPays
                      ? `CUSTOMER PAYS ${formatRupees(txn.netAmount)}`
                      : 'SETTLED EXACTLY'}
                  </span>
                </div>
              </div>

              {/* Delayed Cash Payout / Payment Collection Action */}
              {txn.paymentStatus === 'PENDING' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      <span>Cash Payment Pending Completion</span>
                    </div>
                    <p className="text-[11px] text-amber-800">
                      {isCustomerReceives
                        ? `Shop owes ₹${txn.netAmount} cash to customer.`
                        : `Customer owes ₹${txn.netAmount} cash to shop.`}
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleMarkPaymentPaid}
                    className="cursor-pointer shrink-0"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    {isCustomerReceives ? 'Cash Handed Over (Mark Paid)' : 'Cash Collected (Mark Paid)'}
                  </Button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Dedicated Rice -> Cash or Wheat -> Cash Settlement Card */}
        {(txn.type === 'RICE_CASH_SETTLEMENT' || txn.type === 'WHEAT_CASH_SETTLEMENT') && (() => {
          const isRice = txn.type === 'RICE_CASH_SETTLEMENT';
          const grainItem = txn.items?.find((i) =>
            isRice
              ? i.itemType === 'RICE' || i.grainType === 'RATION_RICE'
              : i.itemType === 'WHEAT' || i.grainType === 'WHEAT'
          ) || txn.items?.[0];
          const cashItem = txn.items?.find((i) => i.itemType === 'CASH');

          const grainQty = grainItem?.quantity ?? 0;
          const grainRate = grainItem?.ratePerUnit ?? (isRice ? 21 : 24);
          const grainTotal = grainItem?.totalAmount ?? safeMultiply(grainQty, grainRate);
          const amountPaid = txn.paidAmount ?? cashItem?.totalAmount ?? 0;
          const remainingCredit = Math.abs(txn.balanceDelta ?? 0);
          const isPending = txn.paymentStatus === 'PENDING';
          const isPartial = txn.paymentStatus === 'PARTIAL';

          return (
            <div className={`border rounded-xl p-4 space-y-3.5 ${
              isRice ? 'bg-teal-50/70 border-teal-300' : 'bg-amber-50/70 border-amber-300'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className={`w-5 h-5 ${isRice ? 'text-teal-700' : 'text-amber-700'}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    isRice ? 'text-teal-950' : 'text-amber-950'
                  }`}>
                    {isRice ? 'Rice → Cash Purchase' : 'Wheat → Cash Purchase'}
                  </span>
                </div>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full font-mono border ${
                  isRice
                    ? 'bg-teal-100 text-teal-900 border-teal-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                }`}>
                  Zero Atta Movement
                </span>
              </div>

              {/* 2-Column Grain & Cash Summary */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Grain Intake */}
                <div className="p-3 bg-white/90 rounded-xl border border-stone-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-stone-500">
                      {isRice ? 'Ration Rice' : 'Raw Wheat'}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold">Shop Bought</span>
                  </div>
                  <div className="text-base font-mono font-bold text-stone-900">
                    {formatKg(grainQty)}
                  </div>
                  <div className="text-xs text-stone-600 font-mono flex items-center justify-between pt-1 border-t border-stone-100">
                    <span>Rate: ₹{grainRate}/kg</span>
                    <span className="font-bold text-stone-900">{formatRupees(grainTotal)}</span>
                  </div>
                </div>

                {/* Cash Settlement */}
                <div className="p-3 bg-white/90 rounded-xl border border-stone-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-stone-500">Cash Payout</span>
                    <span className="text-[10px] font-mono text-stone-700 font-bold">
                      {txn.paymentStatus}
                    </span>
                  </div>
                  <div className="text-base font-mono font-bold text-emerald-700">
                    {formatRupees(amountPaid)}
                  </div>
                  <div className="text-xs text-stone-600 font-mono flex items-center justify-between pt-1 border-t border-stone-100">
                    <span>Remaining Due:</span>
                    <span className="font-bold text-rose-800">{formatRupees(remainingCredit)}</span>
                  </div>
                </div>
              </div>

              {/* Prominent Outcome Breakdown */}
              <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-2">
                <div className="text-xs text-stone-600 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span>TOTAL GRAIN VALUE (Shop Owes Customer):</span>
                    <span className="font-bold text-stone-900">{formatRupees(grainTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CASH PAID OUT AT COUNTER:</span>
                    <span className="font-bold text-emerald-700">{formatRupees(amountPaid)}</span>
                  </div>
                  {remainingCredit > 0 && (
                    <div className="flex justify-between text-rose-800 font-bold">
                      <span>CREDITED TO CUSTOMER KHATA (Shop Still Owes):</span>
                      <span>{formatRupees(remainingCredit)}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">
                    Settlement Outcome:
                  </span>
                  <span className="text-base font-mono font-extrabold text-emerald-700">
                    CUSTOMER RECEIVES {formatRupees(grainTotal)}
                  </span>
                </div>
              </div>

              {/* Delayed Cash Payout Action */}
              {(isPending || isPartial) && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      <span>Remaining Cash Handover Pending</span>
                    </div>
                    <p className="text-[11px] text-amber-800">
                      Shop owes ₹{remainingCredit} remaining cash to customer.
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleMarkPaymentPaid}
                    className="cursor-pointer shrink-0"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Hand Over Cash (Mark Paid)
                  </Button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Transaction Line Items */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">
            Items & Quantities
          </h3>

          <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100 text-xs">
            {txn.items && txn.items.length > 0 ? (
              txn.items.map((item, index) => (
                <div key={item.id || index} className="p-3 flex items-center justify-between bg-white">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900">
                        {item.grainType ? String(item.grainType).replace(/_/g, ' ') : item.itemType || 'Item'}
                      </span>
                      {item.direction && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            item.direction === 'IN'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.direction}
                        </span>
                      )}
                    </div>
                    <div className="text-stone-500 text-[11px]">
                      {formatKg(item.quantity)} {item.ratePerUnit > 0 ? `@ ₹${item.ratePerUnit}/${item.unit}` : ''}
                      {item.notes && <span> · {item.notes}</span>}
                    </div>
                  </div>

                  <div className="font-mono font-bold text-stone-900 text-sm">
                    {item.totalAmount > 0 ? formatRupees(item.totalAmount) : '-'}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-3 text-stone-500 text-center">No line items recorded</div>
            )}
          </div>
        </div>

        {/* Settlement Breakdown Card */}
        <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-3 text-xs">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
            Financial Settlement
          </h3>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-stone-600">Gross Amount</span>
              <span className="font-mono font-medium text-stone-900">{formatRupees(txn.grossAmount)}</span>
            </div>

            {txn.paidAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Paid Amount (Cash)</span>
                <span className="font-mono font-medium text-emerald-800">-{formatRupees(txn.paidAmount)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-stone-200 flex items-center justify-between font-bold text-sm">
              <span className="text-stone-900">Settlement Delta</span>
              <span
                className={`font-mono ${
                  txn.balanceDelta < 0
                    ? 'text-emerald-800'
                    : txn.balanceDelta > 0
                    ? 'text-rose-800'
                    : 'text-stone-900'
                }`}
              >
                {txn.balanceDelta < 0
                  ? `Customer receives ${formatRupees(Math.abs(txn.balanceDelta))}`
                  : txn.balanceDelta > 0
                  ? `Customer owes ${formatRupees(txn.balanceDelta)}`
                  : 'Fully Settled (₹0)'}
              </span>
            </div>
          </div>

          {/* Overpayment Breakdown (Customer paid more than bill) */}
          {txn.paidAmount > txn.netAmount && (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300 space-y-1 text-xs text-emerald-950">
              <div className="font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  Overpayment Credited to Khata
                </span>
                <span className="font-mono text-emerald-800 font-bold">
                  +{formatRupees(txn.paidAmount - txn.netAmount)}
                </span>
              </div>
              <div className="text-[11px] text-emerald-800 space-y-0.5 font-mono pt-1">
                <div className="flex justify-between">
                  <span>Bill Cleared:</span>
                  <span>{formatRupees(txn.netAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer Handed:</span>
                  <span>{formatRupees(txn.paidAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-900 border-t border-emerald-200/80 pt-0.5">
                  <span>Khata Advance Balance Added:</span>
                  <span>+{formatRupees(txn.paidAmount - txn.netAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Partial Payment / Due Breakdown */}
          {txn.balanceDelta > 0 && (
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 space-y-2 text-xs text-rose-950">
              <div className="font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-rose-700" />
                  Pending Bill Due
                </span>
                <span className="font-mono text-rose-800 font-bold">
                  {formatRupees(txn.balanceDelta)} Due
                </span>
              </div>
              <p className="text-[11px] text-rose-800">
                This transaction left a balance of ₹{txn.balanceDelta} that was recorded onto the customer khata.
              </p>
              {customer && (
                <div className="pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Banknote className="w-3.5 h-3.5" />}
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="w-full bg-rose-700 hover:bg-rose-800 text-white"
                  >
                    Collect Due Payment ({formatRupees(txn.balanceDelta)})
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* LINKED PAYMENT RECEIPTS */}
        {linkedPayments.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-stone-100">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-emerald-800" />
              Linked Payment Receipts ({linkedPayments.length})
            </span>

            <div className="space-y-1.5">
              {linkedPayments.map((p) => (
                <div
                  key={p.id}
                  className="p-3 bg-white rounded-xl border border-stone-200 text-xs flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded border border-stone-200 text-[11px]">
                        {p.receiptNumber}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {p.paymentMode}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      {formatDate(p.createdAt)} {p.receivedByName && `· By ${p.receivedByName}`}
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-bold text-emerald-700 text-sm">
                      {formatRupees(p.amount)}
                    </span>
                    {p.advanceCreditCreated > 0 && (
                      <span className="block text-[10px] text-emerald-800">
                        (+₹{p.advanceCreditCreated} credit)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes & Description */}
        {(txn.notes || txn.description) && (
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
              Notes / Audit Remarks
            </span>
            <p>{txn.notes || txn.description}</p>
          </div>
        )}

        {/* LINKED LEDGER ENTRIES FOUNDATION */}
        {linkedLedgerEntries.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-stone-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-800" />
                Linked Ledger Foundation Entries ({linkedLedgerEntries.length})
              </span>
            </div>

            <div className="space-y-1.5">
              {linkedLedgerEntries.map((le) => (
                <div
                  key={le.id}
                  className="p-2.5 bg-stone-50 rounded-lg border border-stone-200 text-xs flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-stone-900 block">
                      {le.description}
                    </span>
                    <span className="text-[10px] font-mono text-stone-500">
                      Type: {le.entryType} · Direction: {le.direction} · Status: {le.status}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-stone-900">
                    {le.entryType === 'CASH'
                      ? formatRupees(le.amount)
                      : `${le.quantity} ${le.unit}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AUDIT LOG TRAIL */}
        {auditLogs.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-stone-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                Audit Trail & History ({auditLogs.length})
              </span>
              <span className="text-[11px] text-stone-500 font-mono">
                Immutable Event Log
              </span>
            </div>

            <div className="space-y-2">
              {auditLogs.map((log) => {
                const isExpanded = expandedAuditLogId === log.id;
                const isCreation = log.action === AuditAction.TRANSACTION_CREATED;
                const isCorrection =
                  log.action === AuditAction.TRANSACTION_CORRECTED ||
                  log.action === AuditAction.CORRECTION_COMPENSATING_CREATED;
                const isReversal =
                  log.action === AuditAction.TRANSACTION_REVERSED ||
                  log.action === AuditAction.REVERSAL_COMPENSATING_CREATED;

                return (
                  <div
                    key={log.id}
                    className={`p-3 rounded-xl border transition-colors ${
                      isReversal
                        ? 'bg-rose-50/60 border-rose-200'
                        : isCorrection
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-stone-50 border-stone-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md font-mono ${
                            isReversal
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : isCorrection
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {log.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-stone-600 font-medium">
                          by <strong className="text-stone-900">{log.actorName}</strong> ({log.actorRole})
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-500 font-mono">
                        {new Date(log.timestamp).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {log.reason && (
                      <div className="mt-2 text-xs text-stone-700 bg-white/80 p-2 rounded-lg border border-stone-200/80">
                        <span className="text-[10px] uppercase font-bold text-stone-500 block mb-0.5">
                          Reason / Note:
                        </span>
                        <span className="italic">&ldquo;{log.reason}&rdquo;</span>
                      </div>
                    )}

                    {/* Expandable State Diff Snapshot */}
                    {(log.previousState || log.newState) && (
                      <div className="mt-2 pt-2 border-t border-stone-200/60">
                        <button
                          type="button"
                          onClick={() => setExpandedAuditLogId(isExpanded ? null : log.id)}
                          className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1 cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                          <span>{isExpanded ? 'Hide State Details' : 'View State Details'}</span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                            {log.previousState && (
                              <div className="p-2.5 bg-white rounded-lg border border-stone-200 overflow-x-auto">
                                <span className="text-[10px] uppercase font-bold text-stone-500 block mb-1">
                                  Previous State
                                </span>
                                <pre className="text-stone-700 whitespace-pre-wrap break-words">
                                  {JSON.stringify(log.previousState, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.newState && (
                              <div className="p-2.5 bg-white rounded-lg border border-stone-200 overflow-x-auto">
                                <span className="text-[10px] uppercase font-bold text-stone-500 block mb-1">
                                  New State
                                </span>
                                <pre className="text-stone-700 whitespace-pre-wrap break-words">
                                  {JSON.stringify(log.newState, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* OWNER / AUTHORIZED ACTIONS: CORRECTION & REVERSAL */}
        {(canCorrect || canReverse) && (
          <div className="pt-4 border-t border-stone-200 space-y-2">
            {txn.status === TransactionStatus.REVERSED ? (
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-2 text-xs text-stone-500">
                <Info className="w-4 h-4 text-stone-400 shrink-0" />
                <span>
                  This transaction is permanently reversed. No further corrections or reversals can be performed.
                </span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                {canCorrect && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<SlidersHorizontal className="w-4 h-4 text-amber-600" />}
                    onClick={handleOpenCorrectionModal}
                    className="w-full sm:w-auto hover:bg-amber-50 border-amber-300 text-amber-950 font-semibold"
                  >
                    Flag & Correct Transaction
                  </Button>
                )}

                {canReverse && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<RotateCcw className="w-4 h-4 text-rose-600" />}
                    onClick={() => {
                      setModalError(null);
                      setReversalReason('');
                      setIsReversalModalOpen(true);
                    }}
                    className="w-full sm:w-auto text-rose-800 hover:bg-rose-50 border-rose-300 font-semibold"
                  >
                    Reverse Transaction
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CORRECTION MODAL */}
      <Modal
        isOpen={isCorrectionModalOpen}
        onClose={() => !isSubmittingAction && setIsCorrectionModalOpen(false)}
        title="Flag & Correct Transaction"
      >
        <div className="space-y-4 font-sans text-xs">
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-amber-950 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Non-Destructive Correction</span>
            </div>
            <p className="text-[11px] text-stone-700">
              Chakki Ledger never silently overwrites financial history. Confirming this will flag transaction{' '}
              <strong>{txn.transactionNumber}</strong> as CORRECTED, and automatically generate a compensating entry{' '}
              to reconcile customer ledger balances.
            </p>
          </div>

          {/* Item Line Edits */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-800 uppercase tracking-wide text-[11px]">
                Adjust Line Items
              </span>
              <span className="text-[10px] text-stone-500 font-mono">
                Update recorded quantities or rates
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {correctionItems.map((item, idx) => (
                <div
                  key={item.itemId || idx}
                  className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-stone-900">
                    <span>{item.label}</span>
                    <span className="text-[10px] font-mono text-stone-500">
                      Original: {item.originalQuantity} {item.unit} @ ₹{item.originalRate}/{item.unit}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-stone-600 block mb-1">
                        New Quantity ({item.unit}) *
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={item.newQuantity}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setCorrectionItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, newQuantity: val } : it))
                          );
                        }}
                        className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold text-stone-900 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-stone-600 block mb-1">
                        New Rate (₹/{item.unit}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.newRate}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setCorrectionItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, newRate: val } : it))
                          );
                        }}
                        className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold text-stone-900 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Correction Impact Calculation */}
          {correctionImpact && (
            <div className="p-3 bg-white rounded-xl border border-stone-300 shadow-2xs space-y-2">
              <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wide block">
                Projected Impact Summary
              </span>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="p-2 bg-stone-50 rounded-lg">
                  <span className="text-[10px] text-stone-500 block">Original Gross</span>
                  <span className="font-bold text-stone-800">
                    {formatRupees(correctionImpact.originalAmount)}
                  </span>
                </div>
                <div className="p-2 bg-stone-50 rounded-lg">
                  <span className="text-[10px] text-stone-500 block">New Gross</span>
                  <span className="font-bold text-stone-900">
                    {formatRupees(correctionImpact.correctedAmount)}
                  </span>
                </div>
              </div>

              <div className="pt-1 border-t border-stone-100 flex items-center justify-between text-xs">
                <span className="font-medium text-stone-600">Financial Difference:</span>
                <span
                  className={`font-mono font-bold ${
                    correctionImpact.deltaAmount > 0
                      ? 'text-rose-700'
                      : correctionImpact.deltaAmount < 0
                      ? 'text-emerald-700'
                      : 'text-stone-700'
                  }`}
                >
                  {correctionImpact.deltaAmount > 0 ? '+' : ''}
                  {formatRupees(correctionImpact.deltaAmount)}
                </span>
              </div>
            </div>
          )}

          {/* Mandatory Reason */}
          <div>
            <label className="font-bold text-stone-800 block mb-1">
              Mandatory Correction Reason *
            </label>
            <textarea
              rows={3}
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="Explain the reason for this correction (e.g. wheat scale discrepancy, entered 60kg instead of 50kg)..."
              className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:ring-2 focus:ring-amber-500"
            />
            <span className="text-[10px] text-stone-400 mt-1 block">
              Minimum 4 characters required. This note will be recorded permanently in the audit trail.
            </span>
          </div>

          {modalError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCorrectionModalOpen(false)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePerformCorrection}
              disabled={isSubmittingAction}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {isSubmittingAction ? 'Applying Correction...' : 'Confirm & Post Correction'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* REVERSAL MODAL */}
      <Modal
        isOpen={isReversalModalOpen}
        onClose={() => !isSubmittingAction && setIsReversalModalOpen(false)}
        title="Transaction Reversal"
      >
        <div className="space-y-4 font-sans text-xs">
          <div className="bg-rose-50/90 border border-rose-200 rounded-xl p-3 text-rose-950 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-rose-900">
              <RotateCcw className="w-4 h-4 text-rose-700 shrink-0" />
              <span>Permanent Non-Destructive Reversal</span>
            </div>
            <p className="text-[11px] text-stone-700">
              Reversing transaction <strong>{txn.transactionNumber}</strong> will safely set its status to{' '}
              <strong className="text-rose-900">REVERSED</strong> and post an atomic compensating reversal entry.{' '}
              No record is ever deleted. Customer ledger balances and inventory accounts will be safely neutralized.
            </p>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1 font-mono text-xs">
            <div className="flex justify-between text-stone-600">
              <span>Transaction Type:</span>
              <span className="font-bold text-stone-900">{txn.type}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Gross Amount to Neutralize:</span>
              <span className="font-bold text-rose-800">{formatRupees(txn.totalAmount)}</span>
            </div>
          </div>

          <div>
            <label className="font-bold text-stone-800 block mb-1">
              Mandatory Reversal Reason *
            </label>
            <textarea
              rows={3}
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="State the reason for voiding or reversing this transaction (e.g. entered under wrong customer, customer cancelled trade)..."
              className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:ring-2 focus:ring-rose-700"
            />
            <span className="text-[10px] text-stone-400 mt-1 block">
              Minimum 4 characters required. Stored permanently in the immutable audit log.
            </span>
          </div>

          {modalError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReversalModalOpen(false)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePerformReversal}
              disabled={isSubmittingAction}
              className="bg-rose-800 hover:bg-rose-900 text-white font-semibold"
            >
              {isSubmittingAction ? 'Reversing...' : 'Confirm Reversal'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* QUICK PAYMENT / SETTLEMENT MODAL */}
      {customer && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          customer={customer}
          initialAction={PaymentType.RECEIVE_PAYMENT}
          initialAmount={txn.balanceDelta > 0 ? txn.balanceDelta : undefined}
          targetTransactionId={txn.id}
          onPaymentSuccess={(result) => {
            setActionSuccess(
              `Payment receipt ${result.payment.receiptNumber} recorded! Applied ₹${result.breakdown.appliedToDues} to dues${
                result.breakdown.advanceCreditAdded > 0 ? `, added ₹${result.breakdown.advanceCreditAdded} to advance credit` : ''
              }.`
            );
            setIsPaymentModalOpen(false);
            const refreshed = TransactionService.getTransactionById(txn.id);
            if (refreshed) {
              setTxn({ ...refreshed });
            }
          }}
        />
      )}
    </div>
  );
};
