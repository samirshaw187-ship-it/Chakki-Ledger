import React, { useMemo, useState } from 'react';
import { ArrowLeft, Download, FileText, Printer, Share2, User } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../modules/auth';
import { hasPermission, Permission } from '../modules/auth/permissions';
import {
  buildPaymentReceiptData,
  buildTransactionReceiptData,
  downloadReceiptPdf,
  ReceiptViewModel,
} from '../services/receipt.service';

export interface ReceiptViewProps {
  receiptId: string;
  kind?: 'transaction' | 'payment';
  onNavigate: (path: string) => void;
}

const money = (value = 0) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ReceiptView: React.FC<ReceiptViewProps> = ({ receiptId, kind = 'transaction', onNavigate }) => {
  const { role } = useAuth();
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const receipt = useMemo<ReceiptViewModel | undefined>(
    () => kind === 'payment' ? buildPaymentReceiptData(receiptId) : buildTransactionReceiptData(receiptId),
    [receiptId, kind]
  );

  if (!hasPermission(role, Permission.VIEW_RECEIPTS)) {
    return <div className="max-w-lg mx-auto p-8 text-center text-sm text-stone-600">You do not have permission to view this receipt.</div>;
  }

  if (!receipt) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center space-y-3">
        <FileText className="w-10 h-10 text-stone-400 mx-auto" />
        <h1 className="text-lg font-bold text-stone-900">Receipt not found.</h1>
        <Button size="sm" variant="primary" onClick={() => onNavigate('/app/transactions')}>Back to Transactions</Button>
      </div>
    );
  }

  const handleShare = async () => {
    if (!navigator.share) {
      setShareMessage('Sharing is not supported on this device. Download the PDF instead.');
      return;
    }
    try {
      await navigator.share({ title: receipt.title, text: `${receipt.businessName} - ${receipt.referenceNumber}` });
    } catch {
      setShareMessage('Receipt sharing was cancelled.');
    }
  };

  const statusClass = receipt.statusTone === 'danger'
    ? 'bg-rose-100 text-rose-800 border-rose-200'
    : receipt.statusTone === 'warning'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-emerald-100 text-emerald-800 border-emerald-200';

  return (
    <div className="receipt-page max-w-xl mx-auto pb-10">
      <div className="no-print flex items-center justify-between gap-3 mb-4">
        <button type="button" onClick={() => onNavigate(kind === 'payment' ? '/app/payments' : `/app/transactions/${receiptId}`)} className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 py-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => window.print()} leftIcon={<Printer className="w-3.5 h-3.5" />}>Print</Button>
          <Button size="sm" variant="primary" onClick={() => downloadReceiptPdf(receipt)} leftIcon={<Download className="w-3.5 h-3.5" />}>PDF</Button>
          <button type="button" title="Share receipt" onClick={handleShare} className="p-2 rounded-lg border border-stone-200 bg-white text-stone-600 hover:text-emerald-700">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {shareMessage && <div className="no-print mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{shareMessage}</div>}

      <article className="receipt-sheet bg-white border border-stone-200 rounded-2xl p-5 sm:p-7 shadow-sm">
        <header className="border-b border-stone-200 pb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-black tracking-tight text-stone-950">{receipt.businessName}</p>
            <p className="text-xs text-stone-500 mt-0.5">{receipt.tagline}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-stone-500">Receipt</p>
            <p className="font-mono text-xs font-bold text-stone-900">{receipt.referenceNumber}</p>
          </div>
        </header>

        <div className="py-4 grid grid-cols-2 gap-3 text-xs border-b border-stone-100">
          <div><span className="block text-[10px] uppercase tracking-wider text-stone-400">Date</span><strong>{receipt.date}</strong></div>
          <div className="text-right"><span className="block text-[10px] uppercase tracking-wider text-stone-400">Time</span><strong>{receipt.time}</strong></div>
          {receipt.customer && <div className="col-span-2 flex items-center gap-2 pt-1"><User className="w-4 h-4 text-emerald-700" /><div><span className="block text-[10px] uppercase tracking-wider text-stone-400">Customer</span><strong>{receipt.customer.name}</strong>{receipt.customer.code && <span className="ml-2 font-mono text-stone-500">{receipt.customer.code}</span>}{receipt.customer.phone && <span className="block text-stone-500">{receipt.customer.phone}</span>}</div></div>}
        </div>

        <div className="py-4 flex items-center justify-between gap-3">
          <h1 className="text-base font-bold text-stone-950">{receipt.title}</h1>
          <span className={`text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full border ${statusClass}`}>{receipt.status}</span>
        </div>

        {receipt.lines.length > 0 && <section className="border-t border-stone-100 pt-3 pb-2"><h2 className="text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-2">Items</h2><div className="space-y-2">{receipt.lines.map((line, index) => <div key={`${line.label}-${index}`} className="flex items-start justify-between gap-3 text-sm"><div><p className="font-semibold text-stone-900">{line.label}</p><p className="text-xs text-stone-500">{line.quantity} {line.unit}{line.rate !== undefined ? ` @ ${money(line.rate)}` : ''}</p>{line.detail && <p className="text-[11px] text-stone-400 mt-0.5">{line.detail}</p>}</div><strong>{line.amount !== undefined ? money(line.amount) : '-'}</strong></div>)}</div></section>}

        {receipt.sections.map((section) => <section key={section.title} className="border-t border-stone-100 pt-3 mt-3"><h2 className="text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-2">{section.title}</h2><div className="space-y-1.5">{section.rows.map((row) => <div key={row.label} className={`flex justify-between gap-4 text-sm ${row.emphasis ? 'font-bold text-stone-950' : 'text-stone-600'}`}><span>{row.label}</span><span className="text-right">{row.value}</span></div>)}</div></section>)}

        {receipt.notes && <section className="border-t border-stone-100 pt-3 mt-4"><h2 className="text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Notes</h2><p className="text-xs text-stone-600 whitespace-pre-wrap">{receipt.notes}</p></section>}
        <footer className="border-t border-stone-200 mt-5 pt-4 text-center text-[10px] text-stone-400">{receipt.footer}</footer>
      </article>
    </div>
  );
};
