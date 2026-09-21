import React, { useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { dbRepository } from '../db/in-memory-db';
import { AuditService } from '../services/audit.service';
import { RateService } from '../services/rate.service';
import { ShieldCheck, HardDriveDownload, Download, Plus, CheckCircle2, Receipt, Truck } from 'lucide-react';
import { UserManagementView } from './UserManagementView';
import { AdminCustomersView } from './AdminCustomersView';
import { AdminAuditLogsView } from './admin/AdminAuditLogsView';
import { SettingsService, RateFieldName } from '../services/settings.service';
import { useAuth } from '../modules/auth/AuthContext';

export interface AdminModuleViewProps {
  modulePath: string;
  onNavigate: (path: string) => void;
}

export const AdminModuleView: React.FC<AdminModuleViewProps> = ({ modulePath, onNavigate }) => {
  const { user } = useAuth();
  const [currentRates, setCurrentRates] = useState(() => RateService.getCurrentRates());
  const [editingRate, setEditingRate] = useState<RateFieldName | null>(null);
  const [editValue, setEditValue] = useState('');
  const [rateMessage, setRateMessage] = useState<string | null>(null);
  const customers = dbRepository.getCustomers();
  const transactions = dbRepository.getTransactions();
  const wholesalers = dbRepository.getWholesalers();
  const auditLogs = AuditService.getAllLogs();

  // CUSTOMERS ADMIN VIEW
  if (modulePath === '/admin/customers') {
    return <AdminCustomersView onNavigate={onNavigate} />;
  }

  // TRANSACTIONS ADMIN VIEW
  if (modulePath === '/admin/transactions') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Master Transactions Register"
          description="Central source of truth for all milling, rice trading, and payment entries"
          breadcrumbs={['Admin', 'Transactions']}
        />
        {transactions.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-8 text-center shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3 text-stone-400">
              <Receipt className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-stone-800">No transactions recorded yet</p>
            <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
              The register is clean. Transactions created through the counter or mobile interface will be recorded here in the master ledger.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 font-semibold text-stone-600 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Txn #</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Applied Rate Snapshot</th>
                  <th className="p-3 text-right">Net Amount</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-stone-50/70">
                    <td className="p-3 font-mono font-bold text-stone-700">{tx.transactionNumber}</td>
                    <td className="p-3 text-stone-500">{new Date(tx.date).toLocaleString('en-IN')}</td>
                    <td className="p-3 font-medium text-stone-900">{tx.customerName || 'General Customer'}</td>
                    <td className="p-3 font-medium text-stone-700">{tx.type.replace(/_/g, ' ')}</td>
                    <td className="p-3 font-mono text-stone-500">
                      {tx.items && tx.items[0] ? `${tx.items[0].quantity} ${tx.items[0].unit} @ ₹${tx.items[0].ratePerUnit}/${tx.items[0].unit}` : '-'}
                    </td>
                    <td className="p-3 text-right font-bold text-stone-900">₹{(tx.netAmount ?? 0).toFixed(2)}</td>
                    <td className="p-3 text-center"><StatusBadge status={tx.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // AUDIT LOGS ADMIN VIEW
  if (modulePath === '/admin/audit-logs') {
    return <AdminAuditLogsView onNavigate={onNavigate} />;
  }

  // SETTINGS & RATE CONFIGURATION
  if (modulePath === '/admin/settings') {
    const editableRates: Array<{ field: RateFieldName; label: string; description: string }> = [
      { field: 'chaliAttaExchangeRate', label: 'Chali Atta Exchange Rate', description: 'Standard coarse flour exchange rate' },
      { field: 'rollAttaExchangeRate', label: 'Roll Atta Exchange Rate', description: 'Fine roll-milled flour exchange rate' },
      { field: 'chaliAttaSellingRate', label: 'Chali Atta Selling Rate', description: 'Direct chali atta selling rate' },
      { field: 'rollAttaSellingRate', label: 'Roll Atta Selling Rate', description: 'Direct roll atta selling rate' },
      { field: 'ricePurchaseRate', label: 'Rice Purchase Rate', description: 'Standard rice purchase rate' },
      { field: 'riceCashPurchaseRate', label: 'Rice Cash Purchase Rate', description: 'Rice cash settlement rate' },
      { field: 'wheatCashPurchaseRate', label: 'Wheat Cash Purchase Rate', description: 'Wheat cash settlement rate' },
    ];

    const saveRate = (field: RateFieldName) => {
      try {
        if (!user) throw new Error('Please sign in again before changing rates.');
        const value = Number(editValue);
        SettingsService.updateRate(field, value, user, `Updated ${field}`);
        setCurrentRates(SettingsService.getActiveRates());
        setEditingRate(null);
        setRateMessage('Rate updated. New transactions will use the new value; existing transactions retain their applied rate.');
      } catch (error: any) {
        setRateMessage(error.message || 'Unable to update rate.');
      }
    };

    return (
      <div className="space-y-6">
        <PageHeader
          title="Business & Rate Configuration"
          description="Manage standard chakki milling rates and grain purchase prices. Old records retain historic rates."
          breadcrumbs={['Admin', 'Settings']}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Current Active Rates">
            <div className="space-y-3 text-sm">
              {rateMessage && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{rateMessage}</p>}
              {editableRates.map(({ field, label, description }) => {
                const value = Number(currentRates[field] ?? 0);
                const isEditing = editingRate === field;
                return (
                  <div key={field} className="p-3 bg-stone-50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-stone-900">{label}</p>
                        <p className="text-xs text-stone-500">{description}</p>
                      </div>
                      {!isEditing && <span className="font-mono font-bold text-base text-stone-900">₹{value.toFixed(2)} / kg</span>}
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input type="number" min="0" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 font-mono" />
                        <Button size="sm" onClick={() => saveRate(field)}>Save New Rate</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingRate(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => { setEditingRate(field); setEditValue(String(value)); setRateMessage(null); }}>Edit</Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Rate Immutability Guarantee">
            <div className="space-y-3 text-xs text-stone-600 leading-relaxed">
              <p>
                In <strong>Chakki Ledger</strong>, every transaction stores the exact applied rate at the moment the transaction was created.
              </p>
              <p>
                When rates are adjusted in this panel, future transactions will adopt the new rate immediately, while all historical diary records and customer balances remain 100% stable and verifiable for dispute resolution.
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // USERS & ROLES
  if (modulePath === '/admin/users') {
    return <UserManagementView />;
  }

  // WHOLESALERS
  if (modulePath === '/admin/wholesalers') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Wholesalers & Mandi Buyers"
          description="Rice reselling partners, bulk grain dispatch, and wholesale accounts"
          breadcrumbs={['Admin', 'Wholesalers']}
        />
        {wholesalers.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-8 text-center shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3 text-stone-400">
              <Truck className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-stone-800">No wholesalers registered yet</p>
            <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
              Wholesale buyers, rice mill partners, and mandi traders will appear here once registered.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {wholesalers.map((w) => (
              <Card key={w.id} title={w.name} subtitle={w.companyName || undefined}>
                <div className="space-y-2 text-xs text-stone-600">
                  <p><strong>Address:</strong> {w.address || 'Central Mandi'}</p>
                  <p><strong>Phone:</strong> {w.phone || '-'}</p>
                  <div className="flex justify-between pt-2 border-t border-stone-100">
                    <span>Total Rice Purchased:</span>
                    <span className="font-mono font-semibold text-stone-900">{w.totalRicePurchasedKg} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Receivable Dues:</span>
                    <span className="font-mono font-bold text-emerald-800">₹{(w.totalOutstandingPayment ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // GENERIC PLACEHOLDER ARCHITECTURAL SCAFFOLD FOR REMAINING MODULES:
  // inventory, rice-trading, reports, analytics, daily-closing, backup
  const moduleTitles: Record<string, { title: string; desc: string }> = {
    '/admin/inventory': {
      title: 'Inventory & Grain Silos',
      desc: 'Stock management for raw wheat, paddy, finished chali/roll atta, and bran (choker)',
    },
    '/admin/rice-trading': {
      title: 'Ration Rice Trading Desk',
      desc: 'Customer purchase reconciliation, wholesale batch packaging, and margin analysis',
    },
    '/admin/reports': {
      title: 'Financial & Ledger Reports',
      desc: 'Day book, customer outstanding reports, khata statements, and tax-ready summaries',
    },
    '/admin/analytics': {
      title: 'Business Analytics & Yield',
      desc: 'Milling conversion ratio, seasonal peak insights, and profitability trends',
    },
    '/admin/daily-closing': {
      title: 'Daily Closing Register',
      desc: 'End-of-day physical cash drawer count and stock reconciliation',
    },
    '/admin/backup': {
      title: 'Backup & Ledger Export',
      desc: 'Offline JSON/CSV export, data integrity verification, and archive management',
    },
  };

  const meta = moduleTitles[modulePath] || {
    title: 'Module Architectural Foundation',
    desc: 'Modular boundary established for subsequent step implementation',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={meta.title}
        description={meta.desc}
        breadcrumbs={['Admin', meta.title]}
      />

      <div className="bg-white rounded-xl border border-stone-200 p-8 text-center space-y-4 shadow-2xs">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="max-w-md mx-auto">
          <h3 className="text-base font-bold text-stone-900">{meta.title} Foundation Ready</h3>
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">
            The data models, service contracts, and route hooks for this module have been formally architected and integrated into the project foundation.
            Its complete business workflows and views will be populated in subsequent prompt iterations.
          </p>
        </div>
      </div>
    </div>
  );
};
