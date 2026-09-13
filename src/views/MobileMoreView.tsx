import React, { useState } from 'react';
import {
  Boxes,
  Wheat,
  Truck,
  FileSpreadsheet,
  Lock,
  Settings,
  HardDriveDownload,
  ShieldCheck,
  User as UserIcon,
  LogOut,
} from 'lucide-react';
import { UserRole } from '../types';
import { canAccessRoute, ROLE_METADATA } from '../modules/auth';
import { MenuList, MenuItem } from '../components/ui/MenuList';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';

export interface MobileMoreViewProps {
  onNavigate: (path: string) => void;
  activeRole: UserRole;
  userName?: string;
  userPhone?: string;
  onRoleChange: (role: UserRole) => void;
  onLogout?: () => void;
}

export const MobileMoreView: React.FC<MobileMoreViewProps> = ({
  onNavigate,
  activeRole,
  userName,
  userPhone,
  onRoleChange,
  onLogout,
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const roleMeta = ROLE_METADATA[activeRole];

  // 1. Operational Group
  const operationalItems: MenuItem[] = [
    {
      path: '/app/inventory',
      label: 'Inventory',
      sublabel: 'Grain stock, wheat in mill & bran (choker)',
      icon: Boxes,
    },
    {
      path: '/app/rice-trading',
      label: 'Rice Trading',
      sublabel: 'Ration rice purchases & resale tracking',
      icon: Wheat,
    },
    {
      path: '/app/wholesalers',
      label: 'Wholesalers',
      sublabel: 'Bulk grain buyers & mandi dispatches',
      icon: Truck,
    },
  ].filter((item) => canAccessRoute(item.path!, activeRole));

  // 2. Business Group
  const businessItems: MenuItem[] = [
    {
      path: '/app/reports',
      label: 'Reports',
      sublabel: 'Daily statements, khata dues & sales reports',
      icon: FileSpreadsheet,
    },
    {
      path: '/app/daily-closing',
      label: 'Daily Closing',
      sublabel: 'End-of-day register tally & cash verification',
      icon: Lock,
    },
  ].filter((item) => canAccessRoute(item.path!, activeRole));

  // 3. System Group
  const systemItems: MenuItem[] = [
    {
      path: '/app/settings',
      label: 'Settings',
      sublabel: 'Milling rates, shop configuration & pricing',
      icon: Settings,
    },
    {
      path: '/app/backup',
      label: 'Backup',
      sublabel: 'Export ledger data & database snapshot',
      icon: HardDriveDownload,
    },
    {
      path: '/app/audit-logs',
      label: 'Audit Logs',
      sublabel: 'System activities & security event trail',
      icon: ShieldCheck,
    },
  ].filter((item) => canAccessRoute(item.path!, activeRole));

  // 4. Account Group
  const accountItems: MenuItem[] = [
    {
      label: 'My Profile',
      sublabel: `${userName || 'Active User'} (${activeRole})`,
      icon: UserIcon,
      onClick: () => setIsProfileOpen(true),
    },
    {
      label: 'Logout',
      sublabel: 'End current terminal session',
      icon: LogOut,
      destructive: true,
      onClick: onLogout,
    },
  ];

  return (
    <div className="space-y-4 font-sans">
      {/* Top User Session Card */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-base shadow-2xs">
              {userName ? userName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900">{userName || 'Active Operator'}</h2>
              <p className="text-xs text-stone-500 font-mono">
                {userPhone ? `+91 ${userPhone}` : 'Counter Terminal'}
              </p>
            </div>
          </div>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
              roleMeta?.badgeClass || 'bg-stone-100 text-stone-800'
            }`}
          >
            {activeRole}
          </span>
        </div>

        {/* Quick Role Switcher for Fast Evaluation */}
        <div className="pt-2 border-t border-stone-100 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              Switch Test Role
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {(['OWNER', 'STAFF', 'ACCOUNTANT'] as UserRole[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => onRoleChange(role)}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer text-center ${
                  activeRole === role
                    ? 'bg-emerald-800 text-white border-emerald-800 shadow-2xs'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {role === 'OWNER' ? 'Owner' : role === 'STAFF' ? 'Staff' : 'Acct'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Groups: Operational, Business, System, Account */}
      {operationalItems.length > 0 && (
        <MenuList title="Operational" items={operationalItems} onNavigate={onNavigate} />
      )}

      {businessItems.length > 0 && (
        <MenuList title="Business" items={businessItems} onNavigate={onNavigate} />
      )}

      {systemItems.length > 0 && (
        <MenuList title="System" items={systemItems} onNavigate={onNavigate} />
      )}

      <MenuList title="Account" items={accountItems} onNavigate={onNavigate} />

      {/* Profile Modal */}
      <Modal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        title="My Profile"
        subtitle="Current session details"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500">Name</span>
              <span className="text-xs font-bold text-stone-900">{userName || 'Shop Operator'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500">Phone</span>
              <span className="text-xs font-mono font-medium text-stone-800">
                {userPhone ? `+91 ${userPhone}` : 'Not assigned'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500">Active Role</span>
              <span
                className={`text-[11px] font-bold px-1.5 py-0.2 rounded border ${
                  roleMeta?.badgeClass || 'bg-stone-100 text-stone-700'
                }`}
              >
                {activeRole}
              </span>
            </div>
          </div>
          <p className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-lg border border-stone-100">
            {roleMeta?.description}
          </p>
          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsProfileOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
