/**
 * Chakki Ledger - Initial Seed Configuration
 * Fresh database initialization with clean master records.
 * All prototype/demo customer and transaction records have been scrubbed.
 */

import {
  Customer,
  User,
  UserRole,
  Wholesaler,
  Transaction,
  Payment,
  LedgerEntry,
} from '../types';

export const SEED_USERS: User[] = [
  {
    id: 'user-admin-01',
    email: 'samirpc187@gmail.com',
    phone: '9830099887',
    name: 'Samir Shaw (Administrator)',
    role: UserRole.ADMIN,
    isActive: true,
    isApproved: true,
    approvalStatus: 'APPROVED',
    password: 'samirCL@2025',
    pin: '9988',
    createdAt: '2026-01-05T08:00:00.000Z',
    lastLoginAt: new Date().toISOString(),
  },
];

// Clean empty collections for a fresh production ledger
export const SEED_CUSTOMERS: Customer[] = [];
export const SEED_WHOLESALERS: Wholesaler[] = [];
export const SEED_SAMPLE_TRANSACTIONS: Transaction[] = [];
export const SEED_SAMPLE_PAYMENTS: Payment[] = [];
export const SEED_SAMPLE_LEDGER_ENTRIES: LedgerEntry[] = [];
