/**
 * Chakki Ledger - Customer Module
 *
 * Domain responsibilities:
 * - Customer directory & quick search (by name, phone, village)
 * - Balance snapshot (Dues, Advance, Wheat in stock)
 * - Diary ledger linkage
 */

export interface CustomerFilter {
  query?: string;
  hasDuesOnly?: boolean;
  hasWheatHeldOnly?: boolean;
  village?: string;
}

export * from '../../services/customer.service';
export { CustomerService } from '../../services/customer.service';
