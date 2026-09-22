/**
 * Chakki Ledger - Initial Seed Data (Clean State)
 * All demo accounts, sample customers, mock transactions, and test data
 * have been completely removed for a pristine, production-ready starting state.
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
    id: 'admin_samir_shaw',
    name: 'Samir Shaw',
    phone: '9876543210',
    email: 'samirpc187@gmail.com',
    role: UserRole.ADMIN,
    isActive: true,
    approvalStatus: 'APPROVED',
    password: 'samirCL@2025',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'admin_samir_shaw_google',
    name: 'Samir Shaw',
    phone: '9876543210',
    email: 'samirshaw869@gmail.com',
    role: UserRole.ADMIN,
    isActive: true,
    approvalStatus: 'APPROVED',
    password: 'samirCL@2025',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'admin_master_1',
    name: 'Platform Administrator',
    phone: '9876543210',
    email: 'admin@gmail.com',
    role: UserRole.ADMIN,
    isActive: true,
    approvalStatus: 'APPROVED',
    password: 'Admin@1234',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const SEED_CUSTOMERS: Customer[] = [];

export const SEED_WHOLESALERS: Wholesaler[] = [];

export const SEED_SAMPLE_TRANSACTIONS: Transaction[] = [];

export const SEED_SAMPLE_PAYMENTS: Payment[] = [];

export const SEED_SAMPLE_LEDGER_ENTRIES: LedgerEntry[] = [];
