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
}

const SUBMODULE_CONFIGS: Record<string, SubmoduleConfig> = {
  '/app/inventory': {
    title: 'Grain Inventory & Mill Silos',
    description: 'Track raw wheat, milled atta batches, and bran (choker) storage',
    icon: Boxes,
  },
  '/app/rice-trading': {
    title: 'Ration Rice Trading',
    description: 'Track rice purchased from customers at market rates and resale margins',
    icon: Wheat,
  },
  '/app/wholesalers': {
    title: 'Wholesale Buyers & Mandi Dispatch',
    description: 'Manage bulk grain trading, truck dispatches, and wholesale receivables',
    icon: Truck,
  },
  '/app/reports': {
    title: 'Daily Ledger Reports',
    description: 'Detailed daily summaries, customer dues register, and milling yield reports',
    icon: FileSpreadsheet,
  },
  '/app/daily-closing': {
    title: 'Daily Register Closing',
    description: 'End-of-day cash drawer count, UPI reconciliation, and khata closing',
    icon: Lock,
  },
  '/app/settings': {
    title: 'Rates & Shop Configuration',
    description: 'Manage active milling fees, grain exchange rates, and business details',
    icon: Settings,
  },
  '/app/backup': {
    title: 'Backup & Data Export',
    description: 'Safeguard your ledger with automated offline backups and encrypted JSON exports',
    icon: HardDriveDownload,
  },
  '/app/audit-logs': {
    title: 'Audit Logs & Security Trail',
    description: 'Immutable timeline of every transaction recording, rate update, and staff activity',
    icon: ShieldCheck,
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
      </div>

      {/* Empty State / Clean module state */}
      <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-2xs">
        <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3 text-stone-400">
          <Icon className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-stone-800">No records found</p>
        <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
          This module is initialized with a clean state. Records will appear here as operations are performed.
        </p>
      </div>
    </div>
  );
};
