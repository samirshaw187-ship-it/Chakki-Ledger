import React, { useState } from 'react';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { UserRole } from '../../types';
import { ROLE_METADATA } from '../../modules/auth';
import { LogOut, User, Phone, Shield } from 'lucide-react';

export interface MobileShellProps {
  activeRole: UserRole;
  userName?: string;
  userPhone?: string;
  onRoleChange: (role: UserRole) => void;
  activePath: string;
  onNavigate: (path: string) => void;
  onToggleLayout: () => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

export const MobileShell: React.FC<MobileShellProps> = ({
  activeRole,
  userName,
  userPhone,
  onRoleChange,
  activePath,
  onNavigate,
  onToggleLayout,
  onLogout,
  children,
}) => {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Compute a clean title for the mobile header based on route
  const getPageTitle = (path: string): string => {
    if (path === '/app/home' || path === '/app') return 'Shop Counter';
    if (path === '/app/customers') return 'Customer Directory';
    if (path.startsWith('/app/customers/')) return 'Customer Profile';
    if (path === '/app/transactions/new') return 'New Transaction';
    if (path === '/app/transactions') return 'Transactions';
    if (path.startsWith('/app/transactions/')) return 'Transaction Detail';
    if (path === '/app/ledger') return 'Khata Ledger';
    if (path === '/app/more') return 'More Tools';
    if (path === '/app/inventory') return 'Grain Stock';
    if (path === '/app/rice-trading') return 'Rice Trading';
    if (path === '/app/wholesalers') return 'Wholesale Buyers';
    if (path === '/app/reports') return 'Ledger Reports';
    if (path === '/app/settings') return 'Rates & Config';
    if (path === '/app/daily-closing') return 'Daily Closing';
    return 'Chakki Ledger';
  };

  const roleMeta = ROLE_METADATA[activeRole];

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-sans selection:bg-emerald-100">
      {/* Compact Top Mobile Header */}
      <MobileHeader
        pageTitle={getPageTitle(activePath)}
        activeRole={activeRole}
        userName={userName}
        onToggleLayout={onToggleLayout}
        onProfileClick={() => setIsProfileModalOpen(true)}
      />

      {/* Main Mobile Screen Wrapper - strictly constrained to mobile width, centered */}
      <main className="flex-1 max-w-md w-full mx-auto bg-stone-50 pb-24 shadow-sm border-x border-stone-200 min-h-[calc(100vh-50px)]">
        <div className="p-3.5 sm:p-4">{children}</div>
      </main>

      {/* 5-Item Mobile Bottom Navigation */}
      <MobileBottomNav activePath={activePath} onNavigate={onNavigate} />

      {/* Quick Profile Modal */}
      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="Active User Profile"
        subtitle="Current shop operator session details"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
            <div className="w-12 h-12 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-lg">
              {userName ? userName.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-stone-900 truncate">
                {userName || 'Active Operator'}
              </h4>
              <p className="text-xs text-stone-500 font-mono">
                {userPhone ? `+91 ${userPhone}` : 'Counter Terminal'}
              </p>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border inline-block mt-1 ${roleMeta?.badgeClass || 'bg-stone-100 text-stone-700'}`}>
                {activeRole}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-stone-600">
            <p className="font-semibold text-stone-800">Assigned Role Authority:</p>
            <p className="p-2.5 bg-stone-50 rounded-lg border border-stone-100 leading-relaxed">
              {roleMeta?.description}
            </p>
          </div>

          {/* Role Switching inside Profile for fast testing */}
          <div className="pt-2 border-t border-stone-100 space-y-1.5">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              Switch Test Role
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['OWNER', 'STAFF', 'ACCOUNTANT'] as UserRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    onRoleChange(role);
                    setIsProfileModalOpen(false);
                  }}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer text-center ${
                    activeRole === role
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {role === 'OWNER' ? 'Owner' : role === 'STAFF' ? 'Staff' : 'Acct'}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsProfileModalOpen(false)}
            >
              Close
            </Button>
            {onLogout && (
              <Button
                variant="danger"
                size="sm"
                leftIcon={<LogOut className="w-3.5 h-3.5" />}
                onClick={() => {
                  setIsProfileModalOpen(false);
                  onLogout();
                }}
              >
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
