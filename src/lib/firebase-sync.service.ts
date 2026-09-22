/**
 * Chakki Ledger - Firebase Real-Time Synchronization Service
 *
 * Connects Firestore collections with live onSnapshot listeners:
 * - /users
 * - /customers
 * - /transactions
 * - /payments
 * - /ledgerEntries
 * - /wholesalers
 * - /inventoryMovements
 * - /settings/rates
 * - /auditLogs
 *
 * Automatically keeps the in-memory repository synchronized in real-time,
 * ensuring every component, dashboard, calculation, and snapshot updates instantly
 * across all connected clients (Shop Owner & Admin) without requiring manual reloads.
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
  serverTimestamp,
  FirestoreError,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { dbRepository } from '../db/in-memory-db';
import { AuditService } from '../services/audit.service';
import {
  Customer,
  Transaction,
  Payment,
  LedgerEntry,
  Wholesaler,
  InventoryMovement,
  RateConfiguration,
  AuditLogEntry,
  User,
} from '../types';

export class FirebaseSyncService {
  private static unsubscribes: Unsubscribe[] = [];
  private static authUnsubscribe: (() => void) | null = null;
  private static isInitialized = false;
  private static listeners: Set<() => void> = new Set();
  private static isWritingToFirestore = false;

  public static subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private static notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('FirebaseSyncService listener error', e);
      }
    });
  }

  /**
   * Initializes real-time Firestore listeners for all Chakki Ledger collections.
   */
  public static initRealtimeSync(): void {
    if (this.isInitialized) return;

    // Guard: Only start listeners if a user is currently authenticated in Firebase Auth
    if (!auth.currentUser) {
      return;
    }

    this.isInitialized = true;

    const safeErrorHandler = (collectionName: string) => (err: FirestoreError) => {
      if (err.code === 'permission-denied') {
        // Gracefully ignore permission-denied when user permissions are pending or session is changing
        return;
      }
      console.warn(`[Firestore Sync] ${collectionName} notice:`, err.message);
    };

    try {
      // 1. Users Collection
      const usersCol = collection(db, 'users');
      const unsubUsers = onSnapshot(
        usersCol,
        (snapshot) => {
          const usersList: User[] = [];
          snapshot.forEach((d) => {
            usersList.push(d.data() as User);
          });
          dbRepository.setUsersFromRemote(usersList);
          this.notify();
        },
        safeErrorHandler('users')
      );
      this.unsubscribes.push(unsubUsers);

      // 2. Customers Collection
      const customersCol = collection(db, 'customers');
      const unsubCustomers = onSnapshot(
        customersCol,
        (snapshot) => {
          const customersList: Customer[] = [];
          snapshot.forEach((d) => {
            customersList.push(d.data() as Customer);
          });
          dbRepository.setCustomersFromRemote(customersList);
          this.notify();
        },
        safeErrorHandler('customers')
      );
      this.unsubscribes.push(unsubCustomers);

      // 3. Transactions Collection
      const transactionsCol = query(collection(db, 'transactions'), orderBy('date', 'desc'));
      const unsubTx = onSnapshot(
        transactionsCol,
        (snapshot) => {
          const txList: Transaction[] = [];
          snapshot.forEach((d) => {
            txList.push(d.data() as Transaction);
          });
          dbRepository.setTransactionsFromRemote(txList);
          this.notify();
        },
        (err) => {
          if (err.code === 'permission-denied') {
            return;
          }
          if (err.code === 'failed-precondition') {
            // Fallback without ordering if composite index is building
            const fallbackUnsub = onSnapshot(
              collection(db, 'transactions'),
              (snap) => {
                const list: Transaction[] = [];
                snap.forEach((d) => list.push(d.data() as Transaction));
                dbRepository.setTransactionsFromRemote(list);
                this.notify();
              },
              safeErrorHandler('fallback-transactions')
            );
            this.unsubscribes.push(fallbackUnsub);
          } else {
            console.warn('[Firestore Sync] Transactions notice:', err.message);
          }
        }
      );
      this.unsubscribes.push(unsubTx);

      // 4. Payments Collection
      const paymentsCol = collection(db, 'payments');
      const unsubPayments = onSnapshot(
        paymentsCol,
        (snapshot) => {
          const pmtList: Payment[] = [];
          snapshot.forEach((d) => {
            pmtList.push(d.data() as Payment);
          });
          dbRepository.setPaymentsFromRemote(pmtList);
          this.notify();
        },
        safeErrorHandler('payments')
      );
      this.unsubscribes.push(unsubPayments);

      // 5. Ledger Entries Collection
      const ledgerCol = collection(db, 'ledgerEntries');
      const unsubLedger = onSnapshot(
        ledgerCol,
        (snapshot) => {
          const ledgerList: LedgerEntry[] = [];
          snapshot.forEach((d) => {
            ledgerList.push(d.data() as LedgerEntry);
          });
          dbRepository.setLedgerEntriesFromRemote(ledgerList);
          this.notify();
        },
        safeErrorHandler('ledgerEntries')
      );
      this.unsubscribes.push(unsubLedger);

      // 6. Wholesalers Collection
      const wholesalersCol = collection(db, 'wholesalers');
      const unsubWholesalers = onSnapshot(
        wholesalersCol,
        (snapshot) => {
          const wholesalerList: Wholesaler[] = [];
          snapshot.forEach((d) => {
            wholesalerList.push(d.data() as Wholesaler);
          });
          dbRepository.setWholesalersFromRemote(wholesalerList);
          this.notify();
        },
        safeErrorHandler('wholesalers')
      );
      this.unsubscribes.push(unsubWholesalers);

      // 7. Inventory Movements Collection
      const invCol = collection(db, 'inventoryMovements');
      const unsubInv = onSnapshot(
        invCol,
        (snapshot) => {
          const invList: InventoryMovement[] = [];
          snapshot.forEach((d) => {
            invList.push(d.data() as InventoryMovement);
          });
          dbRepository.setInventoryMovementsFromRemote(invList);
          this.notify();
        },
        safeErrorHandler('inventoryMovements')
      );
      this.unsubscribes.push(unsubInv);

      // 8. Rate Settings Doc
      const ratesDocRef = doc(db, 'settings', 'rates');
      const unsubRates = onSnapshot(
        ratesDocRef,
        (snap) => {
          if (snap.exists()) {
            const rates = snap.data() as RateConfiguration;
            dbRepository.setRateConfigFromRemote(rates);
            this.notify();
          }
        },
        safeErrorHandler('settings-rates')
      );
      this.unsubscribes.push(unsubRates);

      // 9. Audit Logs Collection
      const auditCol = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'));
      const unsubAudit = onSnapshot(
        auditCol,
        (snapshot) => {
          const logs: AuditLogEntry[] = [];
          snapshot.forEach((d) => {
            logs.push(d.data() as AuditLogEntry);
          });
          AuditService.setLogsFromRemote(logs);
          this.notify();
        },
        (err) => {
          if (err.code === 'permission-denied') {
            return;
          }
          if (err.code === 'failed-precondition') {
            const fallbackAudit = onSnapshot(
              collection(db, 'auditLogs'),
              (snap) => {
                const logs: AuditLogEntry[] = [];
                snap.forEach((d) => logs.push(d.data() as AuditLogEntry));
                AuditService.setLogsFromRemote(logs);
                this.notify();
              },
              safeErrorHandler('fallback-auditLogs')
            );
            this.unsubscribes.push(fallbackAudit);
          } else {
            console.warn('[Firestore Sync] Audit logs notice:', err.message);
          }
        }
      );
      this.unsubscribes.push(unsubAudit);

    } catch (error) {
      console.error('Error setting up Firebase realtime sync:', error);
    }
  }

  public static stopRealtimeSync(): void {
    this.unsubscribes.forEach((unsub) => {
      try {
        unsub();
      } catch (e) {}
    });
    this.unsubscribes = [];
    this.isInitialized = false;
  }

  /**
   * Convenience initializer returning cleanup function.
   * Listens to Firebase Auth state so listeners automatically start when user signs in
   * and disconnect cleanly when user signs out or is unauthenticated.
   */
  public static initAllRealtimeListeners(): () => void {
    if (!this.authUnsubscribe) {
      this.authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          this.initRealtimeSync();
        } else {
          this.stopRealtimeSync();
        }
      });
    }

    if (auth.currentUser) {
      this.initRealtimeSync();
    }

    return () => {
      if (this.authUnsubscribe) {
        this.authUnsubscribe();
        this.authUnsubscribe = null;
      }
      this.stopRealtimeSync();
    };
  }

  // ==========================================
  // Firestore Persistence Helpers
  // ==========================================

  public static async saveUser(user: User): Promise<void> {
    try {
      const userRef = doc(db, 'users', user.id);
      await setDoc(userRef, user, { merge: true });
    } catch (e) {
      console.error('Failed to sync user to Firestore:', e);
    }
  }

  public static async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, updates);
    } catch (e) {
      console.error('Failed to update user in Firestore:', e);
    }
  }

  public static async deleteUser(userId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (e) {
      console.error('Failed to delete user in Firestore:', e);
    }
  }

  public static async saveCustomer(customer: Customer): Promise<void> {
    try {
      const custRef = doc(db, 'customers', customer.id);
      await setDoc(custRef, customer, { merge: true });
    } catch (e) {
      console.error('Failed to sync customer to Firestore:', e);
    }
  }

  public static async saveTransaction(txn: Transaction): Promise<void> {
    try {
      const txRef = doc(db, 'transactions', txn.id);
      await setDoc(txRef, txn, { merge: true });
    } catch (e) {
      console.error('Failed to sync transaction to Firestore:', e);
    }
  }

  public static async savePayment(payment: Payment): Promise<void> {
    try {
      const pmtRef = doc(db, 'payments', payment.id);
      await setDoc(pmtRef, payment, { merge: true });
    } catch (e) {
      console.error('Failed to sync payment to Firestore:', e);
    }
  }

  public static async saveLedgerEntry(entry: LedgerEntry): Promise<void> {
    try {
      const entryRef = doc(db, 'ledgerEntries', entry.id);
      await setDoc(entryRef, entry, { merge: true });
    } catch (e) {
      console.error('Failed to sync ledger entry to Firestore:', e);
    }
  }

  public static async saveWholesaler(wholesaler: Wholesaler): Promise<void> {
    try {
      const wRef = doc(db, 'wholesalers', wholesaler.id);
      await setDoc(wRef, wholesaler, { merge: true });
    } catch (e) {
      console.error('Failed to sync wholesaler to Firestore:', e);
    }
  }

  public static async saveInventoryMovement(movement: InventoryMovement): Promise<void> {
    try {
      const mRef = doc(db, 'inventoryMovements', movement.id);
      await setDoc(mRef, movement, { merge: true });
    } catch (e) {
      console.error('Failed to sync inventory movement to Firestore:', e);
    }
  }

  public static async saveRateConfig(rates: RateConfiguration): Promise<void> {
    try {
      const ratesRef = doc(db, 'settings', 'rates');
      await setDoc(ratesRef, rates, { merge: true });
    } catch (e) {
      console.error('Failed to sync rates to Firestore:', e);
    }
  }

  public static async saveAuditLog(log: AuditLogEntry): Promise<void> {
    try {
      const logRef = doc(db, 'auditLogs', log.id);
      await setDoc(logRef, log);
    } catch (e: any) {
      if (e?.code === 'permission-denied') {
        // If unauthenticated or offline, audit log remains securely tracked in local memory
        return;
      }
      console.warn('Failed to sync audit log to Firestore:', e?.message || e);
    }
  }
}
