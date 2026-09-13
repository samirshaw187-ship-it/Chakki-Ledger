/**
 * Chakki Ledger - In-Memory Database Repository
 *
 * Implements relational query behaviors corresponding to Prisma schema models.
 * Serves as development store and fallback, ensuring the app runs immediately
 * while being 100% swappable with Prisma Client.
 */

import {
  Customer,
  Transaction,
  Payment,
  Wholesaler,
  RateConfiguration,
  BusinessProfileSettings,
  ReceiptConfiguration,
  SystemPreferences,
  InventoryConfiguration,
  AuditLogEntry,
  TransactionType,
  TransactionStatus,
  User,
  UserRole,
  LedgerEntry,
  LedgerEntryType,
  InventoryItem,
  InventoryItemCode,
  InventoryCategory,
  InventoryMovement,
  InventoryMovementType,
  ItemDirection,
  GrainUnit,
} from '../types';
import {
  SEED_CUSTOMERS,
  SEED_SAMPLE_PAYMENTS,
  SEED_SAMPLE_TRANSACTIONS,
  SEED_USERS,
  SEED_WHOLESALERS,
  SEED_SAMPLE_LEDGER_ENTRIES,
} from './seed-data';
import { DEFAULT_RATE_CONFIGURATION } from '../config/business.config';
import { AuditService } from '../services/audit.service';

class InMemoryDatabase {
  private users: User[] = [...SEED_USERS];
  private customers: Customer[] = [...SEED_CUSTOMERS];
  private transactions: Transaction[] = [...SEED_SAMPLE_TRANSACTIONS];
  private payments: Payment[] = [...SEED_SAMPLE_PAYMENTS];
  private wholesalers: Wholesaler[] = [...SEED_WHOLESALERS];
  private ledgerEntries: LedgerEntry[] = [...SEED_SAMPLE_LEDGER_ENTRIES];
  private rateConfig: RateConfiguration = { ...DEFAULT_RATE_CONFIGURATION };
  private businessProfile: BusinessProfileSettings = {
    businessName: 'Chakki Ledger',
    address: 'Shop No. 12, Main Market, Kolkata',
    phone: '9876543210',
    alternatePhone: '9876543211',
    email: 'hello@chakkilegder.in',
    gstin: '19ABCDE1234F1Z5',
    tagline: 'Atta Chakki & Grain Trading Ledger',
  };
  private receiptConfiguration: ReceiptConfiguration = {
    businessName: 'Chakki Ledger',
    address: 'Shop No. 12, Main Market, Kolkata',
    phone: '9876543210',
    gstin: '19ABCDE1234F1Z5',
    footerText: 'Thank you for your business.',
    receiptFormat: 'THERMAL',
    defaultFormat: 'THERMAL',
  };
  private systemPreferences: SystemPreferences = {
    currency: 'INR',
    measurementUnit: GrainUnit.KG,
    timezone: 'Asia/Kolkata',
    defaultReportPeriod: 'THIS_MONTH',
  };
  private inventoryItems: InventoryItem[] = [
    this.createInventoryItem('inv-wheat', InventoryItemCode.WHEAT, 'Wheat', InventoryCategory.RAW_MATERIAL, 100),
    this.createInventoryItem('inv-chali-atta', InventoryItemCode.CHALI_ATTA, 'Chali Atta', InventoryCategory.FINISHED_PRODUCT, 50),
    this.createInventoryItem('inv-roll-atta', InventoryItemCode.ROLL_ATTA, 'Roll Atta', InventoryCategory.FINISHED_PRODUCT, 50),
    this.createInventoryItem('inv-rice', InventoryItemCode.RICE, 'Rice', InventoryCategory.TRADED_GOOD, 100),
  ];
  private inventoryMovements: InventoryMovement[] = [];

  private createInventoryItem(id: string, code: InventoryItemCode, name: string, category: InventoryCategory, reorderLevel: number): InventoryItem {
    const now = new Date().toISOString();
    return { id, code, name, category, unit: GrainUnit.KG, isActive: true, reorderLevel, createdAt: now, updatedAt: now };
  }

  constructor() {
    // Initial audit log
    AuditService.log({
      action: 'SYSTEM' as any,
      entityType: 'DATABASE',
      entityId: 'init',
      performedById: 'user-owner-01',
      performedByName: 'Gopal Sahu (Owner)',
      reason: 'Database foundation initialized with seed records',
    });
  }

  // USERS
  public getUsers(): User[] {
    return [...this.users];
  }

  public getUserById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  public getUserByPhone(phone: string): User | undefined {
    return this.users.find((u) => u.phone === phone);
  }

  public addUser(userData: Omit<User, 'id' | 'createdAt'>): User {
    const newUser: User = {
      ...userData,
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    this.users.push(newUser);
    return newUser;
  }

  public updateUser(id: string, updates: Partial<User>): User | undefined {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return undefined;
    this.users[index] = { ...this.users[index], ...updates };
    return this.users[index];
  }

  public toggleUserStatus(id: string): User | undefined {
    const user = this.users.find((u) => u.id === id);
    if (user) {
      user.isActive = !user.isActive;
    }
    return user;
  }

  // CUSTOMERS
  public getCustomers(): Customer[] {
    return [...this.customers];
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.customers.find((c) => c.id === id || c.customerCode === id);
  }

  /**
   * Generates next sequential readable Customer Code, e.g. CUST-00001, CUST-00002
   */
  public generateNextCustomerCode(): string {
    let maxSequence = 0;
    for (const c of this.customers) {
      if (c.customerCode) {
        const match = c.customerCode.match(/^CUST-(\d+)$/i);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSequence) {
            maxSequence = num;
          }
        }
      }
    }
    const nextSeq = maxSequence + 1;
    return `CUST-${String(nextSeq).padStart(5, '0')}`;
  }

  public addCustomer(customer: Omit<Customer, 'id' | 'createdAt'>): Customer {
    const customerCode = customer.customerCode || this.generateNextCustomerCode();
    const newCustomer: Customer = {
      ...customer,
      id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      customerCode,
      createdAt: new Date().toISOString(),
      updatedAt: customer.updatedAt || new Date().toISOString(),
    };
    this.customers.push(newCustomer);
    return newCustomer;
  }

  public updateCustomer(id: string, updates: Partial<Customer>): Customer | undefined {
    const index = this.customers.findIndex((c) => c.id === id || c.customerCode === id);
    if (index === -1) return undefined;
    this.customers[index] = {
      ...this.customers[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return this.customers[index];
  }

  // TRANSACTIONS
  public getTransactions(limit?: number): Transaction[] {
    const list = [...this.transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return limit ? list.slice(0, limit) : list;
  }

  public getTransactionById(id: string): Transaction | undefined {
    return this.transactions.find((t) => t.id === id || t.transactionNumber === id);
  }

  public getTransactionByNumber(txnNumber: string): Transaction | undefined {
    return this.transactions.find((t) => t.transactionNumber.toLowerCase() === txnNumber.toLowerCase());
  }

  public getCustomerTransactions(customerId: string): Transaction[] {
    return this.transactions
      .filter((t) => t.customerId === customerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public saveTransaction(txn: Transaction): Transaction {
    const existingIndex = this.transactions.findIndex((t) => t.id === txn.id);
    if (existingIndex >= 0) {
      this.transactions[existingIndex] = { ...txn, updatedAt: new Date().toISOString() };
      return this.transactions[existingIndex];
    }

    this.transactions.unshift(txn);
    return txn;
  }

  public removeTransaction(id: string): boolean {
    const index = this.transactions.findIndex((t) => t.id === id);
    if (index >= 0) {
      this.transactions.splice(index, 1);
      return true;
    }
    return false;
  }

  public removeLedgerEntry(id: string): boolean {
    const index = this.ledgerEntries.findIndex((e) => e.id === id);
    if (index >= 0) {
      this.ledgerEntries.splice(index, 1);
      return true;
    }
    return false;
  }

  public addTransaction(txn: Omit<Transaction, 'id' | 'transactionNumber' | 'createdAt'>): Transaction {
    const count = this.transactions.length + 1;
    const year = new Date().getFullYear();
    const transactionNumber = `TXN-${year}-${String(count).padStart(4, '0')}`;

    const newTxn: Transaction = {
      ...txn,
      id: `tx-${Date.now()}`,
      transactionNumber,
      createdAt: new Date().toISOString(),
    };

    this.transactions.unshift(newTxn);

    // Update customer cached balances if applicable
    if (newTxn.customerId) {
      const customer = this.getCustomerById(newTxn.customerId);
      if (customer) {
        customer.currentDueAmount += newTxn.balanceDelta || 0;
        customer.lastTransactionAt = newTxn.createdAt;
      }
    }

    return newTxn;
  }

  // PAYMENTS
  public getPayments(): Payment[] {
    return [...this.payments];
  }

  public addPayment(pmt: Omit<Payment, 'id' | 'receiptNumber' | 'createdAt'>): Payment {
    const count = this.payments.length + 1;
    const year = new Date().getFullYear();
    const receiptNumber = `RCT-${year}-${String(count).padStart(4, '0')}`;

    const newPayment: Payment = {
      ...pmt,
      id: `pmt-${Date.now()}`,
      receiptNumber,
      createdAt: new Date().toISOString(),
    };

    this.payments.unshift(newPayment);

    // Safely update customer dues cache
    if (newPayment.customerId) {
      const customer = this.getCustomerById(newPayment.customerId);
      if (customer) {
        const reduction = newPayment.appliedToBillAmount !== undefined ? newPayment.appliedToBillAmount : newPayment.amount;
        customer.currentDueAmount = Math.max(0, (customer.currentDueAmount || 0) - reduction);
      }
    }

    return newPayment;
  }

  public updatePayment(id: string, updates: Partial<Payment>): Payment | undefined {
    const index = this.payments.findIndex((payment) => payment.id === id || payment.receiptNumber === id);
    if (index === -1) return undefined;
    this.payments[index] = { ...this.payments[index], ...updates };
    return this.payments[index];
  }

  // WHOLESALERS
  public getWholesalers(): Wholesaler[] {
    return [...this.wholesalers];
  }

  public getWholesalerById(idOrCode: string): Wholesaler | undefined {
    return this.wholesalers.find((wholesaler) => wholesaler.id === idOrCode || wholesaler.wholesalerCode === idOrCode);
  }

  public generateNextWholesalerCode(): string {
    const max = this.wholesalers.reduce((highest, wholesaler) => {
      const match = wholesaler.wholesalerCode?.match(/^WHOLE-(\d+)$/i);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    return `WHOLE-${String(max + 1).padStart(5, '0')}`;
  }

  public addWholesaler(input: Omit<Wholesaler, 'id' | 'wholesalerCode' | 'createdAt'>): Wholesaler {
    const now = new Date().toISOString();
    const wholesaler: Wholesaler = {
      ...input,
      id: `wholesaler-${Date.now()}`,
      wholesalerCode: this.generateNextWholesalerCode(),
      createdAt: now,
      updatedAt: now,
    };
    this.wholesalers.unshift(wholesaler);
    return { ...wholesaler };
  }

  public updateWholesaler(id: string, updates: Partial<Wholesaler>): Wholesaler | undefined {
    const index = this.wholesalers.findIndex((wholesaler) => wholesaler.id === id || wholesaler.wholesalerCode === id);
    if (index < 0) return undefined;
    this.wholesalers[index] = { ...this.wholesalers[index], ...updates, updatedAt: new Date().toISOString() };
    return { ...this.wholesalers[index] };
  }

  // LEDGER ENTRIES
  public getLedgerEntries(filter?: {
    customerId?: string;
    entryType?: LedgerEntryType;
    startDate?: string;
    endDate?: string;
  }): LedgerEntry[] {
    let list = [...this.ledgerEntries];

    if (filter?.customerId) {
      list = list.filter((e) => e.customerId === filter.customerId);
    }
    if (filter?.entryType) {
      list = list.filter((e) => e.entryType === filter.entryType);
    }
    if (filter?.startDate) {
      const start = new Date(filter.startDate).getTime();
      list = list.filter((e) => new Date(e.date).getTime() >= start);
    }
    if (filter?.endDate) {
      const end = new Date(filter.endDate).getTime();
      list = list.filter((e) => new Date(e.date).getTime() <= end);
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public getLedgerEntryById(id: string): LedgerEntry | undefined {
    return this.ledgerEntries.find((e) => e.id === id);
  }

  public getCustomerLedgerEntries(customerId: string): LedgerEntry[] {
    return this.ledgerEntries
      .filter((e) => e.customerId === customerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public getLedgerEntriesByTransactionId(transactionId: string): LedgerEntry[] {
    return this.ledgerEntries.filter(
      (e) => e.transactionId === transactionId || (e as any).transactionNumber === transactionId
    );
  }

  public addLedgerEntry(
    entry: Omit<LedgerEntry, 'id' | 'createdAt'>
  ): LedgerEntry {
    const newEntry: LedgerEntry = {
      ...entry,
      id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    this.ledgerEntries.unshift(newEntry);
    return newEntry;
  }

  // RATES
  public getRateConfig(): RateConfiguration {
    return { ...this.rateConfig };
  }

  public getBusinessProfile(): BusinessProfileSettings {
    return { ...this.businessProfile };
  }

  public updateBusinessProfile(profile: BusinessProfileSettings): BusinessProfileSettings {
    this.businessProfile = { ...profile };
    return { ...this.businessProfile };
  }

  public getReceiptConfiguration(): ReceiptConfiguration {
    return { ...this.receiptConfiguration };
  }

  public updateReceiptConfiguration(config: ReceiptConfiguration): ReceiptConfiguration {
    this.receiptConfiguration = { ...config };
    return { ...this.receiptConfiguration };
  }

  public getSystemPreferences(): SystemPreferences {
    return { ...this.systemPreferences };
  }

  public updateSystemPreferences(config: SystemPreferences): SystemPreferences {
    this.systemPreferences = { ...config };
    return { ...this.systemPreferences };
  }

  // INVENTORY
  public getInventoryItems(): InventoryItem[] {
    return this.inventoryItems.map((item) => ({ ...item }));
  }

  public getInventoryConfiguration(): InventoryConfiguration[] {
    return this.inventoryItems.map((item) => ({
      itemCode: item.code,
      itemName: item.name,
      category: item.category,
      unit: item.unit,
      reorderLevel: item.reorderLevel,
      isActive: item.isActive,
    }));
  }

  public updateInventoryConfiguration(itemCode: InventoryItemCode, updates: Partial<InventoryConfiguration>): InventoryConfiguration {
    const item = this.inventoryItems.find((entry) => entry.code === itemCode);
    if (!item) throw new Error('Inventory item not found.');

    item.isActive = updates.isActive ?? item.isActive;
    item.reorderLevel = updates.reorderLevel ?? item.reorderLevel;
    item.name = updates.itemName ?? item.name;
    item.unit = (updates.unit ?? item.unit) as GrainUnit;
    item.category = updates.category ?? item.category;
    item.updatedAt = new Date().toISOString();

    return this.getInventoryConfiguration().find((entry) => entry.itemCode === itemCode)!;
  }

  public getInventoryItemById(idOrCode: string): InventoryItem | undefined {
    return this.inventoryItems.find((item) => item.id === idOrCode || item.code === idOrCode);
  }

  public updateInventoryItem(id: string, updates: Partial<InventoryItem>): InventoryItem | undefined {
    const index = this.inventoryItems.findIndex((item) => item.id === id);
    if (index < 0) return undefined;
    this.inventoryItems[index] = { ...this.inventoryItems[index], ...updates, updatedAt: new Date().toISOString() };
    return { ...this.inventoryItems[index] };
  }

  public getInventoryMovements(): InventoryMovement[] {
    return this.inventoryMovements.map((movement) => ({ ...movement }));
  }

  public addInventoryMovement(movement: Omit<InventoryMovement, 'id' | 'createdAt'>): InventoryMovement {
    const created: InventoryMovement = {
      ...movement,
      id: `inv-movement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    this.inventoryMovements.unshift(created);
    return { ...created };
  }

  public getRates(): RateConfiguration {
    return this.getRateConfig();
  }

  public updateRateConfig(updates: Partial<RateConfiguration>): RateConfiguration {
    this.rateConfig = { ...this.rateConfig, ...updates, effectiveFrom: new Date().toISOString() };
    return { ...this.rateConfig };
  }

  // AUDIT LOGS
  public getAuditLogs(): AuditLogEntry[] {
    return AuditService.getAllLogs();
  }

  // SUMMARY METRICS (for fast mobile dashboard & admin)
  public getSummaryMetrics() {
    const totalCustomers = this.customers.length;
    const totalDue = this.customers.reduce((sum, c) => sum + Math.max(0, c.currentDueAmount), 0);
    const totalAdvance = this.customers.reduce((sum, c) => sum + Math.abs(Math.min(0, c.currentDueAmount)), 0);
    const totalWheatHeldKg = this.customers.reduce((sum, c) => sum + (c.wheatBalanceKg || 0), 0);
    const totalTransactions = this.transactions.length;

    return {
      totalCustomers,
      totalDue,
      totalAdvance,
      totalWheatHeldKg,
      totalTransactions,
    };
  }
}

export const dbRepository = new InMemoryDatabase();
