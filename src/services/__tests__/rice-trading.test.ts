import assert from 'node:assert/strict';
import { dbRepository } from '../../db/in-memory-db';
import { InventoryService } from '../inventory.service';
import { RiceTradingService } from '../rice-trading.service';
import { InventoryItemCode, UserRole } from '../../types';

const owner = dbRepository.getUsers().find((user) => user.role === UserRole.OWNER);
assert.ok(owner, 'Seed owner is required');

const purchases = RiceTradingService.getRicePurchases();
assert.ok(purchases.some((purchase) => purchase.purchaseRate === 21 && purchase.totalValue === 420), 'Rice purchase history must preserve stored rate and value');

const wholesaler = RiceTradingService.createWholesaler({ name: 'Test Rice Buyer', companyName: 'Test Traders' }, owner);
assert.match(wholesaler.wholesalerCode, /^WHOLE-\d{5}$/);

const rice = InventoryService.getItemById(InventoryItemCode.RICE);
assert.ok(rice);
const before = InventoryService.getCurrentStock(rice.id);
assert.ok(before >= 10, 'Seed rice stock must support the sale test');

const sale = await RiceTradingService.createWholesaleSale({ wholesalerId: wholesaler.id, quantity: 10, sellingRate: 31, amountPaid: 200 }, owner);
assert.equal(sale.saleValue, 310);
assert.equal(sale.amountDue, 110);
assert.equal(sale.transaction.paymentStatus, 'PARTIAL');
assert.equal(sale.transaction.items[0].ratePerUnit, 31);
assert.equal(InventoryService.getCurrentStock(rice.id), before - 10, 'Wholesale sale must reduce rice inventory');

await assert.rejects(
  () => RiceTradingService.createWholesaleSale({ wholesalerId: wholesaler.id, quantity: before + 1, sellingRate: 31, amountPaid: 0 }, owner),
  /Insufficient stock/
);

console.log('Rice trading tests passed');