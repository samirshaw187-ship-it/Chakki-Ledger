import React from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

export interface TableFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
}

export const TableFilterBar: React.FC<TableFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  placeholder = 'Search records...',
  children,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 bg-white border border-stone-200 rounded-t-xl">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
        />
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
};

export interface TableHeaderProps {
  columns: {
    key: string;
    label: string;
    align?: 'left' | 'center' | 'right';
    className?: string;
  }[];
}

export const TableHeader: React.FC<TableHeaderProps> = ({ columns }) => {
  return (
    <thead className="bg-stone-50 border-b border-stone-200">
      <tr>
        {columns.map((col) => (
          <th
            key={col.key}
            className={`px-3 sm:px-4 py-2.5 text-[11px] font-bold text-stone-600 uppercase tracking-wider ${
              col.align === 'right'
                ? 'text-right'
                : col.align === 'center'
                ? 'text-center'
                : 'text-left'
            } ${col.className || ''}`}
          >
            {col.label}
          </th>
        ))}
      </tr>
    </thead>
  );
};

export interface TableRowProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const TableRow: React.FC<TableRowProps> = ({ children, onClick, className = '' }) => {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-stone-100 last:border-0 hover:bg-stone-50/70 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </tr>
  );
};

export interface TableCellProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
  colSpan?: number;
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  align = 'left',
  className = '',
  colSpan,
}) => {
  return (
    <td
      colSpan={colSpan}
      className={`px-3 sm:px-4 py-3 text-xs text-stone-700 ${
        align === 'right'
          ? 'text-right'
          : align === 'center'
          ? 'text-center'
          : 'text-left'
      } ${className}`}
    >
      {children}
    </td>
  );
};

export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalPages,
  totalRecords,
  onPageChange,
  pageSize = 10,
}) => {
  const fromRecord = Math.min((currentPage - 1) * pageSize + 1, totalRecords);
  const toRecord = Math.min(currentPage * pageSize, totalRecords);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-stone-50 border-t border-stone-200 rounded-b-xl text-xs text-stone-500">
      <div>
        Showing <span className="font-semibold text-stone-800">{fromRecord}</span> to{' '}
        <span className="font-semibold text-stone-800">{toRecord}</span> of{' '}
        <span className="font-semibold text-stone-800">{totalRecords}</span> entries
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 rounded border border-stone-200 bg-white text-stone-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-100 transition-colors"
          title="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-2 font-medium text-stone-700">
          Page {currentPage} of {Math.max(1, totalPages)}
        </span>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 rounded border border-stone-200 bg-white text-stone-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-100 transition-colors"
          title="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export interface DataTableProps {
  children: React.ReactNode;
  className?: string;
}

export const DataTable: React.FC<DataTableProps> = ({ children, className = '' }) => {
  return (
    <div className={`overflow-x-auto bg-white border-x border-stone-200 ${className}`}>
      <table className="w-full text-left border-collapse">{children}</table>
    </div>
  );
};
