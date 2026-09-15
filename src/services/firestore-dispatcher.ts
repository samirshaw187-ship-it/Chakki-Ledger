/**
 * Background Firestore sync dispatcher
 * Decouples Firestore persistence triggers without circular imports.
 */

import {
  User,
  Customer,
  Transaction,
  Payment,
  Wholesaler,
  LedgerEntry,
  AuditLogEntry,
} from '../types';

type SyncDispatcher = {
  saveUser?: (user: User) => Promise<void>;
  saveCustomer?: (customer: Customer) => Promise<void>;
  saveTransaction?: (txn: Transaction) => Promise<void>;
  savePayment?: (payment: Payment) => Promise<void>;
  saveWholesaler?: (wholesaler: Wholesaler) => Promise<void>;
  saveLedgerEntry?: (entry: LedgerEntry) => Promise<void>;
  saveAuditLog?: (log: AuditLogEntry) => Promise<void>;
  saveSettings?: () => Promise<void>;
  deleteCustomer?: (id: string) => Promise<void>;
  deleteLedgerEntry?: (id: string) => Promise<void>;
};

let dispatcher: SyncDispatcher = {};

export function registerFirestoreDispatcher(d: SyncDispatcher): void {
  dispatcher = { ...dispatcher, ...d };
}

export function syncDeleteCustomerFromFirestore(id: string): void {
  dispatcher.deleteCustomer?.(id).catch(() => {});
}

export function syncDeleteLedgerEntryFromFirestore(id: string): void {
  dispatcher.deleteLedgerEntry?.(id).catch(() => {});
}

export function syncUserToFirestore(user: User): void {
  dispatcher.saveUser?.(user).catch(() => {});
}

export function syncCustomerToFirestore(customer: Customer): void {
  dispatcher.saveCustomer?.(customer).catch(() => {});
}

export function syncTransactionToFirestore(txn: Transaction): void {
  dispatcher.saveTransaction?.(txn).catch(() => {});
}

export function syncPaymentToFirestore(payment: Payment): void {
  dispatcher.savePayment?.(payment).catch(() => {});
}

export function syncWholesalerToFirestore(wholesaler: Wholesaler): void {
  dispatcher.saveWholesaler?.(wholesaler).catch(() => {});
}

export function syncLedgerEntryToFirestore(entry: LedgerEntry): void {
  dispatcher.saveLedgerEntry?.(entry).catch(() => {});
}

export function syncAuditLogToFirestore(log: AuditLogEntry): void {
  dispatcher.saveAuditLog?.(log).catch(() => {});
}

export function syncSettingsToFirestore(): void {
  dispatcher.saveSettings?.().catch(() => {});
}
