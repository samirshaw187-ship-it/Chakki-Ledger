/**
 * Chakki Ledger - Firebase Firestore Persistence Service
 *
 * Provides bidirectional sync and real-time persistence between
 * the application repository and Cloud Firestore in the connected project 'chakki-ledger'.
 *
 * Collections:
 * - users
 * - customers
 * - transactions
 * - payments
 * - wholesalers
 * - ledger_entries
 * - inventory_items
 * - inventory_movements
 * - settings (rateConfig, businessProfile, receiptConfiguration, systemPreferences)
 * - audit_logs
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { dbRepository } from '../db/in-memory-db';
import {
  User,
  Customer,
  Transaction,
  Payment,
  Wholesaler,
  LedgerEntry,
  InventoryItem,
  InventoryMovement,
  AuditLogEntry,
  RateConfiguration,
  BusinessProfileSettings,
  ReceiptConfiguration,
  SystemPreferences,
} from '../types';
import { registerFirestoreDispatcher } from './firestore-dispatcher';

const PROTOTYPE_DOC_IDS = new Set([
  'cust-01', 'cust-02', 'cust-03', 'cust-04', 'cust-05',
  'tx-001', 'tx-002', 'tx-003', 'tx-004', 'tx-005',
  'pmt-001', 'pmt-002', 'pmt-003', 'pmt-004', 'pmt-005',
  'wholesaler-01', 'wholesaler-02', 'ws-01', 'ws-02',
  'user-owner-01',
  'led-001', 'led-002', 'led-003', 'led-004', 'led-005', 'led-006', 'led-007', 'led-008', 'led-009',
  'audit-seed-001', 'audit-seed-002', 'audit-seed-003', 'audit-seed-004', 'audit-seed-005'
]);

export class FirestoreSyncService {
  private static isInitialized = false;
  private static isSyncing = false;
  private static listeners: Array<() => void> = [];

  /**
   * Initialize Firestore synchronization:
   * 1. Register background write dispatchers
   * 2. Pull existing data from Firestore into local repository
   * 3. If remote Firestore is empty, seed initial records to Firestore
   * 4. Set up real-time onSnapshot listeners for live multi-tab & multi-device sync
   */
  public static async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Connect dispatchers
    registerFirestoreDispatcher({
      saveUser: this.saveUser.bind(this),
      saveCustomer: this.saveCustomer.bind(this),
      saveTransaction: this.saveTransaction.bind(this),
      savePayment: this.savePayment.bind(this),
      saveWholesaler: this.saveWholesaler.bind(this),
      saveLedgerEntry: this.saveLedgerEntry.bind(this),
      saveAuditLog: this.saveAuditLog.bind(this),
      saveSettings: this.saveSettings.bind(this),
      deleteCustomer: this.deleteCustomer.bind(this),
    });

    try {
      await this.syncDownFromFirestore();
      this.setupLiveListeners();
      console.log('✔ Cloud Firestore sync initialized successfully for chakki-ledger');
    } catch (err) {
      console.warn('Firestore initial sync encountered an error, running with local store fallback:', err);
    }
  }

  /**
   * Pull all collections down from Firestore, purging any legacy prototype documents
   */
  public static async syncDownFromFirestore(): Promise<void> {
    try {
      // 1. Users
      const usersSnap = await getDocs(collection(db, 'users'));
      if (!usersSnap.empty) {
        for (const docSnap of usersSnap.docs) {
          const user = docSnap.data() as User;
          if (PROTOTYPE_DOC_IDS.has(docSnap.id) || user.email === 'owner@gmail.com') {
            try { await deleteDoc(docSnap.ref); } catch {}
            continue;
          }
          const existing = dbRepository.getUserById(user.id) || dbRepository.getUserByEmail(user.email);
          if (existing) {
            dbRepository.updateUser(existing.id, user);
          } else {
            dbRepository.addUser(user);
          }
        }
      } else {
        // Seed initial admin users to Firestore
        for (const u of dbRepository.getUsers()) {
          await this.saveUser(u);
        }
      }

      // 2. Customers
      const customersSnap = await getDocs(collection(db, 'customers'));
      if (!customersSnap.empty) {
        for (const docSnap of customersSnap.docs) {
          const customer = docSnap.data() as Customer;
          if (PROTOTYPE_DOC_IDS.has(docSnap.id) || customer.customerCode?.startsWith('CUST-0000')) {
            try { await deleteDoc(docSnap.ref); } catch {}
            continue;
          }
          const existing = dbRepository.getCustomerById(customer.id);
          if (existing) {
            dbRepository.updateCustomer(existing.id, customer);
          } else {
            dbRepository.addCustomer(customer);
          }
        }
      }

      // 3. Transactions
      const txnsSnap = await getDocs(collection(db, 'transactions'));
      if (!txnsSnap.empty) {
        for (const docSnap of txnsSnap.docs) {
          const txn = docSnap.data() as Transaction;
          if (PROTOTYPE_DOC_IDS.has(docSnap.id) || txn.transactionNumber?.startsWith('TXN-2026-000')) {
            try { await deleteDoc(docSnap.ref); } catch {}
            continue;
          }
          dbRepository.saveTransaction(txn);
        }
      }

      // 4. Payments
      const paymentsSnap = await getDocs(collection(db, 'payments'));
      if (!paymentsSnap.empty) {
        for (const docSnap of paymentsSnap.docs) {
          const pmt = docSnap.data() as Payment;
          if (PROTOTYPE_DOC_IDS.has(docSnap.id) || pmt.receiptNumber?.startsWith('RCT-2026-000')) {
            try { await deleteDoc(docSnap.ref); } catch {}
            continue;
          }
          const existing = dbRepository.getPayments().find((p) => p.id === pmt.id);
          if (existing) {
            dbRepository.updatePayment(pmt.id, pmt);
          } else {
            dbRepository.addPayment(pmt);
          }
        }
      }

      // 5. Wholesalers
      const wholesalersSnap = await getDocs(collection(db, 'wholesalers'));
      if (!wholesalersSnap.empty) {
        for (const docSnap of wholesalersSnap.docs) {
          const w = docSnap.data() as Wholesaler;
          if (PROTOTYPE_DOC_IDS.has(docSnap.id)) {
            try { await deleteDoc(docSnap.ref); } catch {}
            continue;
          }
          const existing = dbRepository.getWholesalerById(w.id);
          if (existing) {
            dbRepository.updateWholesaler(w.id, w);
          } else {
            dbRepository.addWholesaler(w);
          }
        }
      }

      // 6. Ledger entries
      const ledgerSnap = await getDocs(collection(db, 'ledger_entries'));
      if (!ledgerSnap.empty) {
        for (const docSnap of ledgerSnap.docs) {
          const entry = docSnap.data() as LedgerEntry;
          if (PROTOTYPE_DOC_IDS.has(docSnap.id)) {
            try { await deleteDoc(docSnap.ref); } catch {}
            continue;
          }
          const existing = dbRepository.getLedgerEntryById(entry.id);
          if (!existing) {
            dbRepository.addLedgerEntry(entry);
          }
        }
      }

      // 7. Settings (single document: settings/business)
      const settingsSnap = await getDocs(collection(db, 'settings'));
      if (!settingsSnap.empty) {
        settingsSnap.forEach((docSnap) => {
          if (docSnap.id === 'rate_config') {
            dbRepository.updateRateConfig(docSnap.data() as Partial<RateConfiguration>);
          } else if (docSnap.id === 'business_profile') {
            dbRepository.updateBusinessProfile(docSnap.data() as BusinessProfileSettings);
          } else if (docSnap.id === 'receipt_config') {
            dbRepository.updateReceiptConfiguration(docSnap.data() as ReceiptConfiguration);
          } else if (docSnap.id === 'system_preferences') {
            dbRepository.updateSystemPreferences(docSnap.data() as SystemPreferences);
          }
        });
      } else {
        await this.saveSettings();
      }
    } catch (err) {
      console.warn('Error during Firestore sync down:', err);
    }
  }

  /**
   * Real-time listeners for updates
   */
  private static setupLiveListeners(): void {
    try {
      // Listen for customers
      const unsubCustomers = onSnapshot(
        collection(db, 'customers'),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            const customer = change.doc.data() as Customer;
            if (change.type === 'added' || change.type === 'modified') {
              const existing = dbRepository.getCustomerById(customer.id);
              if (existing) {
                dbRepository.updateCustomer(customer.id, customer);
              } else {
                dbRepository.addCustomer(customer);
              }
            } else if (change.type === 'removed') {
              dbRepository.deleteCustomer(customer.id || change.doc.id, false);
            }
          });
        },
        (error) => {
          console.warn('Firestore customers listener note:', error.message);
        }
      );
      this.listeners.push(unsubCustomers);

      // Listen for transactions
      const unsubTxns = onSnapshot(
        collection(db, 'transactions'),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            const txn = change.doc.data() as Transaction;
            if (change.type === 'added' || change.type === 'modified') {
              dbRepository.saveTransaction(txn);
            } else if (change.type === 'removed') {
              dbRepository.removeTransaction(txn.id);
            }
          });
        },
        (error) => {
          console.warn('Firestore transactions listener note:', error.message);
        }
      );
      this.listeners.push(unsubTxns);

      // Listen for payments
      const unsubPayments = onSnapshot(
        collection(db, 'payments'),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            const payment = change.doc.data() as Payment;
            if (change.type === 'added' || change.type === 'modified') {
              const existing = dbRepository.getPayments().find((p) => p.id === payment.id);
              if (existing) {
                dbRepository.updatePayment(payment.id, payment);
              } else {
                dbRepository.addPayment(payment);
              }
            }
          });
        },
        (error) => {
          console.warn('Firestore payments listener note:', error.message);
        }
      );
      this.listeners.push(unsubPayments);

      // Listen for ledger entries
      const unsubLedger = onSnapshot(
        collection(db, 'ledger_entries'),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            const entry = change.doc.data() as LedgerEntry;
            if (change.type === 'added') {
              const existing = dbRepository.getLedgerEntryById(entry.id);
              if (!existing) {
                dbRepository.addLedgerEntry(entry);
              }
            } else if (change.type === 'removed') {
              dbRepository.removeLedgerEntry(entry.id);
            }
          });
        },
        (error) => {
          console.warn('Firestore ledger listener note:', error.message);
        }
      );
      this.listeners.push(unsubLedger);

      // Listen for users
      const unsubUsers = onSnapshot(
        collection(db, 'users'),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            const user = change.doc.data() as User;
            if (change.type === 'added' || change.type === 'modified') {
              const existing = dbRepository.getUserById(user.id) || dbRepository.getUserByEmail(user.email);
              if (existing) {
                dbRepository.updateUser(existing.id, user);
              } else {
                dbRepository.addUser(user);
              }
            }
          });
        },
        (error) => {
          console.warn('Firestore users listener note:', error.message);
        }
      );
      this.listeners.push(unsubUsers);
    } catch (e) {
      console.warn('Could not setup live Firestore listeners:', e);
    }
  }

  // --- Document write helpers with fire-and-forget background sync ---

  public static async deleteCustomer(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'customers', id);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn(`Firestore: error deleting customer ${id}`, e);
    }
  }

  public static async saveUser(user: User): Promise<void> {
    try {
      const docRef = doc(db, 'users', user.id);
      await setDoc(docRef, user, { merge: true });
    } catch (e) {
      console.warn(`Firestore: error saving user ${user.id}`, e);
    }
  }

  public static async saveCustomer(customer: Customer): Promise<void> {
    try {
      const docRef = doc(db, 'customers', customer.id);
      await setDoc(docRef, customer, { merge: true });
    } catch (e) {
      console.warn(`Firestore: error saving customer ${customer.id}`, e);
    }
  }

  public static async saveTransaction(txn: Transaction): Promise<void> {
    try {
      const docRef = doc(db, 'transactions', txn.id);
      await setDoc(docRef, txn, { merge: true });
    } catch (e) {
      console.warn(`Firestore: error saving transaction ${txn.id}`, e);
    }
  }

  public static async savePayment(payment: Payment): Promise<void> {
    try {
      const docRef = doc(db, 'payments', payment.id);
      await setDoc(docRef, payment, { merge: true });
    } catch (e) {
      console.warn(`Firestore: error saving payment ${payment.id}`, e);
    }
  }

  public static async saveWholesaler(wholesaler: Wholesaler): Promise<void> {
    try {
      const docRef = doc(db, 'wholesalers', wholesaler.id);
      await setDoc(docRef, wholesaler, { merge: true });
    } catch (e) {
      console.warn(`Firestore: error saving wholesaler ${wholesaler.id}`, e);
    }
  }

  public static async saveLedgerEntry(entry: LedgerEntry): Promise<void> {
    try {
      const docRef = doc(db, 'ledger_entries', entry.id);
      await setDoc(docRef, entry, { merge: true });
    } catch (e) {
      console.warn(`Firestore: error saving ledger entry ${entry.id}`, e);
    }
  }

  public static async saveAuditLog(log: AuditLogEntry): Promise<void> {
    try {
      const docRef = doc(db, 'audit_logs', log.id);
      await setDoc(docRef, log, { merge: true });
    } catch (e) {
      console.warn(`Firestore: error saving audit log ${log.id}`, e);
    }
  }

  public static async saveSettings(): Promise<void> {
    try {
      await setDoc(doc(db, 'settings', 'rate_config'), dbRepository.getRateConfig(), { merge: true });
      await setDoc(doc(db, 'settings', 'business_profile'), dbRepository.getBusinessProfile(), { merge: true });
      await setDoc(doc(db, 'settings', 'receipt_config'), dbRepository.getReceiptConfiguration(), { merge: true });
      await setDoc(doc(db, 'settings', 'system_preferences'), dbRepository.getSystemPreferences(), { merge: true });
    } catch (e) {
      console.warn('Firestore: error saving settings', e);
    }
  }

  public static cleanup(): void {
    this.listeners.forEach((unsub) => {
      try {
        unsub();
      } catch (e) {
        // ignore
      }
    });
    this.listeners = [];
    this.isInitialized = false;
  }
}
