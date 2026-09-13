import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from './Button';

export interface NotFoundStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const NotFoundState: React.FC<NotFoundStateProps> = ({
  title = 'Page or Record Not Found',
  message = 'The requested ledger page or record does not exist or has been moved.',
  actionLabel = 'Back to Home',
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded-xl border border-stone-200 shadow-2xs">
      <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 mb-3">
        <HelpCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-stone-900 mb-1">{title}</h3>
      <p className="text-sm text-stone-600 max-w-sm mb-4">{message}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
