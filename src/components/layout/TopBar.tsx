import React from 'react';
import { UserRole } from '../../types';
import { Smartphone, Monitor, ShieldCheck, UserCheck, LogOut } from 'lucide-react';

export interface TopBarProps {
  activeRole: UserRole;
  userName?: string;
  onRoleChange: (role: UserRole) => void;
  isMobileLayout: boolean;
  onToggleLayout: () => void;
  onLogout?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeRole,
  userName,
  onRoleChange,
  isMobileLayout,
  onToggleLayout,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-stone-200 px-3 sm:px-4 py-2 shadow-2xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
        {/* Brand & Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs shrink-0">
            CL
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-stone-900 text-sm sm:text-base leading-none">Chakki Ledger</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-1.5 py-0.5 rounded hidden xs:inline">
                v1.0
              </span>
            </div>
            {userName && (
              <p className="text-[11px] text-stone-500 leading-tight truncate max-w-[140px] sm:max-w-none">
                {userName}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls: Role switch, View Mode toggle, and Logout */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Role Switcher (Visible on medium+ screens or compact on mobile) */}
          <div className="flex items-center bg-stone-100 p-0.5 sm:p-1 rounded-lg border border-stone-200 text-xs">
            {([UserRole.OWNER, UserRole.ADMIN] as UserRole[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => onRoleChange(role)}
                title={`Switch active test session to ${role}`}
                className={`px-1.5 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-colors cursor-pointer ${
                  activeRole === role
                    ? 'bg-white text-stone-900 shadow-xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {role === UserRole.OWNER ? 'Shop Owner' : 'Admin'}
              </button>
            ))}
          </div>

          {/* Mode Switcher Button (Mobile vs Desktop Admin) */}
          <button
            type="button"
            onClick={onToggleLayout}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
            title={isMobileLayout ? 'Switch to Desktop Admin Shell' : 'Switch to Mobile Shop Operator Shell'}
          >
            {isMobileLayout ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-stone-600" />
                <span className="hidden md:inline">Admin</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden md:inline">Mobile</span>
              </>
            )}
          </button>

          {/* Logout Button */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
              title="Sign Out of Session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
