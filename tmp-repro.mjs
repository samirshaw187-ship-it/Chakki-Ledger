import { dbRepository } from './src/db/in-memory-db.ts';
import { TransactionService } from './src/services/transaction.service.ts';
import { LedgerService } from './src/services/ledger.service.ts';
import { CustomerStatus, GrainType, ItemDirection, TransactionType, UserRole } from './src/types/index.ts';

const ownerActor = { id: 'u1', name: 'Owner', role: UserRole.OWNER };
const cust = dbRepository.addCustomer({
  customerCode: 'CUST-TEST-A',
  name: 'Customer A',
  status: CustomerStatus.ACTIVE,
  isActive: true,
  currentDueAmount: 0,
  wheatBalanceKg: 0,
  riceCreditAmount: 0,
});

const res = await TransactionService.createTransaction({
  type: TransactionType.WHEAT_DEPOSIT,
  customerId: cust.id,
  items: [{
    itemType: 'WHEAT',
    grainType: GrainType.WHEAT,
    direction: ItemDirection.IN,
    quantity: 50,
    unit: 'KG',
    ratePerUnit: 0,
    totalAmount: 0,
  }],
  notes: 'Booked mistakenly',
}, ownerActor);

console.log('before', JSON.stringify(LedgerService.calculateCustomerBalances(cust.id), null, 2));
console.log('entries before', JSON.stringify(dbRepository.getCustomerLedgerEntries(cust.id), null, 2));
await TransactionService.reverseTransaction(res.transaction.id, 'reason', ownerActor);
console.log('after', JSON.stringify(LedgerService.calculateCustomerBalances(cust.id), null, 2));
console.log('entries after', JSON.stringify(dbRepository.getCustomerLedgerEntries(cust.id), null, 2));
console.log('customer record', JSON.stringify(dbRepository.getCustomerById(cust.id), null, 2));
