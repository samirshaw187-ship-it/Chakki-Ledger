import assert from 'node:assert/strict';
import { dbRepository } from '../../db/in-memory-db';
import { InventoryService } from '../inventory.service';
import { RiceTradingService } from '../rice-trading.service';
import {
  InventoryItemCode,
  UserRole,
  Transaction,
  TransactionType,
  TransactionStatus,
  ItemType,
  GrainType,
  GrainUnit,
  CustomerStatus,
  ItemDirection,
} from '../../types';

// Set up test owner locally
const owner = dbRepository.addUser({
  name: 'Test Owner',
  role: UserRole.OWNER,
  phone: '9988776655',
  isActive: true,
  approvalStatus: 'APPROVED',
});

const testCustomer = dbRepository.addCustomer({
  customerCode: 'CUST-00001',
  name: 'Rice Seller Customer',
  phone: '9876543210',
  currentDueAmount: 0,
  wheatBalanceKg: 0,
  riceCreditAmount: 0,
  status: CustomerStatus.ACTIVE,
  isActive: true,
});

// Add initial customer rice purchase transaction
const testPurchaseTx: Transaction = {
  id: 'tx-rice-purchase-test',
  transactionNumber: 'TXN-RICE-001',
  customerId: testCustomer.id,
  customerName: testCustomer.name,
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
      id: 'item-rice-p1',
      transactionId: 'tx-rice-purchase-test',
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
dbRepository.saveTransaction(testPurchaseTx);

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