import React from 'react';
import { Home, Users, PlusCircle, BookOpen, Menu } from 'lucide-react';

export interface MobileBottomNavProps {
  activePath: string;
  onNavigate: (path: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activePath, onNavigate }) => {
  const navItems = [
    { path: '/app/home', label: 'Home', icon: Home },
    { path: '/app/customers', label: 'Customers', icon: Users },
    {
      path: '/app/transactions/new',
      label: 'New Entry',
      icon: PlusCircle,
      isProminent: true,
    },
    { path: '/app/ledger', label: 'Ledger', icon: BookOpen },
    { path: '/app/more', label: 'More', icon: Menu },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 px-2 py-1 shadow-lg safe-area-bottom"
      aria-label="Mobile Navigation"
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activePath === item.path ||
            (item.path === '/app/home' && activePath === '/app') ||
            (item.path === '/app/customers' && activePath.startsWith('/app/customers/')) ||
            (item.path === '/app/more' &&
              (activePath.startsWith('/app/inventory') ||
                activePath.startsWith('/app/rice-trading') ||
                activePath.startsWith('/app/wholesalers') ||
                activePath.startsWith('/app/reports') ||
                activePath.startsWith('/app/settings') ||
                activePath.startsWith('/app/daily-closing')));

          if (item.isProminent) {
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate(item.path)}
                className="flex flex-col items-center -mt-4 focus:outline-none cursor-pointer group px-2"
                aria-label="Create New Transaction"
              >
                <div
                  className={`w-13 h-13 rounded-full flex items-center justify-center shadow-md transition-all group-active:scale-95 ${
                    isActive
                      ? 'bg-emerald-800 text-white ring-4 ring-emerald-100'
                      : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  }`}
                >
                  <PlusCircle className="w-7 h-7 stroke-[2.2]" />
                </div>
                <span
                  className={`text-[11px] font-bold mt-0.5 ${
                    isActive ? 'text-emerald-800' : 'text-stone-700'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              className={`flex flex-col items-center justify-center py-1.5 px-2 min-w-[54px] min-h-[44px] rounded-lg transition-colors cursor-pointer ${
                isActive
                  ? 'text-emerald-800 font-bold'
                  : 'text-stone-600 hover:text-stone-900 active:bg-stone-50'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={`w-5 h-5 transition-transform ${
                  isActive ? 'stroke-[2.4] scale-105' : 'stroke-[1.8]'
                }`}
              />
              <span className="text-[11px] mt-1 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
