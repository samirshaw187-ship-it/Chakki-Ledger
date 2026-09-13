import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'An error occurred while loading or processing the request.',
  onRetry,
}) => {
  return (
    <div className="p-6 bg-red-50/70 border border-red-200 rounded-xl flex flex-col items-center text-center">
      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700 mb-2">
        <AlertCircle className="w-5 h-5" />
      </div>
      <h4 className="text-base font-semibold text-red-900 mb-1">{title}</h4>
      <p className="text-sm text-red-700 max-w-md mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="border-red-300 text-red-800 hover:bg-red-100">
          Try Again
        </Button>
      )}
    </div>
  );
};
