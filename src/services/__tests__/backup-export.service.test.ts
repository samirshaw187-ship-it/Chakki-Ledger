import assert from 'node:assert/strict';
import { dbRepository } from '../../db/in-memory-db';
import { SEED_USERS } from '../../db/seed-data';
import { BackupExportService } from '../backup-export.service';

const owner = SEED_USERS.find((user) => user.role === 'OWNER')!;
const unauthorizedUser = { id: 'usr-unauth', name: 'Unauthorized', role: 'UNAUTHORIZED' as any, email: 'unauth@gmail.com', isActive: true } as any;

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
  () => BackupExportService.generateExport({ kind: 'RICE_PROFIT', format: 'CSV', actor: unauthorizedUser }),
  /permission/i,
);

console.log('backup-export.service tests passed');
