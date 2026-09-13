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

console.log('BAL BEFORE', LedgerService.calculateCustomerBalances(cust.id));
console.log('LEDGER BEFORE', dbRepository.getCustomerLedgerEntries(cust.id));
await TransactionService.reverseTransaction(res.transaction.id, 'reason', ownerActor);
console.log('BAL AFTER', LedgerService.calculateCustomerBalances(cust.id));
console.log('LEDGER AFTER', dbRepository.getCustomerLedgerEntries(cust.id));
console.log('ORIG', dbRepository.getTransactionById(res.transaction.id));
console.log('ALL TX', dbRepository.getTransactions().filter(t => t.customerId === cust.id));
