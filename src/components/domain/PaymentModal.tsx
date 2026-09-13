import React, { useState, useMemo, useEffect } from 'react';
import { Customer, PaymentMode, PaymentType, UserRole } from '../../types';
import { useAuth } from '../../modules/auth/AuthContext';
import { PaymentService, SettlementPreview } from '../../services/payment.service';
import { LedgerService } from '../../services/ledger.service';
import { formatRupees, roundCurrency } from '../../utils/precision';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  Banknote,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  QrCode,
  Building2,
  HelpCircle,
} from 'lucide-react';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  initialAction?: PaymentType;
  targetTransactionId?: string;
  onPaymentSuccess?: (result: any) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  customer,
  initialAction = PaymentType.RECEIVE_PAYMENT,
  targetTransactionId,
  onPaymentSuccess,
}) => {
  const { user } = useAuth();

  // Fresh live balances for this customer
  const balances = useMemo(() => {
    return LedgerService.calculateCustomerBalances(customer.id);
  }, [customer.id, isOpen]);

  const [actionType, setActionType] = useState<PaymentType>(initialAction);
  const [amountStr, setAmountStr] = useState<string>('');
  const [mode, setMode] = useState<PaymentMode>(PaymentMode.CASH);
  const [selectedTxId, setSelectedTxId] = useState<string | undefined>(targetTransactionId);
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  // Available pending transactions with dues
  const pendingTransactions = useMemo(() => {
    return PaymentService.getPendingTransactions(customer.id);
  }, [customer.id, isOpen]);

  // Set default initial amount based on action
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessResult(null);
      setActionType(initialAction);
      setSelectedTxId(targetTransactionId);

      if (initialAction === PaymentType.RECEIVE_PAYMENT || initialAction === PaymentType.SETTLE_DUE) {
        if (targetTransactionId) {
          const target = pendingTransactions.find((t) => t.id === targetTransactionId);
          if (target && target.balanceDelta > 0) {
            setAmountStr(String(target.balanceDelta));
          } else if (balances.cashDueAmount > 0) {
            setAmountStr(String(balances.cashDueAmount));
          }
        } else if (balances.cashDueAmount > 0) {
          setAmountStr(String(balances.cashDueAmount));
        } else {
          setAmountStr('');
        }
      } else if (initialAction === PaymentType.PAY_CUSTOMER) {
        if (balances.cashCreditAmount > 0) {
          setAmountStr(String(balances.cashCreditAmount));
        } else {
          setAmountStr('');
        }
      } else if (initialAction === PaymentType.APPLY_CREDIT) {
        const maxOffset = Math.min(balances.cashCreditAmount, balances.cashDueAmount);
        setAmountStr(maxOffset > 0 ? String(maxOffset) : '');
      }
    }
  }, [isOpen, initialAction, targetTransactionId, balances.cashDueAmount, balances.cashCreditAmount]);

  const numericAmount = parseFloat(amountStr) || 0;

  // Real-time server-authoritative calculation
  const preview: SettlementPreview = useMemo(() => {
    return PaymentService.calculateSettlement(
      customer.id,
      actionType,
      numericAmount,
      selectedTxId
    );
  }, [customer.id, actionType, numericAmount, selectedTxId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMessage(null);

    if (!preview.isValid) {
      setErrorMessage(preview.error || 'Please correct the payment details');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = PaymentService.recordPayment(
        {
          customerId: customer.id,
          actionType,
          amount: numericAmount,
          mode,
          targetTransactionId: selectedTxId,
          referenceNo: referenceNo.trim() || undefined,
          notes: notes.trim() || undefined,
          idempotencyKey: `pmt-${customer.id}-${Date.now()}`,
        },
        user
      );

      if (result.success) {
        setSuccessResult(result);
        if (onPaymentSuccess) {
          onPaymentSuccess(result);
        }
      } else {
        setErrorMessage(result.error || result.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Khata Payment & Settlement"
      subtitle={`Customer: ${customer.name} (${customer.customerCode || customer.id})`}
      maxWidth="lg"
    >
      {successResult ? (
        <div className="space-y-4 font-sans text-center py-2">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-300">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-stone-900">Payment Recorded Successfully</h3>
            <p className="text-xs text-stone-600 font-mono">
              Receipt No: <span className="font-bold text-stone-900">{successResult.payment?.receiptNumber}</span>
            </p>
          </div>

          {/* Breakdown Card */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 text-xs text-left space-y-2">
            <div className="flex justify-between items-center text-stone-600">
              <span>Amount Processed</span>
              <span className="font-mono font-bold text-stone-900">{formatRupees(numericAmount)}</span>
            </div>
            {preview.amountAppliedToDue > 0 && (
              <div className="flex justify-between items-center text-stone-600">
                <span>Applied to Dues</span>
                <span className="font-mono font-semibold text-emerald-800">{formatRupees(preview.amountAppliedToDue)}</span>
              </div>
            )}
            {preview.creditCreated > 0 && (
              <div className="flex justify-between items-center bg-emerald-50 p-2 rounded-lg border border-emerald-200 text-emerald-900">
                <span>Customer Credit Created</span>
                <span className="font-mono font-bold">+{formatRupees(preview.creditCreated)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-stone-200 flex justify-between items-center">
              <span className="text-stone-700 font-medium">Updated Cash Due</span>
              <span className="font-mono font-bold text-stone-900">{formatRupees(preview.newDue)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-stone-700 font-medium">Updated Customer Credit</span>
              <span className="font-mono font-bold text-emerald-700">{formatRupees(preview.newCredit)}</span>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={onClose}
              className="w-full"
            >
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 font-sans text-left">
          {/* Current Khata Status Bar */}
          <div className="grid grid-cols-2 gap-2 bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-500 block">Current Cash Due</span>
              <span className={`text-base font-mono font-bold ${balances.cashDueAmount > 0 ? 'text-rose-700' : 'text-stone-800'}`}>
                {formatRupees(balances.cashDueAmount)}
              </span>
              <span className="text-[10px] text-stone-500 block">Customer owes shop</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-500 block">Current Credit</span>
              <span className={`text-base font-mono font-bold ${balances.cashCreditAmount > 0 ? 'text-emerald-700' : 'text-stone-800'}`}>
                {formatRupees(balances.cashCreditAmount)}
              </span>
              <span className="text-[10px] text-stone-500 block">Shop owes customer</span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Type Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
              Settlement Action
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setActionType(PaymentType.RECEIVE_PAYMENT)}
                className={`p-2.5 rounded-xl border font-medium flex items-center gap-1.5 transition-all text-left cursor-pointer ${
                  actionType === PaymentType.RECEIVE_PAYMENT
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                    : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4 shrink-0" />
                <div>
                  <span className="block font-bold text-xs">Receive Payment</span>
                  <span className={`text-[10px] block ${actionType === PaymentType.RECEIVE_PAYMENT ? 'text-emerald-200' : 'text-stone-500'}`}>
                    Customer pays cash
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActionType(PaymentType.PAY_CUSTOMER)}
                className={`p-2.5 rounded-xl border font-medium flex items-center gap-1.5 transition-all text-left cursor-pointer ${
                  actionType === PaymentType.PAY_CUSTOMER
                    ? 'bg-amber-800 text-white border-amber-900 shadow-2xs'
                    : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 shrink-0" />
                <div>
                  <span className="block font-bold text-xs">Pay Customer</span>
                  <span className={`text-[10px] block ${actionType === PaymentType.PAY_CUSTOMER ? 'text-amber-200' : 'text-stone-500'}`}>
                    Cash from credit
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActionType(PaymentType.APPLY_CREDIT)}
                className={`p-2.5 rounded-xl border font-medium flex items-center gap-1.5 transition-all text-left cursor-pointer col-span-2 sm:col-span-1 ${
                  actionType === PaymentType.APPLY_CREDIT
                    ? 'bg-stone-900 text-white border-stone-950 shadow-2xs'
                    : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                }`}
              >
                <RefreshCw className="w-4 h-4 shrink-0" />
                <div>
                  <span className="block font-bold text-xs">Apply Credit</span>
                  <span className={`text-[10px] block ${actionType === PaymentType.APPLY_CREDIT ? 'text-stone-300' : 'text-stone-500'}`}>
                    Offset due with credit
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Target Transaction (Optional) */}
          {pendingTransactions.length > 0 && actionType === PaymentType.RECEIVE_PAYMENT && (
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-stone-700">
                Link to Specific Bill (Optional)
              </label>
              <select
                value={selectedTxId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedTxId(val || undefined);
                  if (val) {
                    const found = pendingTransactions.find((t) => t.id === val);
                    if (found && found.balanceDelta > 0) {
                      setAmountStr(String(found.balanceDelta));
                    }
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
              >
                <option value="">General Account Settlement (Earliest dues first)</option>
                {pendingTransactions.map((tx) => (
                  <option key={tx.id} value={tx.id}>
                    {tx.transactionNumber} - Due {formatRupees(tx.balanceDelta)} ({tx.type.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Amount Input with Quick Presets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-800">
                Amount (₹) <span className="text-red-600">*</span>
              </label>
              {actionType === PaymentType.RECEIVE_PAYMENT && balances.cashDueAmount > 0 && (
                <span className="text-[11px] text-stone-500">
                  Total Due: <strong className="font-mono text-stone-900">{formatRupees(balances.cashDueAmount)}</strong>
                </span>
              )}
              {actionType === PaymentType.PAY_CUSTOMER && balances.cashCreditAmount > 0 && (
                <span className="text-[11px] text-stone-500">
                  Available Credit: <strong className="font-mono text-emerald-800">{formatRupees(balances.cashCreditAmount)}</strong>
                </span>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2.5 text-stone-400 font-bold text-sm">₹</span>
              <input
                type="number"
                step="1"
                min="1"
                required
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0"
                className="w-full pl-7 pr-3 py-2 text-sm sm:text-base font-mono font-bold bg-white border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {actionType === PaymentType.RECEIVE_PAYMENT && balances.cashDueAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setAmountStr(String(balances.cashDueAmount))}
                  className="px-2 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-md text-[11px] font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  Full Due (₹{balances.cashDueAmount})
                </button>
              )}
              {actionType === PaymentType.PAY_CUSTOMER && balances.cashCreditAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setAmountStr(String(balances.cashCreditAmount))}
                  className="px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[11px] font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  Full Credit (₹{balances.cashCreditAmount})
                </button>
              )}
              {actionType === PaymentType.APPLY_CREDIT && (
                <button
                  type="button"
                  onClick={() => {
                    const maxOffset = Math.min(balances.cashCreditAmount, balances.cashDueAmount);
                    setAmountStr(String(maxOffset));
                  }}
                  className="px-2 py-1 bg-stone-100 text-stone-800 border border-stone-300 rounded-md text-[11px] font-semibold hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  Max Offset (₹{Math.min(balances.cashCreditAmount, balances.cashDueAmount)})
                </button>
              )}
              {[100, 200, 500, 1000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmountStr(String(preset))}
                  className="px-2 py-1 bg-stone-100 text-stone-700 border border-stone-200 rounded-md text-[11px] font-medium hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  ₹{preset}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Mode Selector */}
          {actionType !== PaymentType.APPLY_CREDIT && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-stone-700">
                Payment Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { mode: PaymentMode.CASH, label: 'Cash', icon: Banknote },
                  { mode: PaymentMode.UPI, label: 'UPI / QR', icon: QrCode },
                  { mode: PaymentMode.BANK_TRANSFER, label: 'Bank', icon: Building2 },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = mode === item.mode;
                  return (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => setMode(item.mode)}
                      className={`p-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reference Number for UPI/Bank */}
          {mode !== PaymentMode.CASH && actionType !== PaymentType.APPLY_CREDIT && (
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-stone-700">
                Reference / UTR Number
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. UPI Ref / Bank Txn ID"
                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-700">
              Note (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid at mill counter, cleared previous balance"
              className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            />
          </div>

          {/* LIVE SETTLEMENT PREVIEW BOX */}
          {numericAmount > 0 && (
            <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-700 uppercase tracking-wider text-[10px]">
                  Settlement Breakdown Preview
                </span>
                <span className="font-mono font-bold text-stone-900">
                  {formatRupees(numericAmount)}
                </span>
              </div>

              <div className="space-y-1 text-stone-600">
                {preview.amountAppliedToDue > 0 && (
                  <div className="flex justify-between items-center">
                    <span>Applied to reduce dues</span>
                    <span className="font-mono font-semibold text-stone-900">
                      -{formatRupees(preview.amountAppliedToDue)}
                    </span>
                  </div>
                )}

                {/* Overpayment Highlight Badge */}
                {preview.creditCreated > 0 && (
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 flex justify-between items-center text-emerald-900 font-medium">
                    <div>
                      <span className="font-bold block">Overpayment Credit</span>
                      <span className="text-[10px] text-emerald-700 block">
                        Will be stored as customer advance
                      </span>
                    </div>
                    <span className="font-mono font-bold text-sm text-emerald-800">
                      +{formatRupees(preview.creditCreated)}
                    </span>
                  </div>
                )}

                {preview.payoutAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span>Cash handed over to customer</span>
                    <span className="font-mono font-semibold text-amber-900">
                      {formatRupees(preview.payoutAmount)}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-stone-200 flex justify-between items-center font-medium">
                  <span>Customer Due after this:</span>
                  <span className={`font-mono font-bold ${preview.newDue > 0 ? 'text-rose-700' : 'text-stone-700'}`}>
                    {formatRupees(preview.newDue)}
                  </span>
                </div>

                <div className="flex justify-between items-center font-medium">
                  <span>Customer Credit after this:</span>
                  <span className={`font-mono font-bold ${preview.newCredit > 0 ? 'text-emerald-700' : 'text-stone-700'}`}>
                    {formatRupees(preview.newCredit)}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-stone-500 italic pt-1 border-t border-stone-200/60">
                {preview.summaryText}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || numericAmount <= 0 || !preview.isValid}
              className="flex-1"
            >
              {isSubmitting ? 'Recording...' : 'Confirm & Save'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
