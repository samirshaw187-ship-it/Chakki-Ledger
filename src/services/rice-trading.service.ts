import { dbRepository } from '../db/in-memory-db';
import { AuditService } from './audit.service';
import { InventoryService } from './inventory.service';
import {
  AuditAction,
  GrainType,
  GrainUnit,
  InventoryItemCode,
  ItemDirection,
  ItemType,
  Transaction,
  TransactionStatus,
  TransactionType,
  User,
  Wholesaler,
  WholesalerStatus,
} from '../types';
import { hasPermission, Permission } from '../modules/auth/permissions';
import { roundCurrency, roundQuantity } from '../utils/precision';
import { RiceProfitService } from './rice-profit.service';

export interface RicePurchaseRecord {
  transaction: Transaction;
  quantity: number;
  purchaseRate: number;
  totalValue: number;
}

export interface WholesaleSaleRecord {
  transaction: Transaction;
  wholesaler: Wholesaler;
  quantity: number;
  sellingRate: number;
  saleValue: number;
  amountPaid: number;
  amountDue: number;
}

const riceItem = (transaction: Transaction) => transaction.items.find((item) => item.itemType === ItemType.RICE || item.grainType === GrainType.RATION_RICE);

export class RiceTradingService {
  public static getWholesalers(search = ''): Wholesaler[] {
    const query = search.trim().toLowerCase();
    return dbRepository.getWholesalers().filter((wholesaler) => wholesaler.status === WholesalerStatus.ACTIVE && (!query || [wholesaler.name, wholesaler.companyName, wholesaler.phone, wholesaler.wholesalerCode].some((value) => value?.toLowerCase().includes(query))));
  }

  public static getWholesaler(idOrCode: string): Wholesaler | undefined {
    return dbRepository.getWholesalerById(idOrCode);
  }

  public static createWholesaler(input: { name: string; companyName?: string; phone?: string; alternatePhone?: string; address?: string; notes?: string }, actor: User): Wholesaler {
    if (!hasPermission(actor.role, Permission.CREATE_WHOLESALER)) throw new Error('You do not have permission to create wholesalers.');
    if (!input.name.trim()) throw new Error('Wholesaler name is required.');
    const wholesaler = dbRepository.addWholesaler({
      name: input.name.trim(), companyName: input.companyName?.trim(), phone: input.phone?.trim(), alternatePhone: input.alternatePhone?.trim(), address: input.address?.trim(), notes: input.notes?.trim(), status: WholesalerStatus.ACTIVE, isActive: true, totalRicePurchasedKg: 0, totalOutstandingPayment: 0,
    });
    AuditService.log({ action: AuditAction.WHOLESALER_CREATED, entityType: 'WHOLESALER', entityId: wholesaler.id, performedById: actor.id, performedByName: actor.name, newState: { code: wholesaler.wholesalerCode, name: wholesaler.name } });
    return wholesaler;
  }

  public static updateWholesaler(id: string, updates: Partial<Wholesaler>, actor: User): Wholesaler {
    if (!hasPermission(actor.role, Permission.MANAGE_WHOLESALERS)) throw new Error('You do not have permission to update wholesalers.');
    const existing = dbRepository.getWholesalerById(id);
    if (!existing) throw new Error('Wholesaler not found.');
    const updated = dbRepository.updateWholesaler(existing.id, updates);
    if (!updated) throw new Error('Wholesaler not found.');
    AuditService.log({ action: updates.status && updates.status !== existing.status ? AuditAction.WHOLESALER_STATUS_CHANGED : AuditAction.WHOLESALER_UPDATED, entityType: 'WHOLESALER', entityId: updated.id, performedById: actor.id, performedByName: actor.name, newState: { ...updates } });
    return updated;
  }

  public static getRicePurchases(): RicePurchaseRecord[] {
    return dbRepository.getTransactions().filter((transaction) => [TransactionType.RICE_PURCHASE, TransactionType.RICE_ATTA_SETTLEMENT, TransactionType.RICE_CASH_SETTLEMENT].includes(transaction.type)).flatMap((transaction) => {
      const item = riceItem(transaction);
      if (!item || item.quantity <= 0) return [];
      return [{ transaction, quantity: roundQuantity(item.quantity), purchaseRate: roundCurrency(item.ratePerUnit), totalValue: roundCurrency(item.totalAmount) }];
    });
  }

  public static getWholesaleSales(): WholesaleSaleRecord[] {
    return dbRepository.getTransactions().filter((transaction) => transaction.type === TransactionType.RICE_WHOLESALE_SALE && transaction.wholesalerId).flatMap((transaction) => {
      const wholesaler = transaction.wholesalerId ? dbRepository.getWholesalerById(transaction.wholesalerId) : undefined;
      const item = riceItem(transaction);
      if (!wholesaler || !item) return [];
      return [{ transaction, wholesaler, quantity: roundQuantity(item.quantity), sellingRate: roundCurrency(item.ratePerUnit), saleValue: roundCurrency(transaction.netAmount), amountPaid: roundCurrency(transaction.paidAmount), amountDue: roundCurrency(Math.max(0, transaction.balanceDelta)) }];
    });
  }

  public static getWholesalerSales(wholesalerId: string): WholesaleSaleRecord[] {
    return this.getWholesaleSales().filter((sale) => sale.wholesaler.id === wholesalerId);
  }

  public static async createWholesaleSale(input: { wholesalerId: string; quantity: number; sellingRate: number; amountPaid: number; notes?: string; rateOverrideReason?: string }, actor: User): Promise<WholesaleSaleRecord> {
    if (!hasPermission(actor.role, Permission.CREATE_WHOLESALE_SALE)) throw new Error('You do not have permission to create wholesale sales.');
    const wholesaler = dbRepository.getWholesalerById(input.wholesalerId);
    if (!wholesaler || wholesaler.status !== WholesalerStatus.ACTIVE) throw new Error('Select an active wholesaler.');
    const quantity = roundQuantity(input.quantity);
    const sellingRate = roundCurrency(input.sellingRate);
    const amountPaid = roundCurrency(input.amountPaid);
    if (quantity <= 0) throw new Error('Rice quantity must be greater than zero.');
    if (sellingRate <= 0) throw new Error('Wholesale selling rate must be greater than zero.');
    const saleValue = roundCurrency(quantity * sellingRate);
    if (amountPaid < 0 || amountPaid > saleValue) throw new Error('Amount paid must be between zero and the sale value.');
    const rice = InventoryService.getItemById(InventoryItemCode.RICE);
    if (!rice) throw new Error('Rice inventory item is not configured.');
    const stockValidation = InventoryService.validateInventoryMovement(rice.id, quantity, ItemDirection.OUT);
    if (!stockValidation.valid) throw new Error(stockValidation.error);

    const now = new Date().toISOString();
    const amountDue = roundCurrency(saleValue - amountPaid);
    const status = amountDue === 0 ? TransactionStatus.PAID : amountPaid > 0 ? TransactionStatus.PARTIAL : TransactionStatus.DUE;
    const transaction = dbRepository.addTransaction({
      type: TransactionType.RICE_WHOLESALE_SALE,
      status,
      date: now,
      wholesalerId: wholesaler.id,
      wholesalerName: wholesaler.name,
      wholesalerCode: wholesaler.wholesalerCode,
      grossAmount: saleValue,
      discountAmount: 0,
      netAmount: saleValue,
      paidAmount: amountPaid,
      balanceDelta: amountDue,
      settlementDirection: amountDue > 0 ? 'CUSTOMER_PAYS' : 'SETTLED',
      paymentStatus: status === TransactionStatus.PAID ? 'PAID' : status === TransactionStatus.PARTIAL ? 'PARTIAL' : 'PENDING',
      items: [{ id: `item-wholesale-${Date.now()}`, transactionId: '', itemType: ItemType.RICE, direction: ItemDirection.OUT, grainType: GrainType.RATION_RICE, quantity, unit: GrainUnit.KG, ratePerUnit: sellingRate, totalAmount: saleValue, notes: 'Rice wholesale sale' }],
      notes: input.notes,
      description: `${quantity} kg rice sold to ${wholesaler.name} @ ₹${sellingRate}/kg`,
      createdById: actor.id,
      createdByName: actor.name,
    });

    try {
      RiceProfitService.finalizeSaleProfit(transaction);
    } catch (error) {
      dbRepository.removeTransaction(transaction.id);
      throw error;
    }

    if (input.rateOverrideReason?.trim()) {
      AuditService.log({ action: AuditAction.WHOLESALE_RATE_OVERRIDE, entityType: 'TRANSACTION', entityId: transaction.id, performedById: actor.id, performedByName: actor.name, reason: input.rateOverrideReason.trim(), newState: { sellingRate } });
    }
    AuditService.log({ action: AuditAction.RICE_WHOLESALE_SALE_CREATED, entityType: 'TRANSACTION', entityId: transaction.id, entityReference: transaction.transactionNumber, performedById: actor.id, performedByName: actor.name, newState: { wholesalerId: wholesaler.id, quantity, sellingRate, saleValue, amountPaid, amountDue } });
    return { transaction, wholesaler, quantity, sellingRate, saleValue, amountPaid, amountDue };
  }
}