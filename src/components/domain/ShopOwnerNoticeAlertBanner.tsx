import React, { useState, useEffect } from 'react';
import { SuspiciousNotice } from '../../types';
import { adminNoticeService } from '../../services/admin-notice.service';
import { useAuth } from '../../modules/auth/AuthContext';
import {
  AlertTriangle,
  Send,
  MessageSquare,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Receipt,
  X,
} from 'lucide-react';
import { formatRupees } from '../../utils/precision';
import { Button } from '../ui/Button';

export const ShopOwnerNoticeAlertBanner: React.FC = () => {
  const { user } = useAuth();
  const [notices, setNotices] = useState<SuspiciousNotice[]>(() => adminNoticeService.getNotices());
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<{ [noticeId: string]: string }>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = adminNoticeService.subscribe(() => {
      setNotices(adminNoticeService.getNotices());
    });
    return () => unsub();
  }, []);

  const pendingNotices = notices.filter((n) => n.status === 'PENDING_REVIEW');
  const recentlyExplained = notices.filter(
    (n) => n.status === 'EXPLAINED' && n.respondedAt && (Date.now() - new Date(n.respondedAt).getTime() < 3600000)
  );

  if (pendingNotices.length === 0 && recentlyExplained.length === 0) {
    return null;
  }

  const handleResponseSubmit = (noticeId: string) => {
    const reply = (responseText[noticeId] || '').trim();
    if (!reply) return;

    setSubmittingId(noticeId);
    try {
      adminNoticeService.respondToNotice(
        noticeId,
        reply,
        user?.name || 'Shop Owner',
        user?.id || 'owner_1'
      );
      setSuccessMessage('Your explanation has been submitted directly to the Administrator.');
      setTimeout(() => setSuccessMessage(null), 4000);
      setExpandedNoticeId(null);
    } catch (e: any) {
      console.error(e);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-2 mb-4 font-sans">
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {pendingNotices.map((notice) => {
        const isExpanded = expandedNoticeId === notice.id;

        return (
          <div
            key={notice.id}
            className="p-3.5 bg-amber-50/90 border-2 border-amber-300 rounded-2xl shadow-sm space-y-2.5 transition-all"
          >
            {/* Header banner */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 bg-amber-100 text-amber-900 rounded-lg shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded">
                      Admin Notice ({notice.severity})
                    </span>
                    <span className="font-bold text-xs text-amber-950">{notice.title}</span>
                  </div>
                  <p className="text-[11px] text-amber-900/80 mt-1 line-clamp-2">
                    {notice.message}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExpandedNoticeId(isExpanded ? null : notice.id)}
                className="p-1 text-amber-800 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* Expandable Item Details & Response Form */}
            {isExpanded && (
              <div className="pt-2 border-t border-amber-200/80 space-y-3 text-xs">
                {/* Item Details */}
                <div className="p-2.5 bg-white/80 rounded-xl border border-amber-200 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-stone-500 block text-[10px]">Transaction #</span>
                    <span className="font-mono font-bold text-stone-900">
                      {notice.transactionNumber || notice.transactionId || 'General Entry'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[10px]">Customer / Farmer</span>
                    <span className="font-semibold text-stone-900">
                      {notice.customerName || 'Direct Counter Customer'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[10px]">Item Description</span>
                    <span className="font-semibold text-stone-900">{notice.itemType}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[10px]">Amount / Rate</span>
                    <span className="font-bold text-emerald-800">
                      {notice.totalAmount ? formatRupees(notice.totalAmount) : 'N/A'}{' '}
                      {notice.rate ? `(@ ₹${notice.rate}/kg)` : ''}
                    </span>
                  </div>
                </div>

                {/* Explanation Form */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-amber-950">
                    Your Explanation / Clarification for Admin:
                  </label>
                  <textarea
                    rows={2}
                    value={responseText[notice.id] || ''}
                    onChange={(e) =>
                      setResponseText({ ...responseText, [notice.id]: e.target.value })
                    }
                    placeholder="e.g. Weighment verified against customer slip; special discount authorized for bulk marriage order..."
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleResponseSubmit(notice.id)}
                      isLoading={submittingId === notice.id}
                      leftIcon={<Send className="w-3.5 h-3.5" />}
                      className="shadow-xs text-xs"
                    >
                      Submit Clarification
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
