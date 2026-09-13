import React from 'react';
import { LucideIcon, ChevronRight } from 'lucide-react';

export interface MenuItem {
  id?: string;
  path?: string;
  label: string;
  sublabel?: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: 'emerald' | 'amber' | 'stone' | 'red';
  onClick?: () => void;
  destructive?: boolean;
}

export interface MenuGroupProps {
  title?: string;
  items: MenuItem[];
  onNavigate?: (path: string) => void;
}

export const MenuList: React.FC<MenuGroupProps> = ({ title, items, onNavigate }) => {
  const badgeClasses = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    stone: 'bg-stone-100 text-stone-700 border-stone-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div className="space-y-1.5">
      {title && (
        <p className="text-xs font-bold text-stone-600 uppercase tracking-wider px-1">
          {title}
        </p>
      )}
      <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100 overflow-hidden shadow-2xs">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const handleClick = () => {
            if (item.onClick) {
              item.onClick();
            } else if (item.path && onNavigate) {
              onNavigate(item.path);
            }
          };

          return (
            <button
              key={item.id || item.label || idx}
              type="button"
              onClick={handleClick}
              className={`w-full flex items-center justify-between p-3.5 hover:bg-stone-50 active:bg-stone-100 transition-colors text-left cursor-pointer min-h-[48px] ${
                item.destructive ? 'hover:bg-red-50/70 text-red-700' : 'text-stone-900'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    item.destructive
                      ? 'bg-red-100 text-red-700'
                      : 'bg-stone-100 text-stone-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm font-semibold truncate ${
                        item.destructive ? 'text-red-700' : 'text-stone-900'
                      }`}
                    >
                      {item.label}
                    </p>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                          badgeClasses[item.badgeVariant || 'stone']
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {item.sublabel && (
                    <p className="text-xs text-stone-500 truncate mt-0.5">{item.sublabel}</p>
                  )}
                </div>
              </div>
              <ChevronRight
                className={`w-4 h-4 shrink-0 ml-2 ${
                  item.destructive ? 'text-red-400' : 'text-stone-400'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
