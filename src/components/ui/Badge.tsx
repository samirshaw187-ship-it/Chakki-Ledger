import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  ...props
}) => {
  const variants = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-red-50 text-red-800 border-red-200',
    info: 'bg-sky-50 text-sky-800 border-sky-200',
    neutral: 'bg-stone-100 text-stone-700 border-stone-200',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs font-medium px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full border whitespace-nowrap ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
