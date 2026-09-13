import { dbRepository } from './src/db/in-memory-db.ts';
import { TransactionService } from './src/services/transaction.service.ts';
import { LedgerService } from './src/services/ledger.service.ts';
import { CustomerStatus, GrainType, ItemDirection, TransactionType, UserRole } from './src/types/index.ts';

const ownerActor = { id: 'u1', name: 'Owner', role: UserRole.OWNER };

const custA = dbRepository.addCustomer({
  customerCode: 'CUST-T005A',
  name: 'Customer A',
  status: CustomerStatus.ACTIVE,
  isActive: true,
  currentDueAmount: 0,
  wheatBalanceKg: 0,
  riceCreditAmount: 0,
});

const custB = dbRepository.addCustomer({
  customerCode: 'CUST-T005B',
  name: 'Customer B',
  status: CustomerStatus.ACTIVE,
  isActive: true,
  currentDueAmount: 0,
  wheatBalanceKg: 0,
  riceCreditAmount: 0,
});

const resA = await TransactionService.createTransaction({
  type: TransactionType.WHEAT_DEPOSIT,
  customerId: custA.id,
  items: [{
    itemType: 'WHEAT',
    grainType: GrainType.WHEAT,
    direction: ItemDirection.IN,
    quantity: 50,
    unit: 'KG',
    ratePerUnit: 0,
    totalAmount: 0,
  }],
  notes: 'Booked mistakenly for Customer A',
}, ownerActor);

await TransactionService.reverseTransaction(resA.transaction.id, 'Mistakenly booked for Customer A, belongs to Customer B', ownerActor);

const resB = await TransactionService.createTransaction({
  type: TransactionType.WHEAT_DEPOSIT,
  customerId: custB.id,
  items: [{
    itemType: 'WHEAT',
    grainType: GrainType.WHEAT,
    direction: ItemDirection.IN,
    quantity: 50,
    unit: 'KG',
    ratePerUnit: 0,
    totalAmount: 0,
  }],
  notes: 'Transferred from erroneous ticket',
}, ownerActor);

console.log('A balance', LedgerService.calculateCustomerBalances(custA.id));
console.log('B balance', LedgerService.calculateCustomerBalances(custB.id));
console.log('A entries', dbRepository.getCustomerLedgerEntries(custA.id));
console.log('B entries', dbRepository.getCustomerLedgerEntries(custB.id));
