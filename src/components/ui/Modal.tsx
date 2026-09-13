import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full ${maxWidths[maxWidth]} bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-150`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-100 bg-stone-50/50">
          <div>
            <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
            {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 max-h-[75vh] overflow-y-auto">{children}</div>

        {footer && <div className="p-4 sm:p-5 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
};
