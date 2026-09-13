import React from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  breadcrumbs?: string[];
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badge,
  action,
  breadcrumbs,
}) => {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-stone-600 mb-1.5 font-medium">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb}>
              {idx > 0 && <span>/</span>}
              <span className={idx === breadcrumbs.length - 1 ? 'text-stone-900 font-semibold' : ''}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">{title}</h1>
            {badge && <div>{badge}</div>}
          </div>
          {description && <p className="text-sm text-stone-600 mt-1">{description}</p>}
        </div>
        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
      </div>
    </div>
  );
};
