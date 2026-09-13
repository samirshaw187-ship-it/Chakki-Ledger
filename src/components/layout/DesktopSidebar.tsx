import React, { useState } from 'react';
import { UserRole } from '../../types';
import {
  LayoutDashboard,
  Users,
  Receipt,
  Boxes,
  Wheat,
  Truck,
  FileSpreadsheet,
  TrendingUp,
  Lock,
  UserCheck,
  ShieldCheck,
  Settings,
  HardDriveDownload,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  User as UserIcon,
  Banknote,
} from 'lucide-react';
import { canAccessRoute, ROLE_METADATA } from '../../modules/auth';

export interface DesktopSidebarProps {
  activePath: string;
  activeRole: UserRole;
  userName?: string;
  onNavigate: (path: string) => void;
  onLogout?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activePath,
  activeRole,
  userName,
  onNavigate,
  onLogout,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const roleMeta = ROLE_METADATA[activeRole];

  const navGroups = [
    {
      section: 'Operations',
      items: [
        { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/admin/customers', label: 'Customers', icon: Users },
        { path: '/admin/transactions', label: 'Transactions', icon: Receipt },
        { path: '/admin/payments', label: 'Payments & Dues', icon: Banknote },
        { path: '/admin/inventory', label: 'Inventory', icon: Boxes },
      ],
    },
    {
      section: 'Grain Trading',
      items: [
        { path: '/admin/rice-trading', label: 'Rice Trading', icon: Wheat },
        { path: '/admin/wholesalers', label: 'Wholesalers', icon: Truck },
      ],
    },
    {
      section: 'Accounting & Analytics',
      items: [
        { path: '/admin/reports', label: 'Reports', icon: FileSpreadsheet },
        { path: '/admin/analytics', label: 'Analytics', icon: TrendingUp },
        { path: '/admin/daily-closing', label: 'Daily Closing', icon: Lock },
      ],
    },
    {
      section: 'Administration',
      items: [
        { path: '/admin/users', label: 'Users', icon: UserCheck },
        { path: '/admin/audit-logs', label: 'Audit Logs', icon: ShieldCheck },
        { path: '/admin/settings', label: 'Settings', icon: Settings },
        { path: '/admin/backup', label: 'Backup', icon: HardDriveDownload },
      ],
    },
  ];

  // Filter items by role permissions
  const filteredNav = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessRoute(item.path, activeRole)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={`bg-white border-r border-stone-200 p-3 shrink-0 flex flex-col justify-between transition-all duration-200 ${
        isCollapsed ? 'w-18' : 'w-64'
      }`}
    >
      <div className="space-y-4">
        {/* Collapse / Expand Button Header */}
        <div className="flex items-center justify-between px-2 py-1">
          {!isCollapsed && (
            <span className="text-[10px] uppercase tracking-wider font-bold text-stone-500">
              Admin Navigation
            </span>
          )}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors ml-auto"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Nav links */}
        <div className="space-y-4">
          {filteredNav.map((group) => (
            <div key={group.section} className="space-y-0.5">
              {!isCollapsed && (
                <p className="text-[10px] font-bold text-stone-600 uppercase tracking-wider px-2.5 mb-1">
                  {group.section}
                </p>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activePath === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => onNavigate(item.path)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center p-2.5' : 'justify-between px-2.5 py-2'
                    } rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-emerald-700 text-white font-semibold shadow-xs'
                        : 'text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      {!isCollapsed && <span>{item.label}</span>}
                    </div>
                    {!isCollapsed && isActive && <ChevronRight className="w-3.5 h-3.5 opacity-80" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Profile & Logout */}
      <div className="pt-3 border-t border-stone-200 space-y-2">
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-2 px-1">
              <div className="w-7 h-7 rounded-full bg-stone-100 border border-stone-300 flex items-center justify-center text-stone-700 shrink-0 text-xs font-bold">
                {userName ? userName.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-stone-900 truncate">
                  {userName || 'Active User'}
                </p>
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border inline-block ${roleMeta?.badgeClass || 'bg-stone-100 text-stone-700'}`}>
                  {activeRole}
                </span>
              </div>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium text-stone-600 hover:text-red-700 hover:bg-red-50 border border-stone-200 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-7 h-7 rounded-full bg-stone-100 border border-stone-300 flex items-center justify-center text-stone-700 text-xs font-bold"
              title={`${userName || 'User'} (${activeRole})`}
            >
              {userName ? userName.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 text-stone-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
