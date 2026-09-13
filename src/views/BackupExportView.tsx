import React, { useMemo, useState } from 'react';
import { Archive, CheckCircle2, Clock3, Download, FileDown, FileSpreadsheet, HardDriveDownload, History, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { dbRepository } from '../db/in-memory-db';
import { useAuth } from '../modules/auth';
import { BackupExportService, BackupStatus, ExportFormat, ExportKind } from '../services/backup-export.service';
import { ReportService, ReportPreset } from '../services/report.service';

export interface BackupExportViewProps {
  onNavigate: (path: string) => void;
  compactMode?: boolean;
}

const EXPORT_OPTIONS: { value: ExportKind; label: string }[] = [
  { value: 'CUSTOMERS', label: 'Customers' },
  { value: 'TRANSACTIONS', label: 'Transactions with item rows' },
  { value: 'LEDGER', label: 'Customer ledger statement' },
  { value: 'PAYMENTS', label: 'Payments' },
  { value: 'INVENTORY', label: 'Inventory and movements' },
  { value: 'RICE_TRADING', label: 'Rice trading' },
  { value: 'WHOLESALERS', label: 'Wholesalers' },
  { value: 'DAILY_SUMMARY', label: 'Daily business summary' },
  { value: 'MONTHLY_SUMMARY', label: 'Monthly business summary' },
  { value: 'RICE_PROFIT', label: 'Rice profit/loss' },
  { value: 'CUSTOMER_BALANCES', label: 'Customer balances' },
];

const formatBytes = (value?: number): string => value === undefined ? '-' : value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KB`;
const statusLabel = (status: BackupStatus): string => status.replace(/_/g, ' ');

export const BackupExportView: React.FC<BackupExportViewProps> = ({ onNavigate, compactMode = false }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState(BackupExportService.getBackupStatus());
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [kind, setKind] = useState<ExportKind>('TRANSACTIONS');
  const [format, setFormat] = useState<ExportFormat>('CSV');
  const [preset, setPreset] = useState<ReportPreset>('THIS_MONTH');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const customers = useMemo(() => dbRepository.getCustomers(), []);
  const range = ReportService.getDateRange(preset, startDate, endDate);
  const needsDateRange = !['CUSTOMERS', 'WHOLESALERS'].includes(kind);
  const needsCustomer = kind === 'LEDGER';

  const refreshStatus = () => setStatus(BackupExportService.getBackupStatus());

  const handleBackup = async () => {
    if (!user) return;
    setIsBackingUp(true);
    setMessage('Creating backup...');
    const result = await BackupExportService.createBackup(user);
    setStatus(BackupExportService.getBackupStatus());
    setIsBackingUp(false);
    setMessage(result.status === 'SUCCESS' ? 'Backup completed successfully.' : 'Backup failed. Your live data has not been modified.');
  };

  const handleExport = () => {
    if (!user) return;
    if (needsCustomer && !customerId) { setMessage('Select a customer for a ledger statement.'); return; }
    setIsExporting(true);
    setMessage('Preparing export...');
    try {
      const artifact = BackupExportService.generateExport({
        kind,
        format,
        actor: user,
        startDate: needsDateRange ? (preset === 'CUSTOM' ? startDate : range.start) : undefined,
        endDate: needsDateRange ? (preset === 'CUSTOM' ? endDate : range.end) : undefined,
        customerId: customerId || undefined,
      });
      const blob = new Blob([artifact.content], { type: artifact.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = artifact.filename;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`${artifact.rowCount} rows exported.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to generate export.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={compactMode ? 'space-y-4' : 'space-y-6'}>
      {!compactMode && <PageHeader title="Backup & Data Export" description="Protect business data and create permission-controlled copies for analysis." breadcrumbs={['Admin', 'Backup & Export']} />}

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Exports are read-only copies. They never update live customers, transactions, payments, inventory, or balances.</span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Backup status" subtitle={status.provider.replace(/_/g, ' ')}>
          <div className="flex items-center gap-3">
            {status.status === 'SUCCESS' ? <CheckCircle2 className="h-8 w-8 text-emerald-700" /> : status.status === 'FAILED' ? <XCircle className="h-8 w-8 text-red-700" /> : <Clock3 className="h-8 w-8 text-amber-700" />}
            <div>
              <p className="font-bold text-stone-900">{statusLabel(status.status)}</p>
              <p className="text-xs text-stone-500">{status.lastSuccessfulBackup ? `Last verified ${new Date(status.lastSuccessfulBackup.completedAt || status.lastSuccessfulBackup.startedAt).toLocaleString('en-IN')}` : 'No backup has been completed yet.'}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" leftIcon={<HardDriveDownload className="h-4 w-4" />} onClick={handleBackup} isLoading={isBackingUp}>Backup Now</Button>
            <Button size="sm" variant="ghost" aria-label="Refresh backup status" onClick={refreshStatus}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </Card>

        <Card title="Last successful backup">
          <p className="text-2xl font-bold text-stone-900">{status.lastSuccessfulBackup ? formatBytes(status.lastSuccessfulBackup.sizeBytes) : '-'}</p>
          <p className="mt-1 text-xs text-stone-500">Verified snapshot size, when available</p>
          <p className="mt-3 text-xs text-stone-600">{status.lastSuccessfulBackup ? `${status.lastSuccessfulBackup.type} by ${status.lastSuccessfulBackup.initiatedByName}` : 'Production storage provider not connected in this development store.'}</p>
        </Card>

        <Card title="System health">
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-800"><Archive className="h-5 w-5 text-emerald-700" />{status.systemHealth === 'HEALTHY' ? 'Healthy' : 'Attention required'}</div>
          <p className="mt-2 text-xs leading-relaxed text-stone-500">A success is recorded only after the local snapshot can be serialized and verified.</p>
        </Card>
      </div>

      {message && <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700" role="status">{message}</div>}

      <Card title="Create export" subtitle="Choose a business dataset, period, and file format.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-stone-700">Dataset<select className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" value={kind} onChange={(event) => setKind(event.target.value as ExportKind)}>{EXPORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="text-xs font-semibold text-stone-700">Format<select className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}><option value="CSV">CSV</option><option value="XLSX">Excel</option><option value="PDF">PDF</option></select></label>
          {needsDateRange && <label className="text-xs font-semibold text-stone-700">Period<select className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" value={preset} onChange={(event) => setPreset(event.target.value as ReportPreset)}><option value="TODAY">Today</option><option value="THIS_WEEK">This week</option><option value="THIS_MONTH">This month</option><option value="LAST_MONTH">Last month</option><option value="THIS_YEAR">This year</option><option value="CUSTOM">Custom range</option></select></label>}
          {needsCustomer && <label className="text-xs font-semibold text-stone-700">Customer<select className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} ({customer.customerCode})</option>)}</select></label>}
        </div>
        {preset === 'CUSTOM' && <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold text-stone-700">Start date<input type="date" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="text-xs font-semibold text-stone-700">End date<input type="date" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div>}
        <div className="mt-5 flex flex-wrap gap-2"><Button leftIcon={<FileDown className="h-4 w-4" />} onClick={handleExport} isLoading={isExporting}>Generate Export</Button>{format === 'XLSX' && <span className="self-center text-xs text-stone-500"><FileSpreadsheet className="mr-1 inline h-4 w-4" />Excel-compatible workbook</span>}</div>
      </Card>

      <Card title="Backup history" subtitle="Failed attempts remain visible for operational review.">
        {status.lastAttempt ? <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-stone-200 text-stone-500"><tr><th className="p-2">Date / time</th><th className="p-2">Status</th><th className="p-2">Type</th><th className="p-2">Size</th><th className="p-2">Initiated by</th></tr></thead><tbody className="divide-y divide-stone-100">{BackupExportService.getBackupHistory().map((record) => <tr key={record.id}><td className="p-2">{new Date(record.startedAt).toLocaleString('en-IN')}</td><td className="p-2"><StatusBadge status={record.status} /></td><td className="p-2">{record.type}</td><td className="p-2">{formatBytes(record.sizeBytes)}</td><td className="p-2">{record.initiatedByName}</td></tr>)}</tbody></table></div> : <div className="flex items-center gap-2 py-4 text-sm text-stone-500"><History className="h-4 w-4" />No backup attempts recorded yet.</div>}
      </Card>

      <div className="flex items-center justify-between text-xs text-stone-500"><span>Restore is intentionally unavailable here. Production restore requires a protected owner-only maintenance process.</span><Button variant="ghost" size="sm" onClick={() => onNavigate(compactMode ? '/app/more' : '/admin/dashboard')}>Back</Button></div>
    </div>
  );
};
