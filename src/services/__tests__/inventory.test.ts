import assert from 'node:assert/strict';
import { dbRepository } from '../../db/in-memory-db';
import { InventoryService } from '../inventory.service';
import { InventoryItemCode, ItemDirection, UserRole } from '../../types';

const owner = dbRepository.getUsers().find((user) => user.role === UserRole.OWNER);
assert.ok(owner, 'Seed owner is required for inventory tests');

const rice = InventoryService.getItemById(InventoryItemCode.RICE);
const wheat = InventoryService.getItemById(InventoryItemCode.WHEAT);
const rollAtta = InventoryService.getItemById(InventoryItemCode.ROLL_ATTA);
assert.ok(rice && wheat && rollAtta, 'Core inventory items must exist');

const riceMovements = InventoryService.getStockMovementHistory(rice.id);
assert.ok(riceMovements.some((movement) => movement.transactionNumber === 'TXN-2026-0002' && movement.direction === ItemDirection.IN), 'Rice transaction must create a traceable stock-in movement');

const wheatMovements = InventoryService.getStockMovementHistory(wheat.id);
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
InventoryService.createOpeningStock(openingItem.id, 15.5, owner);
assert.equal(InventoryService.getCurrentStock(openingItem.id), 15.5, 'Decimal opening stock must be preserved');
assert.throws(() => InventoryService.createOpeningStock(openingItem.id, 1, owner), /already been initialized/);

const lowStock = InventoryService.getLowStockItems();
assert.ok(lowStock.some((snapshot) => snapshot.item.id === openingItem.id), 'Stock at or below reorder level must be reported');

console.log('Inventory tests passed');
