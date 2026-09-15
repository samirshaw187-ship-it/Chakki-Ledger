import React from 'react';
import { UserRole } from '../../types';
import { User as UserIcon, Monitor } from 'lucide-react';

export interface MobileHeaderProps {
  pageTitle: string;
  activeRole: UserRole;
  userName?: string;
  onToggleLayout?: () => void;
  onProfileClick?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  pageTitle,
  activeRole,
  userName,
  onToggleLayout,
  onProfileClick,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-stone-200 px-3 py-2 shadow-2xs">
      <div className="flex items-center justify-between gap-2 max-w-md mx-auto">
        {/* Left: Brand Icon + Current Page Title */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs tracking-tight shrink-0 shadow-xs">
            CL
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-stone-900 truncate leading-tight">
              {pageTitle}
            </h1>
            <p className="text-[10px] text-stone-500 truncate leading-none mt-0.5">
              Chakki Ledger
            </p>
          </div>
        </div>

        {/* Right: Controls & User/Profile Icon */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Layout Toggle (Switch to Desktop Admin) */}
          {onToggleLayout && (
            <button
              type="button"
              onClick={onToggleLayout}
              className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
              title="Preview Desktop Back-Office Admin Shell"
              aria-label="Switch to Desktop Admin"
            >
              <Monitor className="w-4 h-4" />
            </button>
          )}

          {/* User / Profile button */}
          <button
            type="button"
            onClick={onProfileClick}
            className="flex items-center gap-1.5 p-1 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors cursor-pointer"
            title={`Logged in as ${userName || 'Operator'} (${activeRole})`}
            aria-label="User Profile"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
              {userName ? userName.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
            </div>
            <span className="text-[11px] font-bold text-stone-700 hidden xs:inline pr-1">
              {activeRole === UserRole.OWNER ? 'Owner' : 'Admin'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
