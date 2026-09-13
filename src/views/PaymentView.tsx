import React, { useState, useMemo, useEffect } from 'react';
import { Customer, PaymentMode, PaymentType, UserRole } from '../types';
import { useAuth } from '../modules/auth/AuthContext';
import { dbRepository } from '../db/in-memory-db';
import { PaymentService, SettlementPreview } from '../services/payment.service';
import { LedgerService } from '../services/ledger.service';
import { formatRupees, roundCurrency } from '../utils/precision';
import { Button } from '../components/ui/Button';
import {
  ArrowLeft,
  Search,
  User,
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
  Phone,
  FileText,
  Calendar,
  Layers,
} from 'lucide-react';

export interface PaymentViewProps {
  onNavigate: (path: string) => void;
  initialCustomerId?: string;
  initialAction?: PaymentType;
  initialTransactionId?: string;
}

export const PaymentView: React.FC<PaymentViewProps> = ({
  onNavigate,
  initialCustomerId,
  initialAction = PaymentType.RECEIVE_PAYMENT,
  initialTransactionId,
}) => {
  const { user } = useAuth();

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(() => {
    if (initialCustomerId) {
      return dbRepository.getCustomerById(initialCustomerId);
    }
    return undefined;
  });

  const [customerSearch, setCustomerSearch] = useState('');
  const [actionType, setActionType] = useState<PaymentType>(initialAction);
  const [amountStr, setAmountStr] = useState<string>('');
  const [mode, setMode] = useState<PaymentMode>(PaymentMode.CASH);
  const [selectedTxId, setSelectedTxId] = useState<string | undefined>(initialTransactionId);
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  // All active customers for selection
  const allCustomers = useMemo(() => {
    return dbRepository.getCustomers().filter((c) => c.isActive !== false);
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return allCustomers.slice(0, 15);
    const q = customerSearch.toLowerCase().trim();
    return allCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.customerCode && c.customerCode.toLowerCase().includes(q)) ||
        (c.villageOrArea && c.villageOrArea.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [allCustomers, customerSearch]);

  // Derived balances for selected customer
  const balances = useMemo(() => {
    if (!selectedCustomer) return { cashDueAmount: 0, cashCreditAmount: 0 };
    return LedgerService.calculateCustomerBalances(selectedCustomer.id);
  }, [selectedCustomer, successResult]);

  // Pending transactions with dues for selected customer
  const pendingTransactions = useMemo(() => {
    if (!selectedCustomer) return [];
    return PaymentService.getPendingTransactions(selectedCustomer.id);
  }, [selectedCustomer, successResult]);

  // Auto-populate default amount when customer or action changes
  useEffect(() => {
    if (selectedCustomer) {
      if (actionType === PaymentType.RECEIVE_PAYMENT || actionType === PaymentType.SETTLE_DUE) {
        if (selectedTxId) {
          const target = pendingTransactions.find((t) => t.id === selectedTxId);
          if (target && target.balanceDelta > 0) {
            setAmountStr(String(target.balanceDelta));
          } else if (balances.cashDueAmount > 0) {
            setAmountStr(String(balances.cashDueAmount));
          }
        } else if (balances.cashDueAmount > 0) {
          setAmountStr(String(balances.cashDueAmount));
        }
      } else if (actionType === PaymentType.PAY_CUSTOMER) {
        if (balances.cashCreditAmount > 0) {
          setAmountStr(String(balances.cashCreditAmount));
        }
      } else if (actionType === PaymentType.APPLY_CREDIT) {
        const maxOffset = Math.min(balances.cashCreditAmount, balances.cashDueAmount);
        setAmountStr(maxOffset > 0 ? String(maxOffset) : '');
      }
    }
  }, [selectedCustomer, actionType, selectedTxId, balances.cashDueAmount, balances.cashCreditAmount]);

  const numericAmount = parseFloat(amountStr) || 0;

  // Real-time server authoritative settlement preview
  const preview: SettlementPreview = useMemo(() => {
    if (!selectedCustomer) {
      return {
        currentDue: 0,
        currentCredit: 0,
        amountAppliedToDue: 0,
        creditCreated: 0,
        payoutAmount: 0,
        newDue: 0,
        newCredit: 0,
        isValid: false,
        summaryText: 'Select a customer to calculate settlement',
      };
    }
    return PaymentService.calculateSettlement(
      selectedCustomer.id,
      actionType,
      numericAmount,
      selectedTxId
    );
  }, [selectedCustomer, actionType, numericAmount, selectedTxId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCustomer) return;
    setErrorMessage(null);

    if (!preview.isValid) {
      setErrorMessage(preview.error || 'Please correct the payment parameters');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = PaymentService.recordPayment(
        {
          customerId: selectedCustomer.id,
          actionType,
          amount: numericAmount,
          mode,
          targetTransactionId: selectedTxId,
          referenceNo: referenceNo.trim() || undefined,
          notes: notes.trim() || undefined,
          idempotencyKey: `pmt-${selectedCustomer.id}-${Date.now()}`,
        },
        user
      );

      if (result.success) {
        setSuccessResult(result);
      } else {
        setErrorMessage(result.error || result.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment execution failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS RECEIPT VIEW
  if (successResult) {
    const payment = successResult.payment;
    return (
      <div className="space-y-4 font-sans max-w-lg mx-auto pb-10">
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-300">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Payment Settled
            </span>
            <h1 className="text-xl font-bold text-stone-900 pt-1">
              {formatRupees(payment?.amount || numericAmount)}
            </h1>
            <p className="text-xs font-mono text-stone-500">
              Receipt No: <strong className="text-stone-800">{payment?.receiptNumber}</strong>
            </p>
          </div>

          {/* Detailed Receipt Card */}
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 text-xs text-left space-y-2.5">
            <div className="flex justify-between items-center text-stone-600">
              <span>Customer</span>
              <span className="font-bold text-stone-900">{selectedCustomer?.name}</span>
            </div>
            <div className="flex justify-between items-center text-stone-600">
              <span>Payment Type</span>
              <span className="font-semibold text-stone-900">{actionType.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex justify-between items-center text-stone-600">
              <span>Payment Mode</span>
              <span className="font-mono font-medium text-stone-900">{mode}</span>
            </div>
            {payment?.referenceNo && (
              <div className="flex justify-between items-center text-stone-600">
                <span>Reference / UTR</span>
                <span className="font-mono text-stone-900">{payment.referenceNo}</span>
              </div>
            )}

            <div className="pt-2 border-t border-stone-200 space-y-1.5">
              {preview.amountAppliedToDue > 0 && (
                <div className="flex justify-between items-center text-stone-600">
                  <span>Applied to Bill Dues</span>
                  <span className="font-mono font-semibold text-emerald-800">
                    {formatRupees(preview.amountAppliedToDue)}
                  </span>
                </div>
              )}

              {preview.creditCreated > 0 && (
                <div className="p-2 bg-emerald-100/70 border border-emerald-300 rounded-lg flex justify-between items-center text-emerald-950 font-bold">
                  <span>Advance Credit Created</span>
                  <span className="font-mono text-sm">+{formatRupees(preview.creditCreated)}</span>
                </div>
              )}

              {preview.payoutAmount > 0 && (
                <div className="flex justify-between items-center text-stone-600">
                  <span>Cash Paid to Customer</span>
                  <span className="font-mono font-bold text-amber-900">
                    {formatRupees(preview.payoutAmount)}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-stone-200 space-y-1 font-medium">
              <div className="flex justify-between items-center">
                <span className="text-stone-600">Remaining Customer Due</span>
                <span className="font-mono font-bold text-stone-900">{formatRupees(preview.newDue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-600">Remaining Customer Credit</span>
                <span className="font-mono font-bold text-emerald-700">{formatRupees(preview.newCredit)}</span>
              </div>
            </div>
          </div>

          {/* Navigation Action Buttons */}
          <div className="space-y-2 pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate(`/app/customers/${selectedCustomer?.id}`)}
              className="w-full"
            >
              View Customer Ledger & Khata
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSuccessResult(null);
                setAmountStr('');
                setNotes('');
                setReferenceNo('');
              }}
              className="w-full"
            >
              Record Another Payment
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans max-w-xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (selectedCustomer) {
              onNavigate(`/app/customers/${selectedCustomer.id}`);
            } else {
              onNavigate('/app/customers');
            }
          }}
          className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{selectedCustomer ? `Back to ${selectedCustomer.name}` : 'Back to Customers'}</span>
        </button>

        <span className="text-xs font-mono font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
          Khata Settlement
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-2xs space-y-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-stone-900">
            Customer Credit & Payment Settlement
          </h1>
          <p className="text-xs text-stone-500">
            Manage overpayments, partial bills, advance credit, and cash settlements.
          </p>
        </div>

        {/* STEP 1: Select Customer (if not selected) */}
        {!selectedCustomer ? (
          <div className="space-y-3 pt-1">
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
              Step 1: Select Customer
            </label>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search by customer name, phone, or code..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100 max-h-72 overflow-y-auto">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((c) => {
                  const b = LedgerService.calculateCustomerBalances(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCustomer(c)}
                      className="w-full p-3 flex items-center justify-between text-left hover:bg-stone-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-bold text-xs">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-stone-900">{c.name}</span>
                            <span className="text-[10px] font-mono text-stone-500 bg-stone-100 px-1 py-0.2 rounded">
                              #{c.customerCode || c.id}
                            </span>
                          </div>
                          {c.phone && (
                            <span className="text-[11px] text-stone-500 block font-mono">
                              +91 {c.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        {b.cashDueAmount > 0 ? (
                          <span className="text-xs font-mono font-bold text-rose-700 block">
                            Due: {formatRupees(b.cashDueAmount)}
                          </span>
                        ) : b.cashCreditAmount > 0 ? (
                          <span className="text-xs font-mono font-bold text-emerald-700 block">
                            Credit: {formatRupees(b.cashCreditAmount)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-400 block font-mono">No dues</span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-stone-500">
                  No customers found matching &ldquo;{customerSearch}&rdquo;.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* STEP 2: Payment & Settlement Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Customer Banner with Change Option */}
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold text-stone-900">
                      {selectedCustomer.name}
                    </span>
                    <span className="text-[10px] font-mono text-stone-500 bg-stone-200/70 px-1 py-0.5 rounded">
                      #{selectedCustomer.customerCode || selectedCustomer.id}
                    </span>
                  </div>
                  {selectedCustomer.phone && (
                    <span className="text-[11px] text-stone-500 block font-mono">
                      +91 {selectedCustomer.phone}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomer(undefined)}
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
              >
                Change
              </button>
            </div>

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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setActionType(PaymentType.RECEIVE_PAYMENT)}
                  className={`p-3 rounded-xl border font-medium flex items-center gap-2 transition-all text-left cursor-pointer ${
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
                  className={`p-3 rounded-xl border font-medium flex items-center gap-2 transition-all text-left cursor-pointer ${
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
                  className={`p-3 rounded-xl border font-medium flex items-center gap-2 transition-all text-left cursor-pointer ${
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

            {/* Target Bill (Optional) */}
            {pendingTransactions.length > 0 && actionType === PaymentType.RECEIVE_PAYMENT && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-stone-700">
                  Target Transaction / Bill (Optional)
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
                  <option value="">General Khata Settlement (Earliest dues first)</option>
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
                <span className="absolute left-3.5 top-2.5 text-stone-400 font-bold text-base">₹</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0"
                  className="w-full pl-8 pr-3 py-2 text-base sm:text-lg font-mono font-bold bg-white border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {actionType === PaymentType.RECEIVE_PAYMENT && balances.cashDueAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmountStr(String(balances.cashDueAmount))}
                    className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-md text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    Full Due (₹{balances.cashDueAmount})
                  </button>
                )}
                {actionType === PaymentType.PAY_CUSTOMER && balances.cashCreditAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmountStr(String(balances.cashCreditAmount))}
                    className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-xs font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
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
                    className="px-2.5 py-1 bg-stone-100 text-stone-800 border border-stone-300 rounded-md text-xs font-semibold hover:bg-stone-200 transition-colors cursor-pointer"
                  >
                    Max Offset (₹{Math.min(balances.cashCreditAmount, balances.cashDueAmount)})
                  </button>
                )}
                {[100, 200, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmountStr(String(preset))}
                    className="px-2 py-1 bg-stone-100 text-stone-700 border border-stone-200 rounded-md text-xs font-medium hover:bg-stone-200 transition-colors cursor-pointer"
                  >
                    ₹{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode Selector */}
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
                        className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold'
                            : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reference Number */}
            {mode !== PaymentMode.CASH && actionType !== PaymentType.APPLY_CREDIT && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-stone-700">
                  Reference / UTR Number
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="e.g. UPI Ref / Transaction ID"
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
                placeholder="e.g. Counter payment, cleared previous account balance"
                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
              />
            </div>

            {/* LIVE BREAKDOWN PREVIEW BOX */}
            {numericAmount > 0 && (
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-700 uppercase tracking-wider text-[10px]">
                    Settlement Calculation Preview
                  </span>
                  <span className="font-mono font-bold text-sm text-stone-900">
                    {formatRupees(numericAmount)}
                  </span>
                </div>

                <div className="space-y-1.5 text-stone-600">
                  {preview.amountAppliedToDue > 0 && (
                    <div className="flex justify-between items-center">
                      <span>Applied towards outstanding dues</span>
                      <span className="font-mono font-semibold text-stone-900">
                        -{formatRupees(preview.amountAppliedToDue)}
                      </span>
                    </div>
                  )}

                  {/* Overpayment Highlight Badge */}
                  {preview.creditCreated > 0 && (
                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center text-emerald-950 font-medium">
                      <div>
                        <span className="font-bold block">Customer Credit Created</span>
                        <span className="text-[10px] text-emerald-700 block">
                          Overpayment credited as advance balance
                        </span>
                      </div>
                      <span className="font-mono font-bold text-base text-emerald-800">
                        +{formatRupees(preview.creditCreated)}
                      </span>
                    </div>
                  )}

                  {preview.payoutAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span>Cash paid out to customer</span>
                      <span className="font-mono font-semibold text-amber-900">
                        {formatRupees(preview.payoutAmount)}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-stone-200 flex justify-between items-center font-medium">
                    <span>Resulting Customer Due:</span>
                    <span className={`font-mono font-bold ${preview.newDue > 0 ? 'text-rose-700' : 'text-stone-700'}`}>
                      {formatRupees(preview.newDue)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center font-medium">
                    <span>Resulting Customer Credit:</span>
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

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isSubmitting || numericAmount <= 0 || !preview.isValid}
                className="w-full"
              >
                {isSubmitting ? 'Recording Settlement...' : 'Confirm & Record Payment'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
