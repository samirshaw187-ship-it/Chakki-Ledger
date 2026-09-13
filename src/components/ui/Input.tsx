import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefixSymbol?: string;
  suffixSymbol?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  prefixSymbol,
  suffixSymbol,
  id,
  className = '',
  ...props
}) => {
  const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={generatedId} className="block text-sm font-medium text-stone-800 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative rounded-lg shadow-xs">
        {prefixSymbol && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-600 font-medium text-sm">
            {prefixSymbol}
          </div>
        )}
        <input
          id={generatedId}
          className={`block w-full rounded-lg border bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 text-base py-2.5 ${
            prefixSymbol ? 'pl-9' : 'pl-3.5'
          } ${suffixSymbol ? 'pr-12' : 'pr-3.5'} ${
            error ? 'border-red-500 text-red-900 focus:ring-red-500' : 'border-stone-300'
          } ${className}`}
          {...props}
        />
        {suffixSymbol && (
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-stone-600 text-xs font-semibold uppercase">
            {suffixSymbol}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>}
      {!error && helperText && <p className="mt-1 text-xs text-stone-600">{helperText}</p>}
    </div>
  );
};
