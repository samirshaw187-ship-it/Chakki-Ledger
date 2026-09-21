import assert from 'node:assert/strict';
import { dbRepository } from '../../db/in-memory-db';
import { InventoryService } from '../inventory.service';
import { InventoryItemCode, ItemDirection, UserRole, GrainUnit, Transaction, TransactionType, TransactionStatus, GrainType, ItemType } from '../../types';

// Set up test owner and transactions locally
const owner = dbRepository.addUser({
  name: 'Test Owner',
  role: UserRole.OWNER,
  phone: '9988776655',
  isActive: true,
  approvalStatus: 'APPROVED',
});

const testTx1: Transaction = {
  id: 'test-tx-inv-1',
  transactionNumber: 'TXN-2026-0001',
  customerId: 'c1',
  customerName: 'Cust 1',
  date: new Date().toISOString(),
  type: TransactionType.WHEAT_ATTA_EXCHANGE,
  grossAmount: 50,
  discountAmount: 0,
  netAmount: 50,
  paidAmount: 50,
  balanceDelta: 0,
  paymentStatus: 'PAID',
  status: TransactionStatus.COMPLETED,
  createdById: owner.id,
  items: [
    {
      id: 'item-atta-1',
      transactionId: 'test-tx-inv-1',
      grainType: GrainType.ROLL_ATTA,
      itemType: ItemType.ATTA,
      quantity: 5,
      unit: GrainUnit.KG,
      ratePerUnit: 10,
      totalAmount: 50,
      direction: ItemDirection.OUT,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
dbRepository.saveTransaction(testTx1);

const testTx2: Transaction = {
  id: 'test-tx-inv-2',
  transactionNumber: 'TXN-2026-0002',
  customerId: 'c1',
  customerName: 'Cust 1',
  date: new Date().toISOString(),
  type: TransactionType.RICE_PURCHASE,
  grossAmount: 420,
  discountAmount: 0,
  netAmount: 420,
  paidAmount: 420,
  balanceDelta: 0,
  paymentStatus: 'PAID',
  status: TransactionStatus.COMPLETED,
  createdById: owner.id,
  items: [
    {
      id: 'item-rice-1',
      transactionId: 'test-tx-inv-2',
      grainType: GrainType.RATION_RICE,
      itemType: ItemType.RICE,
      quantity: 20,
      unit: GrainUnit.KG,
      ratePerUnit: 21,
      totalAmount: 420,
      direction: ItemDirection.IN,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
dbRepository.saveTransaction(testTx2);

const rice = InventoryService.getItemById(InventoryItemCode.RICE);
const wheat = InventoryService.getItemById(InventoryItemCode.WHEAT);
const rollAtta = InventoryService.getItemById(InventoryItemCode.ROLL_ATTA);
assert.ok(rice && wheat && rollAtta, 'Core inventory items must exist');

const riceMovements = InventoryService.getStockMovementHistory(rice.id);
assert.ok(riceMovements.some((movement) => movement.transactionNumber === 'TXN-2026-0002' && movement.direction === ItemDirection.IN), 'Rice transaction must create a traceable stock-in movement');

const wheatMovements = InventoryService.getStockMovementHistory(wheat.id).filter((m) => m.referenceType === 'TRANSACTION');
assert.equal(wheatMovements.length, 0, 'The seeded exchange has no stored wheat line item, so no wheat quantity may be invented');

const attaMovements = InventoryService.getStockMovementHistory(rollAtta.id);
assert.ok(attaMovements.some((movement) => movement.transactionNumber === 'TXN-2026-0001' && movement.direction === ItemDirection.OUT), 'Atta exchange must use the stored atta quantity for stock-out');

const before = InventoryService.getCurrentStock(rice.id);
InventoryService.createInventoryAdjustment({ itemId: rice.id, quantity: 4, direction: ItemDirection.IN, reason: 'Inventory test receipt' }, owner);
assert.equal(InventoryService.getCurrentStock(rice.id), before + 4, 'Stock adjustment must change the derived balance');

assert.throws(
  () => InventoryService.createInventoryAdjustment({ itemId: rice.id, quantity: before + 100, direction: ItemDirection.OUT, reason: 'Too much stock out' }, owner),
  /Insufficient stock/
);

const openingItem = InventoryService.getItemById(InventoryItemCode.CHALI_ATTA);
assert.ok(openingItem);
InventoryService.createOpeningStock(openingItem.id, 50, owner);
assert.throws(() => InventoryService.createOpeningStock(openingItem.id, 1, owner), /already been initialized/);

InventoryService.createInventoryAdjustment({ itemId: openingItem.id, quantity: 40, direction: ItemDirection.OUT, reason: 'Test low stock alert' }, owner);
const lowStock = InventoryService.getLowStockItems();
assert.ok(lowStock.some((snapshot) => snapshot.item.id === openingItem.id), 'Stock at or below reorder level must be reported');

console.log('Inventory tests passed');
