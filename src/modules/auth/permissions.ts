/**
 * Chakki Ledger - Role-Based Access Control (RBAC) & Permissions Definition
 *
 * System Roles:
 * - OWNER: Complete shop ownership & oversight (counter, back-office, rates, audit logs, user management, backup)
 * - STAFF: Fast counter operator (milling, customer registration, wheat/rice counter entry, cash collection)
 * - ACCOUNTANT: Financial ledger, khata reconciliation, audit logs, reports, daily closing, wholesale
 */

import { UserRole } from '../../types';

export enum Permission {
  // Counter & Customers
  VIEW_COUNTER = 'counter:view',
  CREATE_TRANSACTION = 'transaction:create',
  VIEW_TRANSACTIONS = 'transaction:view',
  CORRECT_TRANSACTION = 'transaction:correct',
  REVERSE_TRANSACTION = 'transaction:reverse',
  VIEW_CUSTOMERS = 'customer:view',
  CREATE_CUSTOMER = 'customer:create',
  EDIT_CUSTOMER = 'customer:edit',
  RECORD_PAYMENT = 'payment:record',
  VIEW_RECEIPTS = 'receipt:view',
  VIEW_MILLING = 'milling:view',

  // Trading & Inventory
  MANAGE_RICE_TRADING = 'ricetrading:manage',
  VIEW_RICE_TRADING = 'ricetrading:view',
  CREATE_WHOLESALE_SALE = 'wholesale:sale:create',
  CREATE_WHOLESALER = 'wholesaler:create',
  VIEW_WHOLESALERS = 'wholesaler:view',
  MANAGE_WHOLESALERS = 'wholesaler:manage',
  MANAGE_INVENTORY = 'inventory:manage',
  VIEW_INVENTORY = 'inventory:view',
  ADJUST_INVENTORY = 'inventory:adjust',

  // Finance & Accounts
  VIEW_FINANCIAL_REPORTS = 'reports:financial',
  VIEW_LEDGER = 'ledger:view',
  MANAGE_DAILY_CLOSING = 'dailyclosing:manage',
  VIEW_EXPENSES = 'expense:view',
  MANAGE_EXPENSES = 'expense:manage',
  VIEW_ANALYTICS = 'analytics:view',
  VIEW_AI_INSIGHTS = 'insights:view',
  SETTINGS_VIEW = 'settings:view',
  SETTINGS_MANAGE = 'settings:manage',
  RATE_MANAGE = 'rate:manage',
  COSTING_MANAGE = 'costing:manage',
  INVENTORY_CONFIG_MANAGE = 'inventoryconfig:manage',
  RECEIPT_CONFIG_MANAGE = 'receiptconfig:manage',
  BACKUP_VIEW = 'backup:view',
  BACKUP_CREATE = 'backup:create',
  EXPORT_CUSTOMERS = 'export:customers',
  EXPORT_TRANSACTIONS = 'export:transactions',
  EXPORT_LEDGER = 'export:ledger',
  EXPORT_PAYMENTS = 'export:payments',
  EXPORT_INVENTORY = 'export:inventory',
  EXPORT_RICE_TRADING = 'export:rice-trading',
  EXPORT_WHOLESALERS = 'export:wholesalers',
  EXPORT_FINANCIAL_REPORTS = 'export:financial-reports',
  RESTORE_DATA = 'backup:restore',

  // System & Governance
  MANAGE_RATES = 'rates:manage',
  MANAGE_USERS = 'users:manage',
  VIEW_AUDIT_LOGS = 'audit:view',
  EXPORT_BACKUP = 'backup:export',
  SYSTEM_SETTINGS = 'settings:manage',
}

/**
 * Explicit Role-to-Permissions Mapping
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: [
    Permission.VIEW_COUNTER,
    Permission.CREATE_TRANSACTION,
    Permission.VIEW_TRANSACTIONS,
    Permission.CORRECT_TRANSACTION,
    Permission.REVERSE_TRANSACTION,
    Permission.VIEW_CUSTOMERS,
    Permission.CREATE_CUSTOMER,
    Permission.EDIT_CUSTOMER,
    Permission.RECORD_PAYMENT,
    Permission.VIEW_RECEIPTS,
    Permission.VIEW_MILLING,
    Permission.MANAGE_RICE_TRADING,
    Permission.VIEW_RICE_TRADING,
    Permission.CREATE_WHOLESALE_SALE,
    Permission.CREATE_WHOLESALER,
    Permission.VIEW_WHOLESALERS,
    Permission.MANAGE_WHOLESALERS,
    Permission.VIEW_INVENTORY,
    Permission.ADJUST_INVENTORY,
    Permission.VIEW_FINANCIAL_REPORTS,
    Permission.VIEW_AI_INSIGHTS,
    Permission.SETTINGS_VIEW,
    Permission.SETTINGS_MANAGE,
    Permission.RATE_MANAGE,
    Permission.COSTING_MANAGE,
    Permission.INVENTORY_CONFIG_MANAGE,
    Permission.RECEIPT_CONFIG_MANAGE,
    Permission.BACKUP_VIEW,
    Permission.BACKUP_CREATE,
    Permission.EXPORT_CUSTOMERS,
    Permission.EXPORT_TRANSACTIONS,
    Permission.EXPORT_LEDGER,
    Permission.EXPORT_PAYMENTS,
    Permission.EXPORT_INVENTORY,
    Permission.EXPORT_RICE_TRADING,
    Permission.EXPORT_WHOLESALERS,
    Permission.EXPORT_FINANCIAL_REPORTS,
    Permission.RESTORE_DATA,
    Permission.VIEW_LEDGER,
    Permission.MANAGE_DAILY_CLOSING,
    Permission.VIEW_EXPENSES,
    Permission.MANAGE_EXPENSES,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_RATES,
    Permission.MANAGE_USERS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.EXPORT_BACKUP,
    Permission.BACKUP_VIEW,
    Permission.EXPORT_CUSTOMERS,
    Permission.EXPORT_TRANSACTIONS,
    Permission.EXPORT_LEDGER,
    Permission.EXPORT_PAYMENTS,
    Permission.EXPORT_INVENTORY,
    Permission.EXPORT_RICE_TRADING,
    Permission.EXPORT_WHOLESALERS,
    Permission.EXPORT_FINANCIAL_REPORTS,
    Permission.SYSTEM_SETTINGS,
  ],
  [UserRole.STAFF]: [
    Permission.VIEW_COUNTER,
    Permission.CREATE_TRANSACTION,
    Permission.VIEW_TRANSACTIONS,
    Permission.VIEW_CUSTOMERS,
    Permission.CREATE_CUSTOMER,
    Permission.RECORD_PAYMENT,
    Permission.VIEW_RECEIPTS,
    Permission.VIEW_MILLING,
    Permission.VIEW_INVENTORY,
    Permission.VIEW_RICE_TRADING,
    Permission.VIEW_LEDGER,
  ],
  [UserRole.ACCOUNTANT]: [
    Permission.VIEW_CUSTOMERS,
    Permission.VIEW_TRANSACTIONS,
    Permission.VIEW_RECEIPTS,
    Permission.CORRECT_TRANSACTION,
    Permission.REVERSE_TRANSACTION,
    Permission.VIEW_LEDGER,
    Permission.VIEW_WHOLESALERS,
    Permission.VIEW_RICE_TRADING,
    Permission.CREATE_WHOLESALE_SALE,
    Permission.VIEW_RICE_TRADING,
    Permission.VIEW_INVENTORY,
    Permission.VIEW_FINANCIAL_REPORTS,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_AI_INSIGHTS,
    Permission.SETTINGS_VIEW,
    Permission.MANAGE_DAILY_CLOSING,
    Permission.VIEW_EXPENSES,
    Permission.MANAGE_EXPENSES,
    Permission.VIEW_AUDIT_LOGS,
    Permission.EXPORT_BACKUP,
  ],
};

/**
 * Check if a role possesses a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  if (role === UserRole.OWNER) return true;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Route protection requirement mapping
 */
export const ROUTE_PERMISSION_MAP: Record<string, Permission> = {
  // Mobile routes
  '/app/home': Permission.VIEW_COUNTER,
  '/app/customers': Permission.VIEW_CUSTOMERS,
  '/app/transactions': Permission.VIEW_TRANSACTIONS,
  '/app/transactions/new': Permission.CREATE_TRANSACTION,
  '/app/payments': Permission.RECORD_PAYMENT,
  '/app/payments/new': Permission.RECORD_PAYMENT,
  '/app/transactions/receipt': Permission.VIEW_RECEIPTS,
  '/app/payments/receipt': Permission.VIEW_RECEIPTS,
  '/app/ledger': Permission.VIEW_LEDGER,
  '/app/rice-trading': Permission.VIEW_RICE_TRADING,
  '/app/wholesalers': Permission.VIEW_WHOLESALERS,
  '/app/inventory': Permission.VIEW_INVENTORY,
  '/app/daily-closing': Permission.MANAGE_DAILY_CLOSING,
  '/app/reports': Permission.VIEW_FINANCIAL_REPORTS,
  '/app/backup': Permission.BACKUP_VIEW,
  '/app/settings': Permission.SETTINGS_VIEW,

  // Admin routes
  '/admin/dashboard': Permission.VIEW_ANALYTICS,
  '/admin/customers': Permission.VIEW_CUSTOMERS,
  '/admin/transactions': Permission.VIEW_TRANSACTIONS,
  '/admin/payments': Permission.VIEW_TRANSACTIONS,
  '/admin/inventory': Permission.VIEW_INVENTORY,
  '/admin/rice-trading': Permission.VIEW_RICE_TRADING,
  '/admin/wholesalers': Permission.VIEW_WHOLESALERS,
  '/admin/reports': Permission.VIEW_FINANCIAL_REPORTS,
  '/admin/analytics': Permission.VIEW_ANALYTICS,
  '/admin/insights': Permission.VIEW_AI_INSIGHTS,
  '/admin/settings': Permission.SETTINGS_VIEW,
  '/admin/backup': Permission.BACKUP_VIEW,
  '/admin/export': Permission.BACKUP_VIEW,
  '/admin/daily-closing': Permission.MANAGE_DAILY_CLOSING,
  '/admin/users': Permission.MANAGE_USERS,
  '/admin/audit-logs': Permission.VIEW_AUDIT_LOGS,
};

/**
 * Check if a role has access to a given route path
 */
export function canAccessRoute(path: string, role: UserRole): boolean {
  if (role === UserRole.OWNER) return true;

  // Exact match
  if (ROUTE_PERMISSION_MAP[path]) {
    return hasPermission(role, ROUTE_PERMISSION_MAP[path]);
  }

  // Prefix match for nested routes like /app/customers/:id or /app/transactions/:id
  for (const [routePrefix, requiredPerm] of Object.entries(ROUTE_PERMISSION_MAP)) {
    if (path.startsWith(routePrefix)) {
      return hasPermission(role, requiredPerm);
    }
  }

  // Public/shared routes
  if (path === '/login' || path === '/app/more') {
    return true;
  }

  return true;
}

/**
 * Human-friendly role metadata
 */
export interface RoleMetadata {
  role: UserRole;
  title: string;
  subtitle: string;
  badgeClass: string;
  defaultPath: string;
  description: string;
  demoPin: string;
}

export const ROLE_METADATA: Record<UserRole, RoleMetadata> = {
  [UserRole.OWNER]: {
    role: UserRole.OWNER,
    title: 'Shop Owner',
    subtitle: 'Full Administrative & Financial Authority',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    defaultPath: '/app/home',
    description: 'Complete unrestricted access across mobile counter, wholesale grain trading, rates configuration, user roles, and audit trail.',
    demoPin: '1234',
  },
  [UserRole.STAFF]: {
    role: UserRole.STAFF,
    title: 'Counter Operator (Staff)',
    subtitle: 'Daily Mill Transactions & Weighing',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    defaultPath: '/app/home',
    description: 'Fast entry for customer wheat deposits, atta collections, rice purchases, and cash payments. Cannot modify rates or user permissions.',
    demoPin: '5678',
  },
  [UserRole.ACCOUNTANT]: {
    role: UserRole.ACCOUNTANT,
    title: 'Accountant',
    subtitle: 'Audit, Ledger & Financial Statements',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-300',
    defaultPath: '/admin/dashboard',
    description: 'Detailed access to daily closing register, financial reports, audit logs, and customer khata balances. Cannot change milling rates or operators.',
    demoPin: '9988',
  },
};
