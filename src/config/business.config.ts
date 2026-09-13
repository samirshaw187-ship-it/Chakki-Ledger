/**
 * Chakki Ledger - Business Configuration & Defaults
 */

import { RateConfiguration, RiceCostingMethod } from '../types';

export const BUSINESS_INFO = {
  name: 'Chakki Ledger',
  tagline: 'Atta Chakki & Grain Trading Ledger',
  currency: '₹',
  defaultLanguage: 'en-IN',
  version: '1.0.0-foundation',
};

/**
 * Initial business rates as specified in business requirements.
 * Note: Historical transactions ALWAYS retain the rate applied at transaction time.
 */
export const DEFAULT_RATE_CONFIGURATION: RateConfiguration = {
  id: 'rate-config-initial',
  chaliAttaExchangeRate: 8.0,  // ₹8 per kg for standard coarse atta milling
  rollAttaExchangeRate: 10.0,  // ₹10 per kg for fine roll milling
  chaliAttaSellingRate: 35.0,  // ₹35 per kg for standard retail coarse atta sale
  rollAttaSellingRate: 40.0,   // ₹40 per kg for direct retail sale
  ricePurchaseRate: 21.0,      // ₹21 per kg for ration rice purchased from customers
  riceCashPurchaseRate: 21.0,  // ₹21 per kg for Rice Cash Settlement (configured rate)
  wheatCashPurchaseRate: 24.0, // ₹24 per kg for Wheat Cash Settlement (distinct from atta exchange)
  wheatToAttaConversionRatio: 1.0, // Configurable yield ratio: 1.0 kg wheat yields 1.0 kg atta
  riceCostingMethod: RiceCostingMethod.WEIGHTED_AVERAGE,
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  isActive: true,
};

export interface RouteItem {
  id: string;
  path: string;
  label: string;
  iconName: string;
  badge?: string;
  roles?: string[];
  isProminent?: boolean;
}

/**
 * Mobile Owner Navigation (Bottom Bar + Fast Touch Workflows)
 */
export const OWNER_BOTTOM_NAV_ITEMS: RouteItem[] = [
  { id: 'home', path: '/app/home', label: 'Home', iconName: 'Home' },
  { id: 'customers', path: '/app/customers', label: 'Customers', iconName: 'Users' },
  { id: 'new-tx', path: '/app/transactions/new', label: 'New Entry', iconName: 'PlusCircle', isProminent: true },
  { id: 'ledger', path: '/app/ledger', label: 'Ledger', iconName: 'BookOpen' },
  { id: 'more', path: '/app/more', label: 'More', iconName: 'Menu' },
];

/**
 * Admin Desktop Navigation (Full Sidebar)
 */
export const ADMIN_SIDEBAR_ITEMS: RouteItem[] = [
  { id: 'dashboard', path: '/admin/dashboard', label: 'Dashboard', iconName: 'LayoutDashboard' },
  { id: 'customers', path: '/admin/customers', label: 'Customers', iconName: 'Users' },
  { id: 'transactions', path: '/admin/transactions', label: 'Transactions', iconName: 'Receipt' },
  { id: 'inventory', path: '/admin/inventory', label: 'Inventory', iconName: 'Boxes' },
  { id: 'rice-trading', path: '/admin/rice-trading', label: 'Rice Trading', iconName: 'Wheat' },
  { id: 'wholesalers', path: '/admin/wholesalers', label: 'Wholesalers', iconName: 'Truck' },
  { id: 'reports', path: '/admin/reports', label: 'Reports', iconName: 'FileSpreadsheet' },
  { id: 'analytics', path: '/admin/analytics', label: 'Analytics', iconName: 'TrendingUp' },
  { id: 'daily-closing', path: '/admin/daily-closing', label: 'Daily Closing', iconName: 'Lock' },
  { id: 'users', path: '/admin/users', label: 'Users & Roles', iconName: 'UserCheck' },
  { id: 'audit-logs', path: '/admin/audit-logs', label: 'Audit Logs', iconName: 'ShieldCheck' },
  { id: 'settings', path: '/admin/settings', label: 'Settings', iconName: 'Settings' },
  { id: 'backup', path: '/admin/backup', label: 'Backup & Export', iconName: 'HardDriveDownload' },
];
