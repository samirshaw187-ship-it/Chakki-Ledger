import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg mx-auto bg-white rounded-t-2xl shadow-2xl border-t border-stone-200 overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200"
        role="dialog"
      >
        <div className="flex items-center justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-stone-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
          <div>
            <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
            {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};
