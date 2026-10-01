/**
 * Chakki Ledger - Document Models & TypeScript Interfaces
 * Converted from the domain schema for local and persistence models.
 */

export type Timestamp = {
  seconds: number;
  nanoseconds?: number;
  toDate?: () => Date;
};

export type UserRole = 'ADMIN' | 'SHOP_OWNER' | 'OWNER';

export interface UserDocument {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  location?: string;
  isActive: boolean;
  approvalStatus?: 'PENDING_APPROVAL' | 'APPROVED' | 'SUSPENDED' | 'DEACTIVATED' | 'BLOCKED';
  rejectionReason?: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export interface CustomerDocument {
  id?: string;
  name: string;
  phone: string;
  customerCode?: string;
  area?: string;
  notes?: string;
  isActive: boolean;
  createdByUid: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export interface CustomerBalanceDocument {
  customerId: string;
  dueAmount: number;
  creditAmount: number;
  wheatBalanceKg?: number;
  riceBalanceKg?: number;
  updatedAt: string | Timestamp;
}

export interface TransactionDocument {
  id?: string;
  transactionNumber?: string;
  customerId?: string;
  customerName?: string;
  type: string;
  totalAmount: number;
  status: string;
  idempotencyKey: string;
  createdByUid: string;
  createdByName?: string;
  notes?: string;
  settlementAmount?: number;
  amountPaid?: number;
  remainingAmount?: number;
  settlementStatus?: string;
  originalTransactionId?: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export interface TransactionItemDocument {
  id?: string;
  transactionId: string;
  itemType: string;
  quantity: number;
  rate: number;
  amount: number;
  createdAt: string | Timestamp;
}

export interface WheatLedgerDocument {
  id?: string;
  customerId: string;
  transactionId: string;
  quantityChange: number;
  type: string;
  balanceAfter?: number;
  createdAt: string | Timestamp;
}

export interface RiceLedgerDocument {
  id?: string;
  customerId: string;
  transactionId: string;
  quantity: number;
  rate: number;
  amount: number;
  balanceAfter?: number;
  createdAt: string | Timestamp;
}

export interface PaymentDocument {
  id?: string;
  transactionId?: string;
  customerId: string;
  customerName?: string;
  amount: number;
  direction: 'IN' | 'OUT';
  paymentMode: 'CASH' | 'ONLINE' | 'UPI' | 'BANK';
  referenceNumber?: string;
  createdByUid: string;
  createdAt: string | Timestamp;
}

export interface InventoryMovementDocument {
  id?: string;
  itemType: string;
  inventoryItemId?: string;
  quantityChange: number;
  balanceAfter?: number;
  unitCost?: number;
  transactionId?: string;
  reason?: string;
  createdAt: string | Timestamp;
}

export interface WholesalerDocument {
  id?: string;
  wholesalerCode?: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  totalRicePurchasedKg?: number;
  totalOutstandingPayment?: number;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export interface RicePurchaseDocument {
  id?: string;
  customerId?: string;
  transactionId: string;
  quantity: number;
  purchaseRate: number;
  totalAmount: number;
  createdAt: string | Timestamp;
}

export interface RiceSaleDocument {
  id?: string;
  wholesalerId: string;
  transactionId: string;
  quantity: number;
  sellingRate: number;
  totalAmount: number;
  paymentStatus: string;
  createdAt: string | Timestamp;
}

export interface ExpenseDocument {
  id?: string;
  category: string;
  amount: number;
  paymentMode: string;
  paidTo?: string;
  notes?: string;
  createdByUid: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export interface DailyClosingDocument {
  id?: string;
  date: string;
  openingCash: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  closedByUid: string;
  closedByName?: string;
  closedAt: string | Timestamp;
  createdAt: string | Timestamp;
}

export interface RateConfigurationDocument {
  id?: string;
  rateType?: string;
  value?: number;
  chaliAttaExchangeRate?: number;
  rollAttaExchangeRate?: number;
  rollAttaSellingRate?: number;
  ricePurchaseRate?: number;
  effectiveFrom: string | Timestamp;
  effectiveTo?: string | Timestamp;
  isActive: boolean;
  createdByUid?: string;
  createdAt: string | Timestamp;
}

export interface AuditLogDocument {
  id?: string;
  entityType: string;
  entityId: string;
  action: string;
  reason?: string;
  previousState?: string;
  newState?: string;
  changedByUid: string;
  changedByName?: string;
  createdAt: string | Timestamp;
}
