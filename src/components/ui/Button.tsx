import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'touch';
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors select-none focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const variants = {
    primary: 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs rounded-lg active:bg-emerald-900',
    secondary: 'bg-stone-100 hover:bg-stone-200 text-stone-900 rounded-lg border border-stone-300 active:bg-stone-300',
    outline: 'border border-emerald-700 text-emerald-800 hover:bg-emerald-50 bg-white rounded-lg active:bg-emerald-100',
    danger: 'bg-red-700 hover:bg-red-800 text-white rounded-lg active:bg-red-900',
    ghost: 'text-stone-700 hover:bg-stone-100 rounded-lg active:bg-stone-200',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 min-h-[36px]',
    md: 'text-sm px-4 py-2 min-h-[42px]',
    lg: 'text-base px-5 py-2.5 min-h-[48px]',
    touch: 'text-base font-semibold px-6 py-3.5 min-h-[52px] rounded-xl shadow-sm', // Specially designed for mobile shop owner
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Processing...</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </span>
      )}
    </button>
  );
};
