import React, { useState, useMemo } from 'react';
import { dbRepository } from '../db/in-memory-db';
import { Payment, PaymentMode, PaymentType, UserRole } from '../types';
import { useAuth } from '../modules/auth/AuthContext';
import { formatRupees, formatDate } from '../utils/precision';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import {
  Receipt,
  Search,
  Filter,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Calendar,
  CheckCircle2,
  FileText,
  User,
  CreditCard,
  Building2,
  Banknote,
  TrendingUp,
  Download,
  Printer,
} from 'lucide-react';

export interface AdminPaymentsViewProps {
  onNavigate: (path: string) => void;
}

export const AdminPaymentsView: React.FC<AdminPaymentsViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [modeFilter, setModeFilter] = useState<string>('ALL');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Load all payments
  const allPayments = useMemo(() => {
    return dbRepository.getPayments();
  }, []);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return allPayments.filter((pmt) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (pmt.customerName && pmt.customerName.toLowerCase().includes(q)) ||
        (pmt.receiptNumber && pmt.receiptNumber.toLowerCase().includes(q)) ||
        (pmt.transactionNumber && pmt.transactionNumber.toLowerCase().includes(q)) ||
        (pmt.notes && pmt.notes.toLowerCase().includes(q));

      const matchesType = typeFilter === 'ALL' || pmt.paymentType === typeFilter;
      const matchesMode = modeFilter === 'ALL' || pmt.mode === modeFilter;

      return matchesSearch && matchesType && matchesMode;
    });
  }, [allPayments, searchTerm, typeFilter, modeFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalCashReceived = 0;
    let totalCreditCreated = 0;
    let totalPaidToCustomers = 0;

    for (const p of allPayments) {
      if (
        p.paymentType === PaymentType.RECEIVE_PAYMENT ||
        p.paymentType === PaymentType.SETTLE_DUE ||
        p.paymentType === PaymentType.OVERPAYMENT_CREDIT
      ) {
        totalCashReceived += p.amount;
      }
      if (p.paymentType === PaymentType.PAY_CUSTOMER) {
        totalPaidToCustomers += p.amount;
      }
      if (p.creditCreatedAmount && p.creditCreatedAmount > 0) {
        totalCreditCreated += p.creditCreatedAmount;
      }
    }

    return {
      totalCashReceived,
      totalCreditCreated,
      totalPaidToCustomers,
      totalCount: allPayments.length,
    };
  }, [allPayments]);

  const getTypeBadge = (type: PaymentType) => {
    switch (type) {
      case PaymentType.RECEIVE_PAYMENT:
      case PaymentType.SETTLE_DUE:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
            <ArrowDownLeft className="w-3 h-3 text-emerald-700" />
            Received
          </span>
        );
      case PaymentType.PAY_CUSTOMER:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
            <ArrowUpRight className="w-3 h-3 text-amber-700" />
            Paid Out
          </span>
        );
      case PaymentType.APPLY_CREDIT:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-800 bg-stone-100 border border-stone-300 px-2 py-0.5 rounded-md">
            <RefreshCw className="w-3 h-3 text-stone-600" />
            Credit Applied
          </span>
        );
      case PaymentType.OVERPAYMENT_CREDIT:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
            <TrendingUp className="w-3 h-3 text-teal-700" />
            Overpayment
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-[11px] font-medium text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 font-sans pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900">
            Payment & Settlement Register
          </h1>
          <p className="text-xs text-stone-500">
            Auditable cash movements, overpayments, credit creation, and balance settlements.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => onNavigate('/app/payments/new')}
          className="flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Record New Payment</span>
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-stone-500 block">Total Cash Collected</span>
          <span className="text-lg sm:text-xl font-mono font-bold text-emerald-800 block mt-0.5">
            {formatRupees(metrics.totalCashReceived)}
          </span>
          <span className="text-[10px] text-stone-400">All customer cash receipts</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-stone-500 block">Advance Credit Created</span>
          <span className="text-lg sm:text-xl font-mono font-bold text-teal-800 block mt-0.5">
            +{formatRupees(metrics.totalCreditCreated)}
          </span>
          <span className="text-[10px] text-stone-400">From overpayments & advances</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-stone-500 block">Paid Out to Customers</span>
          <span className="text-lg sm:text-xl font-mono font-bold text-amber-800 block mt-0.5">
            {formatRupees(metrics.totalPaidToCustomers)}
          </span>
          <span className="text-[10px] text-stone-400">Cash returned from credits</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-stone-500 block">Settlement Count</span>
          <span className="text-lg sm:text-xl font-mono font-bold text-stone-900 block mt-0.5">
            {metrics.totalCount}
          </span>
          <span className="text-[10px] text-stone-400">Total receipted payments</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs flex flex-col sm:flex-row gap-2.5 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search receipt #, customer, or note..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-800 focus:outline-none"
          >
            <option value="ALL">All Payment Types</option>
            <option value={PaymentType.RECEIVE_PAYMENT}>Receive Payment</option>
            <option value={PaymentType.PAY_CUSTOMER}>Pay Customer</option>
            <option value={PaymentType.APPLY_CREDIT}>Apply Credit</option>
            <option value={PaymentType.SETTLE_DUE}>Settle Due</option>
            <option value={PaymentType.OVERPAYMENT_CREDIT}>Overpayment Credit</option>
          </select>

          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-800 focus:outline-none"
          >
            <option value="ALL">All Modes</option>
            <option value={PaymentMode.CASH}>Cash</option>
            <option value={PaymentMode.UPI}>UPI / QR</option>
            <option value={PaymentMode.BANK_TRANSFER}>Bank Transfer</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-600 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Breakdown</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Ref Txn</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredPayments.length > 0 ? (
                filteredPayments.map((pmt) => {
                  return (
                    <tr key={pmt.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-stone-900 whitespace-nowrap">
                        {pmt.receiptNumber}
                      </td>
                      <td className="py-3 px-4 text-stone-600 whitespace-nowrap">
                        {formatDate(pmt.date)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onNavigate(`/app/customers/${pmt.customerId}`)}
                          className="font-bold text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer"
                        >
                          {pmt.customerName || 'Walk-in'}
                        </button>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getTypeBadge(pmt.paymentType)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-stone-900 whitespace-nowrap">
                        {formatRupees(pmt.amount)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-stone-600">
                        {pmt.creditCreatedAmount && pmt.creditCreatedAmount > 0 ? (
                          <span className="text-emerald-700 font-medium">
                            +{formatRupees(pmt.creditCreatedAmount)} Credit
                          </span>
                        ) : pmt.appliedToBillAmount !== undefined ? (
                          <span>{formatRupees(pmt.appliedToBillAmount)} to dues</span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">
                          {pmt.mode}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-stone-600">
                        {pmt.transactionNumber ? (
                          <button
                            type="button"
                            onClick={() => onNavigate(`/app/transactions/${pmt.transactionId}`)}
                            className="hover:text-emerald-800 hover:underline cursor-pointer"
                          >
                            {pmt.transactionNumber}
                          </button>
                        ) : (
                          <span className="text-stone-400">Direct</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedPayment(pmt)}
                          className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 px-2 py-1 bg-stone-100 rounded hover:bg-stone-200 transition-colors cursor-pointer"
                        >
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-stone-500">
                    No payment records found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECEIPT DETAIL MODAL */}
      {selectedPayment && (
        <Modal
          isOpen={!!selectedPayment}
          onClose={() => setSelectedPayment(null)}
          title="Payment Receipt"
          subtitle={`Receipt No: ${selectedPayment.receiptNumber}`}
          maxWidth="md"
        >
          <div className="space-y-4 font-sans text-xs text-left">
            <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-stone-500">Date & Time</span>
                <span className="font-mono font-medium text-stone-800">{formatDate(selectedPayment.date)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500">Customer</span>
                <span className="font-bold text-stone-900">{selectedPayment.customerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500">Payment Action</span>
                <span>{getTypeBadge(selectedPayment.paymentType)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500">Payment Mode</span>
                <span className="font-mono font-medium text-stone-800">{selectedPayment.mode}</span>
              </div>
              {selectedPayment.referenceNo && (
                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Ref / UTR</span>
                  <span className="font-mono text-stone-800">{selectedPayment.referenceNo}</span>
                </div>
              )}
              {selectedPayment.transactionNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Linked Transaction</span>
                  <span className="font-mono font-bold text-stone-900">{selectedPayment.transactionNumber}</span>
                </div>
              )}
            </div>

            {/* Financial Details */}
            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 space-y-1.5 text-emerald-950">
              <div className="flex justify-between items-center font-bold text-sm">
                <span>Total Amount</span>
                <span className="font-mono">{formatRupees(selectedPayment.amount)}</span>
              </div>
              {selectedPayment.appliedToBillAmount !== undefined && (
                <div className="flex justify-between items-center text-emerald-900">
                  <span>Applied to Dues / Bill</span>
                  <span className="font-mono font-semibold">{formatRupees(selectedPayment.appliedToBillAmount)}</span>
                </div>
              )}
              {selectedPayment.creditCreatedAmount && selectedPayment.creditCreatedAmount > 0 && (
                <div className="flex justify-between items-center text-emerald-900 pt-1 border-t border-emerald-200 font-bold">
                  <span>Advance Credit Created</span>
                  <span className="font-mono">+{formatRupees(selectedPayment.creditCreatedAmount)}</span>
                </div>
              )}
            </div>

            {selectedPayment.notes && (
              <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200 text-stone-600">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Notes</span>
                <p className="mt-0.5">{selectedPayment.notes}</p>
              </div>
            )}

            <div className="pt-2 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPayment(null)}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onNavigate(`/app/payments/${selectedPayment.id}/receipt`)}
                className="flex-1"
              >
                Print / PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedPayment.customerId) {
                    onNavigate(`/app/customers/${selectedPayment.customerId}`);
                  }
                }}
                className="flex-1"
              >
                View Customer Khata
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
