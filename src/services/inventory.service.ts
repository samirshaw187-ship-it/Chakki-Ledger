import { dbRepository } from '../db/in-memory-db';
import { AuditService } from './audit.service';
import {
  AuditAction,
  AuditLogEntry,
  GrainType,
  InventoryItem,
  InventoryItemCode,
  InventoryMovement,
  InventoryMovementType,
  ItemDirection,
  ItemType,
  Transaction,
  TransactionStatus,
  TransactionType,
  User,
  UserRole,
} from '../types';
import { roundQuantity } from '../utils/precision';
import { hasPermission, Permission } from '../modules/auth/permissions';

export interface InventoryStockSnapshot {
  item: InventoryItem;
  currentStock: number;
  todayIn: number;
  todayOut: number;
  weekIn: number;
  weekOut: number;
  status: 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK';
}

export interface InventoryMovementView extends InventoryMovement {
  itemName: string;
  itemCode: InventoryItemCode;
  transactionNumber?: string;
}

const round = (value: number) => roundQuantity(value || 0);

function itemCodeFromTransactionItem(item: Transaction['items'][number]): InventoryItemCode | undefined {
  const grain = String(item.grainType || '').toUpperCase();
  const itemType = String(item.itemType || '').toUpperCase();
  const atta = String(item.attaType || '').toUpperCase();
  if (grain === GrainType.WHEAT || itemType === ItemType.WHEAT) return InventoryItemCode.WHEAT;
  if (grain === GrainType.CHALI_ATTA || atta === 'CHALI_ATTA' || (itemType === ItemType.ATTA && grain.includes('CHALI'))) return InventoryItemCode.CHALI_ATTA;
  if (grain === GrainType.ROLL_ATTA || atta === 'ROLL_ATTA' || (itemType === ItemType.ATTA && grain.includes('ROLL'))) return InventoryItemCode.ROLL_ATTA;
  if (grain === GrainType.RATION_RICE || itemType === ItemType.RICE || itemType === 'RATION_RICE') return InventoryItemCode.RICE;
  return undefined;
}

function movementTypeForTransaction(transaction: Transaction): InventoryMovementType {
  if (transaction.type === TransactionType.REVERSAL || transaction.status === TransactionStatus.REVERSED) return InventoryMovementType.REVERSAL;
  if (transaction.type === TransactionType.CORRECTION) return InventoryMovementType.ADJUSTMENT;
  if (transaction.type === TransactionType.WHEAT_ATTA_EXCHANGE) return InventoryMovementType.EXCHANGE;
  if (transaction.type === TransactionType.RICE_ATTA_SETTLEMENT) return InventoryMovementType.SETTLEMENT;
  if (transaction.type === TransactionType.RICE_WHOLESALE_SALE) return InventoryMovementType.SALE;
  if (transaction.type === TransactionType.RICE_PURCHASE || transaction.type === TransactionType.RICE_CASH_SETTLEMENT || transaction.type === TransactionType.WHEAT_CASH_SETTLEMENT) return InventoryMovementType.PURCHASE;
  if (transaction.type === TransactionType.ATTA_PURCHASE) return InventoryMovementType.SALE;
  return InventoryMovementType.ADJUSTMENT;
}

function isValidTransaction(transaction: Transaction): boolean {
  return transaction.status !== TransactionStatus.DRAFT && transaction.status !== TransactionStatus.CANCELLED;
}

function directionFromStoredOrBusinessContext(transaction: Transaction, item: Transaction['items'][number], code: InventoryItemCode): ItemDirection {
  if (item.direction === ItemDirection.OUT) return ItemDirection.OUT;
  if (item.direction === ItemDirection.IN) return ItemDirection.IN;
  if (code === InventoryItemCode.CHALI_ATTA || code === InventoryItemCode.ROLL_ATTA) {
    if ([TransactionType.WHEAT_ATTA_EXCHANGE, TransactionType.RICE_ATTA_SETTLEMENT, TransactionType.ATTA_PURCHASE].includes(transaction.type)) return ItemDirection.OUT;
  }
  if (code === InventoryItemCode.WHEAT || code === InventoryItemCode.RICE) {
    if ([TransactionType.WHEAT_DEPOSIT, TransactionType.WHEAT_ATTA_EXCHANGE, TransactionType.WHEAT_CASH_SETTLEMENT, TransactionType.RICE_PURCHASE, TransactionType.RICE_ATTA_SETTLEMENT, TransactionType.RICE_CASH_SETTLEMENT].includes(transaction.type)) return ItemDirection.IN;
  }
  return ItemDirection.IN;
}

export class InventoryService {
  public static getInventoryItems(): InventoryItem[] {
    return dbRepository.getInventoryItems().filter((item) => item.isActive);
  }

  public static getItemById(idOrCode: string): InventoryItem | undefined {
    return dbRepository.getInventoryItemById(idOrCode);
  }

  public static getTransactionMovements(): InventoryMovementView[] {
    const items = dbRepository.getInventoryItems();
    const itemMap = new Map(items.map((item) => [item.code, item]));
    const movements: InventoryMovementView[] = [];

    for (const transaction of dbRepository.getTransactions()) {
      if (!isValidTransaction(transaction)) continue;
      const movementType = movementTypeForTransaction(transaction);
      for (const transactionItem of transaction.items || []) {
        const code = itemCodeFromTransactionItem(transactionItem);
        if (!code || transactionItem.quantity <= 0) continue;
        const inventoryItem = itemMap.get(code);
        if (!inventoryItem) continue;
        movements.push({
          id: `transaction-${transaction.id}-${transactionItem.id}`,
          inventoryItemId: inventoryItem.id,
          transactionId: transaction.id,
          movementType,
          quantity: round(transactionItem.quantity),
          direction: directionFromStoredOrBusinessContext(transaction, transactionItem, code),
          referenceType: 'TRANSACTION',
          referenceId: transaction.id,
          reason: transaction.notes || transaction.description,
          createdById: transaction.createdById,
          createdByName: transaction.createdByName,
          createdAt: transaction.createdAt || transaction.date,
          itemName: inventoryItem.name,
          itemCode: inventoryItem.code,
          transactionNumber: transaction.transactionNumber,
        });
      }
    }

    return movements;
  }

  public static getStockMovementHistory(itemId?: string): InventoryMovementView[] {
    const stored = dbRepository.getInventoryMovements().map((movement) => {
      const item = dbRepository.getInventoryItemById(movement.inventoryItemId);
      return { ...movement, itemName: item?.name || 'Unknown item', itemCode: item?.code || InventoryItemCode.WHEAT };
    });
    const transactionMovements = this.getTransactionMovements();
    return [...stored, ...transactionMovements]
      .filter((movement) => !itemId || movement.inventoryItemId === itemId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public static calculateStockBalance(itemId: string): number {
    return round(this.getStockMovementHistory(itemId).reduce((balance, movement) => (
      balance + (movement.direction === ItemDirection.IN ? movement.quantity : -movement.quantity)
    ), 0));
  }

  public static getCurrentStock(itemId: string): number {
    return this.calculateStockBalance(itemId);
  }

  public static getInventorySummary(now = new Date()): InventoryStockSnapshot[] {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - (day === 0 ? 6 : day - 1));
    startOfWeek.setHours(0, 0, 0, 0);
    const dayMs = startOfDay;
    const weekMs = startOfWeek.getTime();

    return this.getInventoryItems().map((item) => {
      const movements = this.getStockMovementHistory(item.id);
      const currentStock = this.calculateStockBalance(item.id);
      const inSince = (since: number) => movements.filter((movement) => new Date(movement.createdAt).getTime() >= since && movement.direction === ItemDirection.IN).reduce((sum, movement) => sum + movement.quantity, 0);
      const outSince = (since: number) => movements.filter((movement) => new Date(movement.createdAt).getTime() >= since && movement.direction === ItemDirection.OUT).reduce((sum, movement) => sum + movement.quantity, 0);
      return {
        item,
        currentStock,
        todayIn: round(inSince(dayMs)),
        todayOut: round(outSince(dayMs)),
        weekIn: round(inSince(weekMs)),
        weekOut: round(outSince(weekMs)),
        status: currentStock <= 0 ? 'OUT OF STOCK' : currentStock <= item.reorderLevel ? 'LOW STOCK' : 'IN STOCK',
      };
    });
  }

  public static getLowStockItems(): InventoryStockSnapshot[] {
    return this.getInventorySummary().filter((snapshot) => snapshot.status !== 'IN STOCK');
  }

  public static validateInventoryMovement(itemId: string, quantity: number, direction: ItemDirection): { valid: boolean; error?: string } {
    if (!Number.isFinite(quantity) || quantity <= 0) return { valid: false, error: 'Quantity must be greater than zero.' };
    if (direction === ItemDirection.OUT) {
      const current = this.getCurrentStock(itemId);
      if (quantity > current) return { valid: false, error: `Insufficient stock. Current: ${current} kg. Requested: ${quantity} kg. Available: ${current} kg.` };
    }
    return { valid: true };
  }

  public static createInventoryAdjustment(input: { itemId: string; quantity: number; direction: ItemDirection; reason: string }, actor: User): InventoryMovement {
    if (!hasPermission(actor.role, Permission.ADJUST_INVENTORY)) throw new Error('You do not have permission to adjust inventory.');
    const item = dbRepository.getInventoryItemById(input.itemId);
    if (!item) throw new Error('Inventory item not found.');
    if (!input.reason || input.reason.trim().length < 4) throw new Error('A reason of at least 4 characters is required.');
    const validation = this.validateInventoryMovement(item.id, input.quantity, input.direction);
    if (!validation.valid) throw new Error(validation.error);
    const movement = dbRepository.addInventoryMovement({
      inventoryItemId: item.id,
      movementType: InventoryMovementType.ADJUSTMENT,
      quantity: round(input.quantity),
      direction: input.direction,
      referenceType: 'ADJUSTMENT',
      referenceId: `adjustment-${Date.now()}`,
      reason: input.reason.trim(),
      createdById: actor.id,
      createdByName: actor.name,
    });
    AuditService.log({
      action: AuditAction.INVENTORY_ADJUSTED,
      entityType: 'INVENTORY_MOVEMENT',
      entityId: movement.id,
      performedById: actor.id,
      performedByName: actor.name,
      reason: input.reason.trim(),
      newState: { item: item.code, quantity: movement.quantity, direction: movement.direction },
    });
    return movement;
  }

  public static createOpeningStock(itemId: string, quantity: number, actor: User): InventoryMovement {
    if (!hasPermission(actor.role, Permission.ADJUST_INVENTORY)) throw new Error('You do not have permission to create opening stock.');
    const item = dbRepository.getInventoryItemById(itemId);
    if (!item) throw new Error('Inventory item not found.');
    const alreadyInitialized = dbRepository.getInventoryMovements().some((movement) => movement.inventoryItemId === item.id && movement.movementType === InventoryMovementType.OPENING_STOCK);
    if (alreadyInitialized) throw new Error('Opening stock has already been initialized for this item.');
    if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Opening stock must be zero or greater.');
    const movement = dbRepository.addInventoryMovement({
      inventoryItemId: item.id,
      movementType: InventoryMovementType.OPENING_STOCK,
      quantity: round(quantity),
      direction: ItemDirection.IN,
      referenceType: 'OPENING_STOCK',
      referenceId: `opening-${item.id}`,
      reason: 'Initial opening stock',
      createdById: actor.id,
      createdByName: actor.name,
    });
    AuditService.log({ action: AuditAction.OPENING_STOCK_CREATED, entityType: 'INVENTORY_ITEM', entityId: item.id, performedById: actor.id, performedByName: actor.name, reason: 'Initial opening stock', newState: { quantity: movement.quantity } });
    return movement;
  }

  public static updateReorderLevel(itemId: string, reorderLevel: number, actor: User): InventoryItem {
    if (!hasPermission(actor.role, Permission.MANAGE_INVENTORY)) throw new Error('You do not have permission to change inventory settings.');
    if (!Number.isFinite(reorderLevel) || reorderLevel < 0) throw new Error('Reorder level must be zero or greater.');
    const item = dbRepository.updateInventoryItem(itemId, { reorderLevel });
    if (!item) throw new Error('Inventory item not found.');
    AuditService.log({ action: AuditAction.INVENTORY_SETTING_CHANGED, entityType: 'INVENTORY_ITEM', entityId: item.id, performedById: actor.id, performedByName: actor.name, newState: { reorderLevel } });
    return item;
  }
}