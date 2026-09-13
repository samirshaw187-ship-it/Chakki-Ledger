import React from 'react';
import { ArrowLeft, Boxes, Wheat, Truck, FileSpreadsheet, Lock, Settings, HardDriveDownload, ShieldCheck, Info } from 'lucide-react';
import { SummaryCard } from '../components/domain/SummaryCard';
import { Button } from '../components/ui/Button';

export interface MobileSubmoduleViewProps {
  path: string;
  onNavigate: (path: string) => void;
}

interface SubmoduleConfig {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  metrics?: { label: string; value: string; sub: string; variant?: 'emerald' | 'amber' | 'stone' | 'red' }[];
  sampleRows?: { col1: string; col2: string; col3: string }[];
  tableHeaders?: [string, string, string];
}

const SUBMODULE_CONFIGS: Record<string, SubmoduleConfig> = {
  '/app/inventory': {
    title: 'Grain Inventory & Mill Silos',
    description: 'Track raw wheat, milled atta batches, and bran (choker) storage',
    icon: Boxes,
    metrics: [
      { label: 'Raw Wheat Stock', value: '420 kg', sub: 'In mill holding bins', variant: 'amber' },
      { label: 'Bran (Choker)', value: '35 kg', sub: 'Ready for livestock sale', variant: 'stone' },
    ],
    tableHeaders: ['Commodity', 'Bag Count', 'Net Weight'],
    sampleRows: [
      { col1: 'Raw Desi Wheat', col2: '8 bags', col3: '400.0 kg' },
      { col1: 'Chali Atta (Fresh)', col2: '3 bags', col3: '150.0 kg' },
      { col1: 'Roll Atta (Packed)', col2: '4 bags', col3: '200.0 kg' },
      { col1: 'Choker / Bran', col2: '1 bag', col3: '35.0 kg' },
    ],
  },
  '/app/rice-trading': {
    title: 'Ration Rice Trading',
    description: 'Track rice purchased from customers at ₹21/kg and resale margins',
    icon: Wheat,
    metrics: [
      { label: 'Rice Purchased Today', value: '64 kg', sub: 'At ₹21/kg support rate', variant: 'emerald' },
      { label: 'In-Shop Rice Stock', value: '380 kg', sub: 'Ready for wholesale batch', variant: 'amber' },
    ],
    tableHeaders: ['Customer / Batch', 'Purchase Qty', 'Total Cost'],
    sampleRows: [
      { col1: 'Rahim Sheikh', col2: '15.0 kg', col3: '₹315 (Settled)' },
      { col1: 'Rakesh', col2: '20.0 kg', col3: '₹420 (Cash paid)' },
      { col1: 'Manoj Mondal', col2: '29.0 kg', col3: '₹609 (Khata credit)' },
    ],
  },
  '/app/wholesalers': {
    title: 'Wholesale Buyers & Mandi Dispatch',
    description: 'Manage bulk grain trading, truck dispatches, and wholesale receivables',
    icon: Truck,
    metrics: [
      { label: 'Active Buyers', value: '3 Traders', sub: 'Kolkata & Burdwan Mandi', variant: 'stone' },
      { label: 'Pending Wholesale Due', value: '₹14,500', sub: 'From Gupta Trading Co.', variant: 'red' },
    ],
    tableHeaders: ['Buyer Firm', 'Last Dispatch', 'Balance'],
    sampleRows: [
      { col1: 'Gupta Rice Traders', col2: '450 kg Rice', col3: '₹14,500 Due' },
      { col1: 'Kolkata Flour Mill', col2: '800 kg Wheat', col3: '₹0 Settled' },
      { col1: 'Maa Tara Trading', col2: '300 kg Bran', col3: '₹2,100 Due' },
    ],
  },
  '/app/reports': {
    title: 'Daily Ledger Reports',
    description: 'Detailed daily summaries, customer dues register, and milling yield reports',
    icon: FileSpreadsheet,
    metrics: [
      { label: 'Today Net Cash', value: '₹4,820', sub: 'Counter register balance', variant: 'emerald' },
      { label: 'Total Pending Dues', value: '₹1,420', sub: 'Across 3 customer accounts', variant: 'red' },
    ],
    tableHeaders: ['Report Name', 'Period', 'Format'],
    sampleRows: [
      { col1: "Daily Counter Day Book", col2: 'Today (12 Sep)', col3: 'PDF / Print' },
      { col1: 'Customer Khata Outstanding', col2: 'All Time', col3: 'Passbook' },
      { col1: 'Rice Trading Profit Statement', col2: 'Current Month', col3: 'Excel' },
    ],
  },
  '/app/daily-closing': {
    title: 'Daily Register Closing',
    description: 'End-of-day cash drawer count, UPI reconciliation, and khata closing',
    icon: Lock,
    metrics: [
      { label: 'Expected Drawer Cash', value: '₹3,460', sub: 'Cash transactions total', variant: 'emerald' },
      { label: 'UPI / Digital Total', value: '₹1,360', sub: 'Direct bank credits', variant: 'stone' },
    ],
    tableHeaders: ['Payment Mode', 'Count', 'System Amount'],
    sampleRows: [
      { col1: 'Cash in Counter Drawer', col2: '14 entries', col3: '₹3,460.00' },
      { col1: 'UPI (QR Code Scans)', col2: '6 entries', col3: '₹1,360.00' },
      { col1: 'Credit to Khata Ledger', col2: '3 entries', col3: '₹420.00' },
    ],
  },
  '/app/settings': {
    title: 'Rates & Shop Configuration',
    description: 'Manage active milling fees, grain exchange rates, and business details',
    icon: Settings,
    metrics: [
      { label: 'Chali Atta Rate', value: '₹8/kg', sub: 'Standard milling fee', variant: 'stone' },
      { label: 'Roll Atta Rate', value: '₹10/kg', sub: 'Fine milling fee', variant: 'stone' },
    ],
    tableHeaders: ['Commodity / Service', 'Active Rate', 'Status'],
    sampleRows: [
      { col1: 'Chali Atta Milling', col2: '₹8.00 / kg', col3: 'Active' },
      { col1: 'Roll Atta Milling', col2: '₹10.00 / kg', col3: 'Active' },
      { col1: 'Rice Cash Purchase', col2: '₹21.00 / kg', col3: 'Active' },
      { col1: 'Wheat Cash Purchase', col2: '₹24.00 / kg', col3: 'Active' },
      { col1: 'Roll Atta Retail Sale', col2: '₹40.00 / kg', col3: 'Active' },
    ],
  },
  '/app/backup': {
    title: 'Backup & Data Export',
    description: 'Safeguard your ledger with automated offline backups and encrypted JSON exports',
    icon: HardDriveDownload,
    metrics: [
      { label: 'Last Auto Backup', value: 'Today 04:00 AM', sub: 'Local snapshot verified', variant: 'emerald' },
      { label: 'Total Records', value: '142 Txns', sub: '18 Customers', variant: 'stone' },
    ],
    tableHeaders: ['Backup Archive', 'Created', 'Size'],
    sampleRows: [
      { col1: 'chakki-ledger-2026-09-12.json', col2: '04:00 AM', col3: '48 KB' },
      { col1: 'chakki-ledger-2026-09-11.json', col2: 'Yesterday', col3: '46 KB' },
    ],
  },
  '/app/audit-logs': {
    title: 'Audit Logs & Security Trail',
    description: 'Immutable timeline of every transaction recording, rate update, and staff activity',
    icon: ShieldCheck,
    metrics: [
      { label: 'Logged Events', value: '38 Events', sub: 'Cryptographically hashed', variant: 'emerald' },
      { label: 'Failed Attempts', value: '0', sub: 'Clean security status', variant: 'stone' },
    ],
    tableHeaders: ['Event Type', 'Operator', 'Timestamp'],
    sampleRows: [
      { col1: 'RATE_LOCKED (TX-2026-002)', col2: 'Owner', col3: '09:05 AM' },
      { col1: 'CUSTOMER_BALANCE_UPDATE', col2: 'Staff', col3: '08:20 AM' },
      { col1: 'SYSTEM_SESSION_START', col2: 'Owner', col3: '08:00 AM' },
    ],
  },
};

export const MobileSubmoduleView: React.FC<MobileSubmoduleViewProps> = ({ path, onNavigate }) => {
  const config = SUBMODULE_CONFIGS[path] || {
    title: 'Operational Submodule',
    description: 'Chakki business management module',
    icon: Info,
  };

  const Icon = config.icon;

  return (
    <div className="space-y-4 font-sans">
      {/* Back Button */}
      <button
        type="button"
        onClick={() => onNavigate('/app/more')}
        className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer py-1"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to More Tools</span>
      </button>

      {/* Header with Title and Description */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-100 shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight truncate">
              {config.title}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5 leading-tight">
              {config.description}
            </p>
          </div>
        </div>

        {/* Clear Notice Badge */}
        <div className="mt-2 pt-2 border-t border-stone-100 flex items-center gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200 text-xs text-stone-600">
          <Info className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="font-medium">
            This feature will be implemented in a subsequent update.
          </span>
        </div>
      </div>

      {/* Optional Demo Metrics */}
      {config.metrics && (
        <div className="grid grid-cols-2 gap-2.5">
          {config.metrics.map((m, idx) => (
            <SummaryCard
              key={idx}
              label={m.label}
              value={m.value}
              subtext={m.sub}
              variant={m.variant}
            />
          ))}
        </div>
      )}

      {/* Sample Visual Table / Card Container */}
      {config.sampleRows && config.tableHeaders && (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
          <div className="p-3 bg-stone-50/80 border-b border-stone-200 flex items-center justify-between">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Preview Data Schema
            </span>
            <span className="text-[10px] font-semibold text-stone-500 bg-white px-2 py-0.5 rounded border border-stone-200">
              Sample View
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-100 text-stone-500 font-semibold bg-white">
                  <th className="p-3">{config.tableHeaders[0]}</th>
                  <th className="p-3">{config.tableHeaders[1]}</th>
                  <th className="p-3 text-right">{config.tableHeaders[2]}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {config.sampleRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-stone-50/60">
                    <td className="p-3 font-medium text-stone-900">{row.col1}</td>
                    <td className="p-3 text-stone-600">{row.col2}</td>
                    <td className="p-3 text-right font-mono font-semibold text-stone-800">{row.col3}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
