import React, { useState, useEffect, useMemo } from 'react';
import { SuspiciousNotice, SuspiciousNoticeStatus, Transaction } from '../../types';
import { adminNoticeService } from '../../services/admin-notice.service';
import { dbRepository } from '../../db/in-memory-db';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FlagSuspiciousModal } from '../../components/domain/FlagSuspiciousModal';
import {
  AlertTriangle,
  Search,
  CheckCircle2,
  Clock,
  MessageSquare,
  ShieldAlert,
  ArrowRight,
  Filter,
  Receipt,
  User,
  Check,
} from 'lucide-react';
import { formatRupees, formatKg } from '../../utils/precision';
import { useAuth } from '../../modules/auth/AuthContext';

export interface AdminSuspiciousNoticesViewProps {
  onNavigate: (path: string) => void;
}

export const AdminSuspiciousNoticesView: React.FC<AdminSuspiciousNoticesViewProps> = ({
  onNavigate,
}) => {
  const { user } = useAuth();
  const [notices, setNotices] = useState<SuspiciousNotice[]>(() => adminNoticeService.getNotices());
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTxForModal, setSelectedTxForModal] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  useEffect(() => {
    const unsub = adminNoticeService.subscribe(() => {
      setNotices(adminNoticeService.getNotices());
    });
    return () => unsub();
  }, []);

  const transactions = dbRepository.getTransactions();

  // Metrics
  const totalCount = notices.length;
  const pendingCount = notices.filter((n) => n.status === 'PENDING_REVIEW').length;
  const explainedCount = notices.filter((n) => n.status === 'EXPLAINED').length;
  const resolvedCount = notices.filter((n) => n.status === 'RESOLVED').length;

  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      if (filterStatus !== 'ALL' && n.status !== filterStatus) return false;
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = n.title.toLowerCase().includes(query);
        const matchesTx = n.transactionNumber?.toLowerCase().includes(query);
        const matchesCustomer = n.customerName?.toLowerCase().includes(query);
        const matchesItem = n.itemType?.toLowerCase().includes(query);
        return matchesTitle || matchesTx || matchesCustomer || matchesItem;
      }
      return true;
    });
  }, [notices, filterStatus, searchTerm]);

  const handleResolve = (noticeId: string) => {
    adminNoticeService.resolveNotice(
      noticeId,
      user?.id || 'admin_1',
      user?.name || 'Administrator',
      resolutionNote || 'Verified and accepted explanation.'
    );
    setResolvingId(null);
    setResolutionNote('');
  };

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        title="Abnormal & Suspicious Activity Audits"
        description="Monitor irregular grain purchases, abnormal selling rates, and dispatch direct security notices to Shop Owners."
        breadcrumbs={['Admin', 'Suspicious Audits']}
        action={
          <Button
            variant="danger"
            size="sm"
            leftIcon={<AlertTriangle className="w-4 h-4" />}
            onClick={() => {
              if (transactions.length > 0) {
                setSelectedTxForModal(transactions[0]);
                setIsModalOpen(true);
              }
            }}
          >
            Flag an Item / Notice
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Total Flagged Items</span>
            <span className="p-2 bg-stone-100 rounded-lg text-stone-700">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-stone-900 mt-2">{totalCount}</p>
          <p className="text-[11px] text-stone-400 mt-1">Audit inquiries raised by Admin</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">Pending Shop Owner Review</span>
            <span className="p-2 bg-amber-100 rounded-lg text-amber-800">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-900 mt-2">{pendingCount}</p>
          <p className="text-[11px] text-amber-700 mt-1">Awaiting clarification from counter</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-blue-200 bg-blue-50/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800">Explained by Shop Owner</span>
            <span className="p-2 bg-blue-100 rounded-lg text-blue-800">
              <MessageSquare className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-blue-900 mt-2">{explainedCount}</p>
          <p className="text-[11px] text-blue-700 mt-1">Ready for Admin review & resolution</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Resolved & Closed</span>
            <span className="p-2 bg-emerald-100 rounded-lg text-emerald-800">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-900 mt-2">{resolvedCount}</p>
          <p className="text-[11px] text-emerald-700 mt-1">Audited and satisfactorily closed</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-lg text-xs font-medium w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
                filterStatus === 'ALL'
                  ? 'bg-white font-bold text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All ({notices.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('PENDING_REVIEW')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
                filterStatus === 'PENDING_REVIEW'
                  ? 'bg-white font-bold text-amber-800 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('EXPLAINED')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
                filterStatus === 'EXPLAINED'
                  ? 'bg-white font-bold text-blue-800 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Explained ({explainedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('RESOLVED')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
                filterStatus === 'RESOLVED'
                  ? 'bg-white font-bold text-emerald-800 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Resolved ({resolvedCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search notices, customer, items..."
              className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
            />
          </div>
        </div>
      </div>

      {/* Notices List */}
      {filteredNotices.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-10 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-900">No abnormal items found in this filter</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            All purchases, sales, and conversions are in line with standards. If you observe any suspicious item in the Transaction Ledger, click "Flag an Item / Notice" to alert the Shop Owner.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotices.map((notice) => {
            const sevColors = {
              CRITICAL: 'bg-red-50 text-red-800 border-red-200',
              WARNING: 'bg-amber-50 text-amber-800 border-amber-200',
              INQUIRY: 'bg-blue-50 text-blue-800 border-blue-200',
            };

            const statusColors = {
              PENDING_REVIEW: 'bg-amber-100 text-amber-900 border-amber-300',
              EXPLAINED: 'bg-blue-100 text-blue-900 border-blue-300',
              RESOLVED: 'bg-emerald-100 text-emerald-900 border-emerald-300',
            };

            const isResolving = resolvingId === notice.id;

            return (
              <div
                key={notice.id}
                className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs space-y-3 transition-all hover:border-stone-300"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sevColors[notice.severity]}`}
                    >
                      {notice.severity}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[notice.status]}`}
                    >
                      {notice.status === 'PENDING_REVIEW'
                        ? 'Pending Shop Owner Review'
                        : notice.status === 'EXPLAINED'
                        ? 'Explained by Shop Owner'
                        : 'Resolved'}
                    </span>
                    <span className="text-xs font-bold text-stone-900">{notice.title}</span>
                  </div>

                  <span className="text-[11px] text-stone-400">
                    Dispatched on {new Date(notice.createdAt).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-stone-50/80 p-3 rounded-xl border border-stone-200/60">
                  <div>
                    <span className="text-[10px] text-stone-500 uppercase font-semibold block">
                      Target Transaction
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Receipt className="w-3.5 h-3.5 text-stone-400" />
                      <button
                        type="button"
                        onClick={() => {
                          if (notice.transactionId) {
                            onNavigate(`/admin/transactions/${notice.transactionId}`);
                          }
                        }}
                        className="font-mono font-bold text-emerald-800 hover:underline cursor-pointer"
                      >
                        {notice.transactionNumber || notice.transactionId || 'General Entry'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-500 uppercase font-semibold block">
                      Item & Customer
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <User className="w-3.5 h-3.5 text-stone-400" />
                      <span className="font-semibold text-stone-800">
                        {notice.customerName || 'Farmer / Customer'}
                      </span>
                      <span className="text-stone-400">•</span>
                      <span className="text-stone-600">{notice.itemType}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-500 uppercase font-semibold block">
                      Flagged Amount / Rate
                    </span>
                    <div className="mt-0.5 font-bold text-stone-900">
                      {notice.totalAmount ? formatRupees(notice.totalAmount) : 'N/A'}{' '}
                      {notice.rate ? `(@ ₹${notice.rate}/kg)` : ''}
                    </div>
                  </div>
                </div>

                {/* Admin Message */}
                <div className="text-xs text-stone-700 bg-amber-50/50 p-3 rounded-xl border border-amber-200/60">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Admin Inquiry Details:</span>
                  </div>
                  <p className="leading-relaxed">{notice.message}</p>
                </div>

                {/* Shop Owner Response Section */}
                {notice.shopOwnerResponse ? (
                  <div className="text-xs bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 text-emerald-950">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                        Shop Owner Official Clarification:
                      </span>
                      {notice.respondedAt && (
                        <span className="text-[10px] text-emerald-700">
                          Responded on {new Date(notice.respondedAt).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap font-medium">
                      "{notice.shopOwnerResponse}"
                    </p>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200/80 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Notice active on Shop Owner counter app. Awaiting counter staff explanation...
                    </span>
                  </div>
                )}

                {/* Resolution State or Action */}
                {notice.status === 'RESOLVED' ? (
                  <div className="text-[11px] text-stone-500 pt-1 flex items-center justify-between border-t border-stone-100">
                    <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                      <Check className="w-3.5 h-3.5" />
                      Audit Inquiry Closed by Admin
                    </span>
                    {notice.resolutionNotes && (
                      <span className="italic">Resolution Note: "{notice.resolutionNotes}"</span>
                    )}
                  </div>
                ) : (
                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                    {isResolving ? (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="text"
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                          placeholder="Optional resolution note..."
                          className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs flex-1 sm:w-64"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleResolve(notice.id)}
                        >
                          Confirm Close
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setResolvingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        onClick={() => setResolvingId(notice.id)}
                      >
                        Accept & Close Audit
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Flag Modal */}
      <FlagSuspiciousModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTxForModal(null);
        }}
        transaction={selectedTxForModal}
      />
    </div>
  );
};
