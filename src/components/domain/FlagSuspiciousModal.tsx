import React, { useState } from 'react';
import { Transaction, SuspiciousCategory, SuspiciousSeverity } from '../../types';
import { adminNoticeService } from '../../services/admin-notice.service';
import { useAuth } from '../../modules/auth/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  AlertTriangle,
  Send,
  HelpCircle,
  FileWarning,
  DollarSign,
  Scale,
  Calendar,
  User,
} from 'lucide-react';
import { formatRupees, formatKg } from '../../utils/precision';

export interface FlagSuspiciousModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
  onSuccess?: () => void;
}

export const FlagSuspiciousModal: React.FC<FlagSuspiciousModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onSuccess,
}) => {
  const { user } = useAuth();

  const [category, setCategory] = useState<SuspiciousCategory>('ABNORMAL_PURCHASE_QUANTITY');
  const [severity, setSeverity] = useState<SuspiciousSeverity>('WARNING');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill template when opened or category changed
  React.useEffect(() => {
    if (!transaction) return;

    const itemDesc = transaction.items?.map((i) => `${i.quantity}kg ${i.itemType || 'grain'}`).join(', ') || transaction.type;
    const isPurchase = transaction.type.includes('PURCHASE') || transaction.type.includes('DEPOSIT');

    if (isPurchase) {
      setCategory('ABNORMAL_PURCHASE_QUANTITY');
      setTitle(`Inquiry on ${transaction.transactionNumber || 'Transaction'}: Abnormal Purchase Volume`);
      setMessage(
        `Please verify the purchase of ${itemDesc} recorded on ${new Date(transaction.date).toLocaleDateString('en-IN')}. Verify farmer identity, actual weighment receipts, and confirm pricing.`
      );
    } else {
      setCategory('ABNORMAL_SELLING_RATE');
      setTitle(`Inquiry on ${transaction.transactionNumber || 'Transaction'}: Selling Rate & Quantity Check`);
      setMessage(
        `Discrepancy detected in ${itemDesc} for customer ${transaction.customerName || 'walk-in'}. Confirm if approved rates were applied and clarify settlement status.`
      );
    }
    setError(null);
  }, [transaction, isOpen]);

  const handleCategoryChange = (newCat: SuspiciousCategory) => {
    setCategory(newCat);
    if (!transaction) return;
    const itemDesc = transaction.items?.map((i) => `${i.quantity}kg ${i.itemType || 'grain'}`).join(', ') || transaction.type;

    switch (newCat) {
      case 'ABNORMAL_PURCHASE_QUANTITY':
        setTitle(`Abnormal Purchase Volume: ${transaction.transactionNumber}`);
        setMessage(`High volume purchase recorded for ${transaction.customerName || 'Customer'}. Verify weighment calibration and grain stock intake.`);
        break;
      case 'ABNORMAL_SELLING_RATE':
        setTitle(`Abnormal Selling Rate Detected: ${transaction.transactionNumber}`);
        setMessage(`Rate applied on ${itemDesc} deviates from current standard rates. Please explain reason for rate alteration.`);
        break;
      case 'PRICE_DEVIATION':
        setTitle(`Price / Rate Deviation Notice: ${transaction.transactionNumber}`);
        setMessage(`Unit price entered does not correspond to mill configuration. Provide breakdown and authorization details.`);
        break;
      case 'DISCREPANT_CONVERSION':
        setTitle(`Wheat to Atta Conversion Mismatch: ${transaction.transactionNumber}`);
        setMessage(`Reported milling exchange yields do not align with standard 1:1 or mill extraction tolerance.`);
        break;
      case 'UNUSUAL_CUSTOMER_DUES':
        setTitle(`Unusual Credit / Dues Spike: ${transaction.customerName || 'Customer'}`);
        setMessage(`Credit extended exceeds ordinary khata tolerance. Clarify customer agreement and repayment timeline.`);
        break;
      default:
        setTitle(`Admin Inquiry: ${transaction.transactionNumber}`);
        setMessage(`Please review the recorded entry for ${itemDesc} and provide operational confirmation.`);
        break;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;

    if (!title.trim()) {
      setError('Please provide a subject/title for the notice.');
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      setError('Please enter clear explanatory details for the Shop Owner (at least 10 characters).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const firstItem = transaction.items?.[0];
      const itemDesc = transaction.items?.map((i) => `${i.quantity}kg ${i.itemType}`).join(', ') || transaction.type;

      adminNoticeService.createNotice({
        transactionId: transaction.id,
        transactionNumber: transaction.transactionNumber,
        itemType: itemDesc,
        customerName: transaction.customerName,
        customerId: transaction.customerId,
        quantity: firstItem?.quantity,
        rate: firstItem?.rate,
        totalAmount: transaction.netAmount || transaction.totalAmount,
        transactionDate: transaction.date,
        category,
        severity,
        title: title.trim(),
        message: message.trim(),
        adminId: user?.id || 'admin_master_1',
        adminName: user?.name || 'Administrator',
      });

      setIsSubmitting(false);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err?.message || 'Failed to dispatch notice.');
    }
  };

  if (!transaction) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Flag Suspicious Item & Inform Shop Owner"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Dispatch Notice to Shop Owner
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
        {/* Transaction Summary Card */}
        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
          <div className="flex items-center justify-between text-stone-600">
            <span className="font-mono font-semibold text-stone-900 text-sm">
              {transaction.transactionNumber || transaction.id}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-stone-500">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(transaction.date).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-200/60">
            <div>
              <span className="text-[10px] text-stone-500 block">Customer / Party</span>
              <span className="font-semibold text-stone-800 flex items-center gap-1">
                <User className="w-3 h-3 text-stone-400" />
                {transaction.customerName || 'Walk-in Farmer'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-stone-500 block">Transaction Type</span>
              <span className="font-semibold text-stone-800">{transaction.type}</span>
            </div>
            <div>
              <span className="text-[10px] text-stone-500 block">Item / Quantity</span>
              <span className="font-semibold text-stone-800">
                {transaction.items?.map((i) => `${i.quantity} kg (${i.itemType})`).join(', ') || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-stone-500 block">Total Amount</span>
              <span className="font-bold text-emerald-800">
                {formatRupees(transaction.netAmount || transaction.totalAmount || 0)}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Category & Severity Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Issue Category
            </label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as SuspiciousCategory)}
              className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
            >
              <option value="ABNORMAL_PURCHASE_QUANTITY">Abnormal Purchase Quantity</option>
              <option value="ABNORMAL_SELLING_RATE">Abnormal Selling Rate</option>
              <option value="ABNORMAL_PURCHASE_RATE">Abnormal Purchase Rate</option>
              <option value="SUSPICIOUS_HIGH_VOLUME">Suspicious High Volume</option>
              <option value="PRICE_DEVIATION">Price / Rate Deviation</option>
              <option value="DISCREPANT_CONVERSION">Discrepant Conversion Yield</option>
              <option value="UNUSUAL_CUSTOMER_DUES">Unusual Customer Credit / Due</option>
              <option value="OTHER_IRREGULARITY">Other Irregularity</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Urgency / Severity Level
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['INQUIRY', 'WARNING', 'CRITICAL'] as SuspiciousSeverity[]).map((sev) => {
                const isSelected = severity === sev;
                const colors = {
                  INQUIRY: 'border-blue-300 text-blue-800 bg-blue-50',
                  WARNING: 'border-amber-300 text-amber-800 bg-amber-50',
                  CRITICAL: 'border-red-300 text-red-800 bg-red-50',
                };
                return (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverity(sev)}
                    className={`py-1.5 px-2 rounded-lg border text-center font-bold text-[11px] transition-all cursor-pointer ${
                      isSelected
                        ? colors[sev] + ' ring-2 ring-offset-1 ring-stone-400'
                        : 'border-stone-200 text-stone-600 bg-stone-50 hover:bg-stone-100'
                    }`}
                  >
                    {sev === 'CRITICAL' ? 'Critical' : sev === 'WARNING' ? 'Warning' : 'Inquiry'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Notice Subject */}
        <div>
          <label className="block font-semibold text-stone-700 mb-1">
            Notice Subject
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Unusual Ration Rice Purchase Volume"
            className="w-full p-2.5 bg-white border border-stone-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
          />
        </div>

        {/* Message / Inquiry for Shop Owner */}
        <div>
          <label className="block font-semibold text-stone-700 mb-1 flex items-center justify-between">
            <span>Inquiry & Instructions for Shop Owner</span>
            <span className="text-[10px] text-stone-400">Sent directly to Shop Owner app</span>
          </label>
          <textarea
            required
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Specify what seems suspicious or abnormal, and what clarification the shop owner must supply..."
            className="w-full p-2.5 bg-white border border-stone-300 rounded-lg text-xs leading-relaxed focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
          />
        </div>

        {/* Explanation Helper Note */}
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-amber-900 text-[11px]">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p>
            When submitted, this alert appears immediately on the Shop Owner's mobile counter screen.
            The Shop Owner can review the flagged items and submit their official explanation back to the Admin console.
          </p>
        </div>
      </form>
    </Modal>
  );
};
