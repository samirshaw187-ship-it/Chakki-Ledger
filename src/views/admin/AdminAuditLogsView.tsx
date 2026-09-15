import React, { useState, useMemo } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { AuditService } from '../../services/audit.service';
import { dbRepository } from '../../db/in-memory-db';
import { AuditAction, AuditLogEntry, UserRole } from '../../types';
import {
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  User as UserIcon,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  ShieldAlert,
  FileText,
  CreditCard,
  UserCheck,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  History,
  ArrowRight,
  Code,
} from 'lucide-react';
import { formatRupees, formatKg } from '../../utils/precision';

export interface AdminAuditLogsViewProps {
  onNavigate: (path: string) => void;
}

export const AdminAuditLogsView: React.FC<AdminAuditLogsViewProps> = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('ALL');
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showRawJsonMap, setShowRawJsonMap] = useState<Record<string, boolean>>({});

  const users = useMemo(() => dbRepository.getUsers(), []);

  const getUserRole = (userId?: string, name?: string): string => {
    if (!userId && !name) return 'SYSTEM';
    const found = users.find((u) => u.id === userId);
    if (found) return found.role;
    const n = (name || '').toUpperCase();
    if (n.includes('OWNER')) return 'OWNER';
    if (n.includes('ADMIN')) return 'ADMIN';
    return 'SYSTEM';
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-100 text-purple-850 border-purple-300';
      case 'ADMIN':
        return 'bg-sky-100 text-sky-800 border-sky-300';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-300';
    }
  };

  // Fetch all filtered logs via AuditService
  const filteredLogs = useMemo(() => {
    return AuditService.searchLogs({
      search: searchQuery,
      action: selectedAction as any,
      entityType: selectedEntityType,
      userId: selectedUser,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  }, [searchQuery, selectedAction, selectedEntityType, selectedUser, startDate, endDate]);

  const allLogs = useMemo(() => AuditService.getAllLogs(), []);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = allLogs.length;
    const corrections = allLogs.filter(
      (l) => l.action === AuditAction.TRANSACTION_CORRECTED || l.action === AuditAction.CORRECTION
    ).length;
    const reversals = allLogs.filter(
      (l) => l.action === AuditAction.TRANSACTION_REVERSED || l.action === AuditAction.REVERSAL
    ).length;
    const rateOverrides = allLogs.filter((l) => l.action === AuditAction.RATE_OVERRIDE_USED).length;

    return { total, corrections, reversals, rateOverrides };
  }, [allLogs]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedAction('ALL');
    setSelectedEntityType('ALL');
    setSelectedUser('ALL');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedAction !== 'ALL' ||
    selectedEntityType !== 'ALL' ||
    selectedUser !== 'ALL' ||
    startDate !== '' ||
    endDate !== '';

  const getActionBadgeStyle = (action: AuditAction | string) => {
    switch (action) {
      case AuditAction.TRANSACTION_CORRECTED:
      case AuditAction.CORRECTION:
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case AuditAction.TRANSACTION_REVERSED:
      case AuditAction.REVERSAL:
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case AuditAction.TRANSACTION_CREATED:
      case AuditAction.PAYMENT_CREATED:
      case AuditAction.CUSTOMER_CREATED:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case AuditAction.RATE_OVERRIDE_USED:
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case AuditAction.CUSTOMER_STATUS_CHANGED:
      case AuditAction.STATUS_CHANGE:
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-300';
    }
  };

  const getActionIcon = (action: AuditAction | string) => {
    switch (action) {
      case AuditAction.TRANSACTION_CORRECTED:
      case AuditAction.CORRECTION:
        return <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />;
      case AuditAction.TRANSACTION_REVERSED:
      case AuditAction.REVERSAL:
        return <RotateCcw className="w-3.5 h-3.5 text-rose-700 shrink-0" />;
      case AuditAction.PAYMENT_CREATED:
        return <CreditCard className="w-3.5 h-3.5 text-emerald-700 shrink-0" />;
      case AuditAction.CUSTOMER_CREATED:
        return <UserCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-stone-600 shrink-0" />;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        title="Audit Trail & Dispute Prevention"
        description="Immutable record of user actions, financial corrections, and reversals. The system never silently rewrites financial history."
        breadcrumbs={['Admin', 'Audit Logs']}
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Events</span>
            <ShieldCheck className="w-4 h-4 text-stone-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-1">{stats.total}</p>
          <span className="text-[10px] text-stone-400">All registered audit logs</span>
        </div>

        <div className="bg-white rounded-xl border border-amber-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Corrections</span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-amber-800 mt-1">{stats.corrections}</p>
          <span className="text-[10px] text-amber-600">Non-destructive adjustments</span>
        </div>

        <div className="bg-white rounded-xl border border-rose-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Reversals</span>
            <RotateCcw className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-rose-800 mt-1">{stats.reversals}</p>
          <span className="text-[10px] text-rose-600">Compensated ledger voids</span>
        </div>

        <div className="bg-white rounded-xl border border-purple-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Rate Overrides</span>
            <SlidersHorizontal className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-purple-800 mt-1">{stats.rateOverrides}</p>
          <span className="text-[10px] text-purple-600">Locked rate snapshots</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Free Text Search */}
          <div className="sm:col-span-4 relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by user, reason, or transaction #..."
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs text-stone-900 focus:bg-white focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          {/* Action Filter */}
          <div className="sm:col-span-2">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-2.5 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs text-stone-900 focus:bg-white focus:ring-2 focus:ring-emerald-700"
            >
              <option value="ALL">All Actions</option>
              <option value={AuditAction.TRANSACTION_CREATED}>Transaction Created</option>
              <option value={AuditAction.TRANSACTION_CORRECTED}>Transaction Corrected</option>
              <option value={AuditAction.TRANSACTION_REVERSED}>Transaction Reversed</option>
              <option value={AuditAction.PAYMENT_CREATED}>Payment Recorded</option>
              <option value={AuditAction.CUSTOMER_CREATED}>Customer Created</option>
              <option value={AuditAction.RATE_OVERRIDE_USED}>Rate Override</option>
            </select>
          </div>

          {/* Entity Type Filter */}
          <div className="sm:col-span-2">
            <select
              value={selectedEntityType}
              onChange={(e) => setSelectedEntityType(e.target.value)}
              className="w-full px-2.5 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs text-stone-900 focus:bg-white focus:ring-2 focus:ring-emerald-700"
            >
              <option value="ALL">All Entities</option>
              <option value="TRANSACTION">Transactions</option>
              <option value="CUSTOMER">Customers</option>
              <option value="PAYMENT">Payments</option>
              <option value="RATE">Rates</option>
            </select>
          </div>

          {/* User Filter */}
          <div className="sm:col-span-2">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-2.5 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs text-stone-900 focus:bg-white focus:ring-2 focus:ring-emerald-700"
            >
              <option value="ALL">All Users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range or Reset */}
          <div className="sm:col-span-2 flex items-center gap-1.5">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-stone-100 text-xs text-stone-600">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-stone-500">
            <Calendar className="w-3.5 h-3.5" /> Date Filter:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-stone-400">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 bg-stone-50 border border-stone-300 rounded text-xs text-stone-800"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-stone-400">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 bg-stone-50 border border-stone-300 rounded text-xs text-stone-800"
            />
          </div>
          <span className="ml-auto text-[11px] font-mono text-stone-500">
            Showing {filteredLogs.length} of {allLogs.length} records
          </span>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <ShieldCheck className="w-10 h-10 text-stone-300 mx-auto" />
            <h4 className="text-sm font-bold text-stone-800">No matching audit logs</h4>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              No audit records matched your search query or selected filters. Try broadening your filter selection.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-2 text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-stone-100 text-xs">
            {/* Table Header */}
            <div className="bg-stone-50 p-3.5 grid grid-cols-12 gap-2 font-semibold text-stone-600 uppercase tracking-wider text-[11px]">
              <div className="col-span-3 sm:col-span-2">Timestamp</div>
              <div className="col-span-3 sm:col-span-2">Action</div>
              <div className="col-span-3 sm:col-span-2">Entity</div>
              <div className="col-span-3 sm:col-span-2">Performed By</div>
              <div className="hidden sm:block sm:col-span-4">Reason / Notes</div>
            </div>

            {/* Table Rows */}
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const hasDetails = log.previousState || log.newState;

              return (
                <div key={log.id} className="hover:bg-stone-50/70 transition-colors">
                  <div
                    onClick={() => hasDetails && setExpandedLogId(isExpanded ? null : log.id)}
                    className={`p-3.5 grid grid-cols-12 gap-2 items-center ${
                      hasDetails ? 'cursor-pointer' : ''
                    }`}
                  >
                    {/* Timestamp */}
                    <div className="col-span-3 sm:col-span-2 text-stone-600 font-mono text-[11px]">
                      <div>
                        {new Date(log.timestamp).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-stone-400 text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </div>

                    {/* Action Badge */}
                    <div className="col-span-3 sm:col-span-2 flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${getActionBadgeStyle(
                          log.action
                        )}`}
                      >
                        {getActionIcon(log.action)}
                        <span>{log.action.replace(/_/g, ' ')}</span>
                      </span>
                    </div>

                    {/* Entity */}
                    <div className="col-span-3 sm:col-span-2 font-mono text-[11px]">
                      <div className="font-bold text-stone-900 flex items-center gap-1">
                        <span>{log.entityReference || log.entityId}</span>
                        {log.entityType === 'TRANSACTION' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate(`/app/transactions/${log.entityId}`);
                            }}
                            title="View Transaction Details"
                            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <span className="text-stone-400 text-[10px] uppercase font-sans">
                        {log.entityType}
                      </span>
                    </div>

                    {/* Performed By */}
                    <div className="col-span-3 sm:col-span-2 text-stone-900 font-medium space-y-1">
                      <div>{log.performedByName || 'System'}</div>
                      {(() => {
                        const userRole = getUserRole(log.performedById, log.performedByName);
                        return (
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase font-bold tracking-wider inline-block ${getRoleBadgeStyle(
                              userRole
                            )}`}
                          >
                            {userRole}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Reason */}
                    <div className="col-span-12 sm:col-span-4 text-stone-700 mt-1 sm:mt-0 flex items-center justify-between">
                      <span className="text-[11px] line-clamp-2">
                        {log.reason || 'No description provided'}
                      </span>
                      {hasDetails && (
                        <span className="text-stone-400 shrink-0 ml-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expandable State Diff Details */}
                  {isExpanded && hasDetails && (
                    <div className="px-5 pb-5 pt-2 bg-stone-50/90 border-t border-stone-200 text-xs space-y-3.5">
                      {/* 1. Dispute & Entity Lifecycle Timeline (if multi-step history exists) */}
                      {(() => {
                        const relatedLogs = allLogs
                          .filter(
                            (l) =>
                              (l.entityId && l.entityId === log.entityId) ||
                              (l.entityReference &&
                                log.entityReference &&
                                l.entityReference === log.entityReference) ||
                              (log.entityReference && l.reason?.includes(log.entityReference))
                          )
                          .sort(
                            (a, b) =>
                              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                          );

                        if (relatedLogs.length <= 1) return null;

                        return (
                          <div className="bg-white rounded-xl border border-stone-200 p-3.5 space-y-2.5 shadow-2xs">
                            <div className="flex items-center gap-2 text-stone-700 font-bold text-[11px] uppercase tracking-wider">
                              <History className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Dispute &amp; Entity Lifecycle Timeline ({relatedLogs.length} Events)</span>
                            </div>
                            <div className="relative pl-4 border-l-2 border-stone-200 space-y-3 text-xs ml-1">
                              {relatedLogs.map((rl) => {
                                const isCurrent = rl.id === log.id;
                                return (
                                  <div key={rl.id} className="relative">
                                    <div
                                      className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white ${
                                        isCurrent ? 'bg-emerald-700 scale-110' : 'bg-stone-400'
                                      }`}
                                    />
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getActionBadgeStyle(
                                          rl.action
                                        )}`}
                                      >
                                        {rl.action.replace(/_/g, ' ')}
                                      </span>
                                      <span className="text-[10px] text-stone-500 font-mono">
                                        {new Date(rl.timestamp).toLocaleString('en-IN', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                      <span className="text-[11px] text-stone-700 font-medium">
                                        by {rl.performedByName || 'System'}
                                      </span>
                                    </div>
                                    {rl.reason && (
                                      <p className="text-[11px] text-stone-600 italic mt-0.5">
                                        &ldquo;{rl.reason}&rdquo;
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 2. Human-Readable Key-Value Before/After Card */}
                      <div className="bg-white rounded-xl border border-stone-200 p-3.5 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-stone-800 font-bold uppercase tracking-wider text-[11px]">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-800" />
                            <span>Audit State Comparison (Before vs After)</span>
                          </div>
                          {log.entityType === 'TRANSACTION' && log.entityId && (
                            <button
                              type="button"
                              onClick={() => onNavigate(`/app/transactions/${log.entityId}`)}
                              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                            >
                              <span>Open Transaction</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Specific Correction / Reversal / Override / Payment Visualizer */}
                        {(() => {
                          const prev: any = log.previousState || {};
                          const next: any = log.newState || {};

                          const isCorrection =
                            log.action === AuditAction.TRANSACTION_CORRECTED ||
                            log.action === AuditAction.CORRECTION;
                          const isReversal =
                            log.action === AuditAction.TRANSACTION_REVERSED ||
                            log.action === AuditAction.REVERSAL;
                          const isRateOverride = log.action === AuditAction.RATE_OVERRIDE_USED;
                          const isPayment =
                            log.action === AuditAction.PAYMENT_CREATED ||
                            log.action === AuditAction.PAYMENT_UPDATED;

                          return (
                            <div className="space-y-2.5">
                              {/* Summary Highlights */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                {isCorrection && (
                                  <>
                                    <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                                      <span className="text-[10px] font-bold text-amber-900 uppercase block">
                                        Action Impact
                                      </span>
                                      <span className="text-xs font-mono font-bold text-amber-950">
                                        {next.impact || next.netCorrectionDiff || (next.deltaAmount !== undefined ? (next.deltaAmount >= 0 ? `+₹${next.deltaAmount}` : `-₹${Math.abs(next.deltaAmount)}`) : 'Adjusted')}
                                      </span>
                                    </div>
                                    <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                                      <span className="text-[10px] font-bold text-stone-500 uppercase block">
                                        Status Shift
                                      </span>
                                      <span className="text-xs font-mono font-semibold text-stone-800">
                                        {prev.status || 'COMPLETED'} → <span className="text-amber-800 font-bold">CORRECTED</span>
                                      </span>
                                    </div>
                                    <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                                      <span className="text-[10px] font-bold text-stone-500 uppercase block">
                                        Compensating Txn
                                      </span>
                                      <span className="text-xs font-mono font-bold text-stone-800">
                                        {next.correctionTxnNumber || next.correctionTxnId || 'Auto-generated'}
                                      </span>
                                    </div>
                                  </>
                                )}

                                {isReversal && (
                                  <>
                                    <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-200">
                                      <span className="text-[10px] font-bold text-rose-900 uppercase block">
                                        Ledger Outcome
                                      </span>
                                      <span className="text-xs font-mono font-bold text-rose-950">
                                        Opposite Entries Posted (Net: 0)
                                      </span>
                                    </div>
                                    <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                                      <span className="text-[10px] font-bold text-stone-500 uppercase block">
                                        Status Shift
                                      </span>
                                      <span className="text-xs font-mono font-semibold text-stone-800">
                                        {prev.status || 'COMPLETED'} → <span className="text-rose-800 font-bold">REVERSED</span>
                                      </span>
                                    </div>
                                    <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                                      <span className="text-[10px] font-bold text-stone-500 uppercase block">
                                        Reversal Txn Ref
                                      </span>
                                      <span className="text-xs font-mono font-bold text-stone-800">
                                        {next.reversalTxnNumber || next.reversalTxnId || 'Auto-generated'}
                                      </span>
                                    </div>
                                  </>
                                )}

                                {isRateOverride && (
                                  <>
                                    <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                                      <span className="text-[10px] font-bold text-stone-500 uppercase block">
                                        Standard Rate
                                      </span>
                                      <span className="text-xs font-mono font-bold text-stone-800">
                                        ₹{prev.standardRate || prev.rollAttaExchangeRate || 'Base'}/kg
                                      </span>
                                    </div>
                                    <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
                                      <span className="text-[10px] font-bold text-purple-900 uppercase block">
                                        Overridden Applied Rate
                                      </span>
                                      <span className="text-xs font-mono font-bold text-purple-950">
                                        ₹{next.appliedRate || next.rollAttaExchangeRate || 'Applied'}/kg
                                      </span>
                                    </div>
                                    <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                                      <span className="text-[10px] font-bold text-stone-500 uppercase block">
                                        Rate Policy
                                      </span>
                                      <span className="text-xs font-semibold text-stone-700">
                                        Historically Locked
                                      </span>
                                    </div>
                                  </>
                                )}

                                {isPayment && (
                                  <>
                                    <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                                      <span className="text-[10px] font-bold text-emerald-900 uppercase block">
                                        Payment Amount
                                      </span>
                                      <span className="text-xs font-mono font-bold text-emerald-950">
                                        {next.amount ? formatRupees(next.amount) : 'Recorded'}
                                      </span>
                                    </div>
                                    <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                                      <span className="text-[10px] font-bold text-stone-500 uppercase block">
                                        Mode / Receipt
                                      </span>
                                      <span className="text-xs font-mono font-semibold text-stone-800">
                                        {next.receiptNumber || 'Receipt'} · {next.mode || next.paymentMode || 'CASH'}
                                      </span>
                                    </div>
                                    <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                                      <span className="text-[10px] font-bold text-stone-500 uppercase block">
                                        Customer Due Shift
                                      </span>
                                      <span className="text-xs font-mono font-bold text-stone-800">
                                        {prev.currentDue !== undefined ? `₹${prev.currentDue} → ₹${next.newDue ?? 0}` : 'Updated'}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Key-Value Change Breakdown Table */}
                              {(() => {
                                const allKeys = Array.from(
                                  new Set([...Object.keys(prev), ...Object.keys(next)])
                                ).filter(
                                  (k) =>
                                    ![
                                      'id',
                                      'updatedAt',
                                      'createdAt',
                                      'items',
                                      'metadata',
                                    ].includes(k)
                                );

                                const changedKeys = allKeys.filter(
                                  (k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k])
                                );

                                if (changedKeys.length === 0) return null;

                                return (
                                  <div className="border border-stone-200 rounded-lg overflow-hidden text-xs">
                                    <div className="bg-stone-50 px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] text-stone-600 grid grid-cols-12 gap-2">
                                      <div className="col-span-4">Attribute / Field</div>
                                      <div className="col-span-4">Previous Value (Before)</div>
                                      <div className="col-span-4 text-emerald-800">New Value (After)</div>
                                    </div>
                                    <div className="divide-y divide-stone-100">
                                      {changedKeys.map((key) => (
                                        <div
                                          key={key}
                                          className="px-3 py-1.5 grid grid-cols-12 gap-2 items-center font-mono text-[11px]"
                                        >
                                          <div className="col-span-4 font-sans font-medium text-stone-700 capitalize">
                                            {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                          </div>
                                          <div className="col-span-4 text-stone-500 truncate">
                                            {prev[key] !== undefined ? String(prev[key]) : <span className="italic text-stone-400">None</span>}
                                          </div>
                                          <div className="col-span-4 font-bold text-stone-900 truncate">
                                            {next[key] !== undefined ? String(next[key]) : <span className="italic text-stone-400">None</span>}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })()}

                        {/* Mandatory Reason Callout */}
                        {log.reason && (
                          <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200 text-xs">
                            <span className="text-[10px] uppercase font-bold text-stone-500 block mb-0.5">
                              Recorded Reason / Justification
                            </span>
                            <span className="text-stone-800 italic">&ldquo;{log.reason}&rdquo;</span>
                          </div>
                        )}

                        {/* 3. Collapsible Technical Raw JSON (Debug Inspection) */}
                        <div className="pt-1 border-t border-stone-100">
                          <button
                            type="button"
                            onClick={() =>
                              setShowRawJsonMap((prev) => ({
                                ...prev,
                                [log.id]: !prev[log.id],
                              }))
                            }
                            className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1.5 cursor-pointer py-1"
                          >
                            <Code className="w-3.5 h-3.5 text-stone-400" />
                            <span>
                              {showRawJsonMap[log.id]
                                ? 'Hide Raw Technical JSON (Debug)'
                                : 'Show Raw Technical JSON (Debug)'}
                            </span>
                          </button>

                          {showRawJsonMap[log.id] && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200">
                                <span className="text-[10px] font-bold uppercase text-stone-500 block mb-1">
                                  Raw Previous State
                                </span>
                                {log.previousState ? (
                                  <pre className="text-[11px] font-mono text-stone-700 whitespace-pre-wrap overflow-x-auto">
                                    {JSON.stringify(log.previousState, null, 2)}
                                  </pre>
                                ) : (
                                  <span className="text-stone-400 italic text-[11px]">
                                    None (Initial creation)
                                  </span>
                                )}
                              </div>

                              <div className="bg-stone-50 p-3 rounded-lg border border-emerald-200">
                                <span className="text-[10px] font-bold uppercase text-emerald-800 block mb-1">
                                  Raw New State
                                </span>
                                {log.newState ? (
                                  <pre className="text-[11px] font-mono text-stone-800 whitespace-pre-wrap overflow-x-auto">
                                    {JSON.stringify(log.newState, null, 2)}
                                  </pre>
                                ) : (
                                  <span className="text-stone-400 italic text-[11px]">
                                    No state change data
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
