/**
 * Chakki Ledger - Core Shared Types and Enums
 */

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
}

export enum TransactionType {
  WHEAT_DEPOSIT = 'WHEAT_DEPOSIT',
  WHEAT_ATTA_EXCHANGE = 'WHEAT_ATTA_EXCHANGE',
  WHEAT_CASH_SETTLEMENT = 'WHEAT_CASH_SETTLEMENT',
  RICE_PURCHASE = 'RICE_PURCHASE',
  RICE_ATTA_SETTLEMENT = 'RICE_ATTA_SETTLEMENT',
  RICE_CASH_SETTLEMENT = 'RICE_CASH_SETTLEMENT',
  ATTA_PURCHASE = 'ATTA_PURCHASE',
  CASH_PAYMENT = 'CASH_PAYMENT',
  CUSTOMER_CREDIT = 'CUSTOMER_CREDIT',
  CUSTOMER_DEBIT = 'CUSTOMER_DEBIT',
  CORRECTION = 'CORRECTION',
  REVERSAL = 'REVERSAL',
  RICE_WHOLESALE_SALE = 'RICE_WHOLESALE_SALE',
  EXPENSE = 'EXPENSE'
}

export enum WholesalerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum RiceCostingMethod {
  FIFO = 'FIFO',
  WEIGHTED_AVERAGE = 'WEIGHTED_AVERAGE',
}

export interface RiceCostLayer {
  id: string;
  sourceTransactionId: string;
  sourceTransactionNumber?: string;
  purchaseDate: string;
  quantityReceived: number;
  quantityRemaining: number;
  purchaseRate: number;
  totalCost: number;
}

export interface RiceCostBreakdownLine {
  layerId?: string;
  sourceTransactionId?: string;
  sourceTransactionNumber?: string;
  quantity: number;
  rate: number;
  cost: number;
  label: string;
}

export interface RiceProfitSnapshot {
  costingMethod: RiceCostingMethod;
  revenue: number;
  cogs: number;
  grossProfit: number;
  profitPerKg: number;
  grossMargin: number;
  saleQuantity: number;
  sellingRate: number;
  costPerKg: number;
  breakdown: RiceCostBreakdownLine[];
  finalizedAt: string;
}

export enum TransactionStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  CREDIT = 'CREDIT',
  DUE = 'DUE',
  SETTLED = 'SETTLED',
  CORRECTED = 'CORRECTED',
  REVERSED = 'REVERSED',
  CANCELLED = 'CANCELLED'
}

export enum ItemType {
  WHEAT = 'WHEAT',
  RICE = 'RICE',
  ATTA = 'ATTA',
  CASH = 'CASH',
  EXPENSE = 'EXPENSE'
}

export enum ItemDirection {
  IN = 'IN',
  OUT = 'OUT'
}

export enum InventoryItemCode {
  WHEAT = 'WHEAT',
  CHALI_ATTA = 'CHALI_ATTA',
  ROLL_ATTA = 'ROLL_ATTA',
  RICE = 'RICE',
}

export enum InventoryCategory {
  RAW_MATERIAL = 'RAW_MATERIAL',
  FINISHED_PRODUCT = 'FINISHED_PRODUCT',
  TRADED_GOOD = 'TRADED_GOOD',
}

export enum InventoryMovementType {
  OPENING_STOCK = 'OPENING_STOCK',
  PURCHASE = 'PURCHASE',
  PRODUCTION = 'PRODUCTION',
  SALE = 'SALE',
  EXCHANGE = 'EXCHANGE',
  SETTLEMENT = 'SETTLEMENT',
  ADJUSTMENT = 'ADJUSTMENT',
  REVERSAL = 'REVERSAL',
}

export interface InventoryItem {
  id: string;
  code: InventoryItemCode;
  name: string;
  category: InventoryCategory;
  unit: GrainUnit;
  isActive: boolean;
  reorderLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessProfileSettings {
  businessName: string;
  address: string;
  phone: string;
  alternatePhone: string;
  email: string;
  gstin: string;
  tagline: string;
}

export interface ReceiptConfiguration {
  businessName: string;
  address: string;
  phone: string;
  gstin: string;
  footerText: string;
  receiptFormat: 'THERMAL' | 'A4';
  defaultFormat: 'THERMAL' | 'A4';
}

export interface InventoryConfiguration {
  itemCode: InventoryItemCode;
  itemName: string;
  category: InventoryCategory;
  unit: GrainUnit;
  reorderLevel: number;
  isActive: boolean;
}

export interface SystemPreferences {
  currency: 'INR';
  measurementUnit: GrainUnit;
  timezone: string;
  defaultReportPeriod: string;
}

export interface InventoryMovement {
  id: string;
  inventoryItemId: string;
  transactionId?: string;
  movementType: InventoryMovementType;
  quantity: number;
  direction: ItemDirection;
  referenceType: 'TRANSACTION' | 'ADJUSTMENT' | 'OPENING_STOCK';
  referenceId: string;
  reason?: string;
  createdById?: string;
  createdByName?: string;
  createdAt: string;
}

export enum AttaType {
  CHALI_ATTA = 'CHALI_ATTA', // ₹8/kg exchange
  ROLL_ATTA = 'ROLL_ATTA'    // ₹10/kg exchange
}

export enum GrainUnit {
  KG = 'KG',
  QUINTAL = 'QUINTAL'
}

export enum PaymentMode {
  CASH = 'CASH',
  UPI = 'UPI',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CREDIT_OFFSET = 'CREDIT_OFFSET'
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  CORRECTION = 'CORRECTION',
  REVERSAL = 'REVERSAL',
  STATUS_CHANGE = 'STATUS_CHANGE',
  EXPORT = 'EXPORT',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  USER_UPDATE = 'USER_UPDATE',
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  TRANSACTION_CORRECTED = 'TRANSACTION_CORRECTED',
  TRANSACTION_REVERSED = 'TRANSACTION_REVERSED',
  CORRECTION_COMPENSATING_CREATED = 'CORRECTION_COMPENSATING_CREATED',
  REVERSAL_COMPENSATING_CREATED = 'REVERSAL_COMPENSATING_CREATED',
  PAYMENT_CREATED = 'PAYMENT_CREATED',
  PAYMENT_UPDATED = 'PAYMENT_UPDATED',
  RATE_OVERRIDE_USED = 'RATE_OVERRIDE_USED',
  CUSTOMER_CREATED = 'CUSTOMER_CREATED',
  CUSTOMER_UPDATED = 'CUSTOMER_UPDATED',
  CUSTOMER_STATUS_CHANGED = 'CUSTOMER_STATUS_CHANGED',
  ACCOUNT_APPROVED = 'ACCOUNT_APPROVED',
  ACCOUNT_REJECTED = 'ACCOUNT_REJECTED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  USER_REGISTERED = 'USER_REGISTERED',
  OPENING_STOCK_CREATED = 'OPENING_STOCK_CREATED',
  INVENTORY_ADJUSTED = 'INVENTORY_ADJUSTED',
  INVENTORY_SETTING_CHANGED = 'INVENTORY_SETTING_CHANGED',
  RICE_PURCHASE_CREATED = 'RICE_PURCHASE_CREATED',
  RICE_WHOLESALE_SALE_CREATED = 'RICE_WHOLESALE_SALE_CREATED',
  WHOLESALER_CREATED = 'WHOLESALER_CREATED',
  WHOLESALER_UPDATED = 'WHOLESALER_UPDATED',
  WHOLESALER_STATUS_CHANGED = 'WHOLESALER_STATUS_CHANGED',
  WHOLESALE_RATE_OVERRIDE = 'WHOLESALE_RATE_OVERRIDE',
  RICE_COSTING_METHOD_CHANGED = 'RICE_COSTING_METHOD_CHANGED',
  BUSINESS_PROFILE_UPDATED = 'BUSINESS_PROFILE_UPDATED',
  RATE_CHANGED = 'RATE_CHANGED',
  RECEIPT_CONFIG_UPDATED = 'RECEIPT_CONFIG_UPDATED',
  SYSTEM_PREFERENCES_UPDATED = 'SYSTEM_PREFERENCES_UPDATED',
  CHALI_ATTA_EXCHANGE_RATE_CHANGED = 'CHALI_ATTA_EXCHANGE_RATE_CHANGED',
  ROLL_ATTA_EXCHANGE_RATE_CHANGED = 'ROLL_ATTA_EXCHANGE_RATE_CHANGED',
  CHALI_ATTA_SELLING_RATE_CHANGED = 'CHALI_ATTA_SELLING_RATE_CHANGED',
  ROLL_ATTA_SELLING_RATE_CHANGED = 'ROLL_ATTA_SELLING_RATE_CHANGED',
  RICE_PURCHASE_RATE_CHANGED = 'RICE_PURCHASE_RATE_CHANGED',
  WHEAT_CASH_RATE_CHANGED = 'WHEAT_CASH_RATE_CHANGED',
  WHOLESALE_DEFAULT_RATE_CHANGED = 'WHOLESALE_DEFAULT_RATE_CHANGED',
  BACKUP_STARTED = 'BACKUP_STARTED',
  BACKUP_COMPLETED = 'BACKUP_COMPLETED',
  BACKUP_FAILED = 'BACKUP_FAILED',
  EXPORT_CREATED = 'EXPORT_CREATED',
  EXPORT_FAILED = 'EXPORT_FAILED',
  RESTORE_ATTEMPTED = 'RESTORE_ATTEMPTED',
}

export enum GrainType {
  WHEAT = 'WHEAT',
  RATION_RICE = 'RATION_RICE',
  CHALI_ATTA = 'CHALI_ATTA',
  ROLL_ATTA = 'ROLL_ATTA',
  BRAN = 'BRAN'
}

export enum SettlementPaymentStatus {
  CALCULATED = 'CALCULATED',
  PENDING = 'PENDING',
  PAID = 'PAID',
  PARTIAL = 'PARTIAL',
  DUE = 'DUE',
}

export type SettlementDirection = 'CUSTOMER_PAYS' | 'CUSTOMER_RECEIVES' | 'SHOP_PAYS' | 'SETTLED';

export interface User {
  id: string;
  email: string;
  phone?: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  isApproved?: boolean;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  authProvider?: 'password' | 'google';
  password?: string;
  pin?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface Customer {
  id: string;
  customerCode: string; // Unique sequence, e.g. CUST-00001
  name: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;
  villageOrArea?: string; // Kept for backwards compatibility
  notes?: string;
  status: CustomerStatus;
  isActive: boolean; // Kept in sync with status === ACTIVE
  currentDueAmount: number; // Placeholder for upcoming transaction/ledger module
  wheatBalanceKg: number;   // Placeholder for upcoming transaction/ledger module
  riceCreditAmount: number; // Placeholder for upcoming transaction/ledger module
  lastTransactionAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TransactionItem {
  id: string;
  transactionId: string;
  itemType?: ItemType | string;
  direction?: ItemDirection | 'IN' | 'OUT';
  grainType?: GrainType;
  attaType?: AttaType;
  quantity: number;
  unit: GrainUnit | 'KG' | 'RUPEE';
  ratePerUnit: number; // Historically locked rate!
  totalAmount: number;
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface Transaction {
  id: string;
  transactionNumber: string;
  type: TransactionType;
  status: TransactionStatus;
  date: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerCode?: string;
  wholesalerId?: string;
  wholesalerName?: string;
  wholesalerCode?: string;
  profitSnapshot?: RiceProfitSnapshot;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount: number;
  balanceDelta: number;
  settlementDirection?: SettlementDirection;
  paymentStatus?: SettlementPaymentStatus | 'CALCULATED' | 'PENDING' | 'PAID' | 'PARTIAL' | 'DUE';
  items: TransactionItem[];
  notes?: string;
  description?: string;
  isCorrectionOfId?: string;
  correctionReason?: string;
  correctionCount?: number;
  correctedById?: string;
  correctedByName?: string;
  correctedAt?: string;
  reversalReason?: string;
  reversalTxnId?: string;
  reversalDate?: string;
  reversedById?: string;
  reversedByName?: string;
  netCorrectionDiff?: string;
  createdById: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export enum PaymentType {
  RECEIVE_PAYMENT = 'RECEIVE_PAYMENT',
  PAY_CUSTOMER = 'PAY_CUSTOMER',
  APPLY_CREDIT = 'APPLY_CREDIT',
  SETTLE_DUE = 'SETTLE_DUE',
  OVERPAYMENT_CREDIT = 'OVERPAYMENT_CREDIT',
}

export enum PaymentStatus {
  PAID = 'PAID',
  PARTIAL = 'PARTIAL',
  SETTLED = 'SETTLED',
  CORRECTED = 'CORRECTED',
  REVERSED = 'REVERSED',
}

export interface Payment {
  id: string;
  receiptNumber: string;
  date: string;
  customerId: string;
  customerName?: string;
  customerCode?: string;
  transactionId?: string;
  transactionNumber?: string;
  paymentType?: PaymentType | string;
  amount: number;
  appliedToBillAmount?: number;
  creditCreatedAmount?: number;
  advanceCreditCreated?: number;
  mode: PaymentMode;
  paymentMode?: PaymentMode;
  status?: PaymentStatus | 'PAID' | 'PARTIAL' | 'SETTLED' | 'CORRECTED' | 'REVERSED';
  referenceNo?: string;
  notes?: string;
  isCorrectionOfReceipt?: string;
  correctionReason?: string;
  correctedAt?: string;
  correctedById?: string;
  correctedByName?: string;
  reversalReason?: string;
  reversalDate?: string;
  reversedById?: string;
  reversedByName?: string;
  createdById: string;
  createdByName?: string;
  receivedByName?: string;
  createdAt: string;
}

export interface Wholesaler {
  id: string;
  wholesalerCode: string;
  name: string;
  companyName?: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;
  notes?: string;
  status: WholesalerStatus;
  totalRicePurchasedKg: number;
  totalOutstandingPayment: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface RateConfiguration {
  id: string;
  chaliAttaExchangeRate: number; // e.g. 8 (₹8/kg)
  rollAttaExchangeRate: number;  // e.g. 10 (₹10/kg)
  chaliAttaSellingRate?: number; // e.g. 35 (₹35/kg)
  rollAttaSellingRate: number;   // e.g. 40 (₹40/kg)
  ricePurchaseRate: number;      // e.g. 21 (₹21/kg)
  riceCashPurchaseRate?: number; // e.g. 21 (₹21/kg) - Configured Rice Cash Purchase Rate
  wheatCashPurchaseRate?: number; // e.g. 24 (₹24/kg) - Configured Wheat Cash Purchase Rate (distinct from atta exchange)
  wheatToAttaConversionRatio: number; // Configurable ratio (default: 1.0, 1 kg wheat yields 1 kg atta)
  riceCostingMethod: RiceCostingMethod;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
}

export interface SettlementCalculationInput {
  riceQuantityKg?: number;
  ricePurchaseRate?: number;
  attaQuantityKg?: number;
  attaSellingRate?: number;
}

export interface SettlementCalculationResult {
  riceValue: number;
  attaValue: number;
  netSettlement: number;
  direction: SettlementDirection;
  summaryText: string;
}

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityReference?: string;
  performedById: string;
  performedByName: string;
  reason?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface DailyClosingSummary {
  id: string;
  closingDate: string;
  openingCash: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedCash: number;
  actualCashInHand: number;
  cashDiscrepancy: number;
  totalWheatMilledKg: number;
  totalRiceBoughtKg: number;
  totalAttaSoldKg: number;
  closedByName: string;
  closedAt: string;
}

export interface AppState {
  currentUser: User | null;
  activeRole: UserRole;
  isMobileFrame: boolean;
}

// ==========================================
// CUSTOMER LEDGER FOUNDATION TYPES
// ==========================================

export enum LedgerEntryType {
  WHEAT = 'WHEAT',
  ATTA = 'ATTA',
  RICE = 'RICE',
  CASH = 'CASH',
  BRAN = 'BRAN',
}

export enum LedgerUnit {
  KG = 'KG',
  RUPEE = 'RUPEE',
}

export enum LedgerDirection {
  IN = 'IN',
  OUT = 'OUT',
}

export enum LedgerStatus {
  PAID = 'PAID',
  PARTIAL = 'PARTIAL',
  DUE = 'DUE',
  CREDIT = 'CREDIT',
  SETTLED = 'SETTLED',
  CORRECTED = 'CORRECTED',
  REVERSED = 'REVERSED',
}

export interface LedgerEntry {
  id: string;
  customerId: string;
  customerName?: string;
  transactionId: string;
  transactionNumber?: string;
  entryType: LedgerEntryType;
  quantity?: number;
  unit: LedgerUnit;
  rate?: number;
  amount?: number;
  direction: LedgerDirection;
  status?: LedgerStatus;
  description: string;
  date: string;
  createdById?: string;
  createdByName?: string;
  createdAt: string;
  notes?: string;
}

export interface CustomerAccountBalance {
  customerId: string;
  customerName?: string;
  customerCode?: string;
  wheatBalanceKg: number;
  attaBalanceKg: number;
  riceCreditAmount: number;
  cashCreditAmount: number;
  cashDueAmount: number;
  netCashBalance: number; // positive = credit (shop owes customer), negative = due (customer owes shop)
  totalEntriesCount: number;
  lastActivityDate?: string;
}

export interface CustomerStatementSummary {
  totalWheatInKg: number;
  totalWheatOutKg: number;
  netWheatBalanceKg: number;

  totalAttaInKg: number;
  totalAttaOutKg: number;
  netAttaBalanceKg: number;

  totalRiceInKg: number;
  totalRiceOutKg: number;
  netRiceBalanceKg: number;

  totalCashInAmount: number;
  totalCashOutAmount: number;
  netCashCreditAmount: number;
  netCashDueAmount: number;
}

export interface CustomerStatement {
  customer: Customer;
  periodLabel: string;
  startDate?: string;
  endDate?: string;
  entries: LedgerEntry[];
  summary: CustomerStatementSummary;
  balances: CustomerAccountBalance;
}

