import React, { useState } from 'react';
import { UserRole } from '../../types';
import { DesktopHeader } from './DesktopHeader';
import { DesktopSidebar } from './DesktopSidebar';

export interface AdminShellProps {
  activeRole: UserRole;
  userName?: string;
  onRoleChange: (role: UserRole) => void;
  activePath: string;
  onNavigate: (path: string) => void;
  onToggleLayout: () => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

export const AdminShell: React.FC<AdminShellProps> = ({
  activeRole,
  userName,
  onRoleChange,
  activePath,
  onNavigate,
  onToggleLayout,
  onLogout,
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-sans selection:bg-emerald-100">
      {/* Desktop Admin Header */}
      <DesktopHeader
        activeRole={activeRole}
        userName={userName}
        onRoleChange={onRoleChange}
        onToggleLayout={onToggleLayout}
        onLogout={onLogout}
      />

      {/* Admin Layout with Left Sidebar and Scrollable Content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Responsive Desktop Sidebar (collapsible on tablet/desktop) */}
        <DesktopSidebar
          activePath={activePath}
          activeRole={activeRole}
          userName={userName}
          onNavigate={onNavigate}
          onLogout={onLogout}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};
