import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  action,
  padding = 'md',
  className = '',
  ...props
}) => {
  const paddings = {
    none: 'p-0',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-5',
    lg: 'p-5 sm:p-6',
  };

  return (
    <div
      className={`bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden ${paddings[padding]} ${className}`}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-100">
          <div>
            {title && <h3 className="text-base font-semibold text-stone-900">{title}</h3>}
            {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
