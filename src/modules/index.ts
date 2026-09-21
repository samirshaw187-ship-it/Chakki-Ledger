/**
 * Chakki Ledger - Domain Modules Registry
 *
 * Modular architecture providing clear boundaries for:
 * 1. Authentication (auth)
 * 2. Users & Roles (users)
 * 3. Customers (customers)
 * 4. Transactions (transactions)
 * 5. Customer Ledger (ledger)
 * 6. Payments (payments)
 * 7. Wheat Management (wheat)
 * 8. Atta Management (atta)
 * 9. Rice Trading (rice-trading)
 * 10. Inventory (inventory)
 * 11. Wholesalers (wholesalers)
 * 12. Expenses (expenses)
 * 13. Reports (reports)
 * 14. Analytics (analytics)
 * 15. Daily Closing (daily-closing)
 * 16. Business Settings (settings)
 * 17. Audit Logs (audit)
 * 18. Backup / Export (backup)
 */

export interface ModuleManifest {
  id: string;
  name: string;
  category: 'OPERATIONS' | 'FINANCE' | 'INVENTORY' | 'SYSTEM';
  description: string;
  isImplemented: boolean;
  status: 'FOUNDATION_READY' | 'INCREMENTAL_STEP';
}

export const SYSTEM_MODULES: ModuleManifest[] = [
  { id: 'auth', name: 'Authentication', category: 'SYSTEM', description: 'Session tokens, fast mobile PIN login, RBAC', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'users', name: 'Users & Roles', category: 'SYSTEM', description: 'Shop Owner and Administrator permissions', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'customers', name: 'Customer Directory', category: 'OPERATIONS', description: 'Farmer/customer profiles, running dues & wheat balance', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'transactions', name: 'Transactions Engine', category: 'OPERATIONS', description: 'Central source of truth for all business exchanges', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'ledger', name: 'Customer & Grain Ledger', category: 'FINANCE', description: 'Replaces handwritten diaries with auditable passbooks', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'payments', name: 'Payments', category: 'FINANCE', description: 'Cash and UPI receipt collection and dues settlement', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'wheat', name: 'Wheat Management', category: 'INVENTORY', description: 'Wheat deposits, milling losses, chali vs roll allocation', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'atta', name: 'Atta Management', category: 'INVENTORY', description: 'Chali Atta (₹8/kg) and Roll Atta (₹10/kg) processing', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'rice-trading', name: 'Rice Trading', category: 'OPERATIONS', description: 'Ration rice purchase (@₹21/kg), atta offset, wholesale resale', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'inventory', name: 'Inventory & Stocks', category: 'INVENTORY', description: 'Grain silo monitoring, bran (choker), packaged flour', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'wholesalers', name: 'Wholesalers', category: 'OPERATIONS', description: 'Bulk buyers, truck dispatches, wholesale payment tracking', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'expenses', name: 'Expenses', category: 'FINANCE', description: 'Mill electricity, diesel for generator, stone chakkis maintenance', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'reports', name: 'Reports', category: 'FINANCE', description: 'Daily transaction register, customer balance sheets, khata export', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'analytics', name: 'Analytics', category: 'FINANCE', description: 'Grain conversion metrics, profit/loss trends, seasonal peak analysis', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'daily-closing', name: 'Daily Closing', category: 'OPERATIONS', description: 'End-of-day physical cash drawer count and stock reconciliation', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'settings', name: 'Business Settings', category: 'SYSTEM', description: 'Chali rate (₹8), Roll rate (₹10), Rice rate (₹21), shop headers', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'audit', name: 'Audit Trail', category: 'SYSTEM', description: 'Non-destructive correction, reversal reasons, user action logging', isImplemented: true, status: 'FOUNDATION_READY' },
  { id: 'backup', name: 'Backup & Export', category: 'SYSTEM', description: 'Offline safety, JSON/CSV ledger dump, printable passbooks', isImplemented: true, status: 'FOUNDATION_READY' },
];
