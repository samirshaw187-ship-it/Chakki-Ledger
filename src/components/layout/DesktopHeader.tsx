import React from 'react';
import { UserRole } from '../../types';
import { Smartphone, LogOut, User as UserIcon, Shield } from 'lucide-react';
import { ROLE_METADATA } from '../../modules/auth';

export interface DesktopHeaderProps {
  activeRole: UserRole;
  userName?: string;
  onRoleChange: (role: UserRole) => void;
  onToggleLayout: () => void;
  onLogout?: () => void;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  activeRole,
  userName,
  onRoleChange,
  onToggleLayout,
  onLogout,
}) => {
  const roleMeta = ROLE_METADATA[activeRole];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-stone-200 px-4 sm:px-6 py-2.5 shadow-2xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand & Workspace indicator */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            CL
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-stone-900 text-base leading-none">Chakki Ledger</span>
              <span className="bg-stone-100 text-stone-700 text-[11px] font-semibold px-1.5 py-0.5 rounded border border-stone-200">
                Back-Office Admin
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">Grain Trading & Atta Mill Administration</p>
          </div>
        </div>

        {/* Right Actions: Test Role Switcher, Switch to Mobile view, User & Sign Out */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Role Switcher */}
          <div className="flex items-center bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs">
            <span className="text-[11px] font-semibold text-stone-500 px-2 hidden lg:inline">
              Role:
            </span>
            {(['OWNER', 'STAFF', 'ACCOUNTANT'] as UserRole[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => onRoleChange(role)}
                title={`Switch active test session to ${role}`}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  activeRole === role
                    ? 'bg-white text-stone-900 shadow-xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {role === 'OWNER' ? 'Owner' : role === 'STAFF' ? 'Staff' : 'Accountant'}
              </button>
            ))}
          </div>

          {/* Switch to Mobile View Button */}
          <button
            type="button"
            onClick={onToggleLayout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-semibold text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100/70 transition-colors cursor-pointer"
            title="Switch to Mobile Shop Counter view (/app)"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
            <span className="hidden sm:inline">Mobile Counter View</span>
          </button>

          {/* User badge & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-stone-900 leading-tight truncate max-w-[130px]">
                {userName || 'Active User'}
              </p>
              <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border inline-block ${roleMeta?.badgeClass || 'bg-stone-100 text-stone-700'}`}>
                {activeRole}
              </span>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1 p-2 rounded-lg border border-stone-200 text-xs font-medium text-stone-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
                title="Sign Out of Session"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
