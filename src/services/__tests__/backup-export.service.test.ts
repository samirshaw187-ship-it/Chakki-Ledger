import assert from 'node:assert/strict';
import { dbRepository } from '../../db/in-memory-db';
import { BackupExportService } from '../backup-export.service';
import { UserRole, TransactionType, TransactionStatus, GrainUnit, CustomerStatus, Transaction } from '../../types';

// Set up test data fixtures
const owner = dbRepository.addUser({
  name: 'Test Owner',
  role: UserRole.OWNER,
  phone: '9988776655',
  isActive: true,
  approvalStatus: 'APPROVED',
});

const testCustomer = dbRepository.addCustomer({
  customerCode: 'CUST-00001',
  name: 'Test Customer',
  phone: '9876543210',
  currentDueAmount: 0,
  wheatBalanceKg: 0,
  riceCreditAmount: 0,
  status: CustomerStatus.ACTIVE,
  isActive: true,
});

const testTransaction: Transaction = {
  id: 'tx-backup-test',
  transactionNumber: 'TXN-BACKUP-001',
  customerId: testCustomer.id,
  customerName: testCustomer.name,
  date: new Date().toISOString(),
  type: TransactionType.WHEAT_DEPOSIT,
  grossAmount: 250,
  discountAmount: 0,
  netAmount: 250,
  paidAmount: 250,
  balanceDelta: 0,
  paymentStatus: 'PAID',
  status: TransactionStatus.COMPLETED,
  createdById: owner.id,
  items: [
    {
      id: 'item-1',
      transactionId: 'tx-backup-test',
      quantity: 10,
      unit: GrainUnit.KG,
      ratePerUnit: 25,
      totalAmount: 250,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
dbRepository.saveTransaction(testTransaction);

const customerCount = dbRepository.getCustomers().length;
const transactionCount = dbRepository.getTransactions().length;
const firstTransaction = dbRepository.getTransactions()[0];
const historicalRate = firstTransaction?.items[0]?.ratePerUnit;

const customerExport = BackupExportService.generateExport({ kind: 'CUSTOMERS', format: 'CSV', actor: owner });
assert.match(String(customerExport.content), /customerId,name,phone/);
assert.equal(customerExport.rowCount, customerCount);

const transactionExport = BackupExportService.generateExport({ kind: 'TRANSACTIONS', format: 'CSV', actor: owner });
assert.ok(String(transactionExport.content).includes(firstTransaction.transactionNumber));
assert.ok(String(transactionExport.content).includes(String(historicalRate)));

await BackupExportService.createBackup(owner);
const backupStatus = BackupExportService.getBackupStatus();
assert.equal(backupStatus.status, 'SUCCESS');
assert.ok(backupStatus.lastSuccessfulBackup);
assert.equal(dbRepository.getCustomers().length, customerCount);
assert.equal(dbRepository.getTransactions().length, transactionCount);

assert.throws(
  () => BackupExportService.generateExport({ kind: 'RICE_PROFIT', format: 'CSV', actor: owner }),
  /permission/i,
);

console.log('backup-export.service tests passed');
