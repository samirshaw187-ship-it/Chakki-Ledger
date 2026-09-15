import test from 'node:test';
import assert from 'node:assert/strict';
import { dbRepository } from '../../db/in-memory-db';
import { TransactionService } from '../transaction.service';
import { LedgerService } from '../ledger.service';
import { TransactionType, LedgerEntryType, LedgerDirection, LedgerStatus, UserRole, GrainType, ItemType, ItemDirection } from '../../types';

test('Data Integrity: Adding 25 kg wheat deposit produces strictly 25 kg balance without duplicate runaway inflation', async () => {
  // Setup clean customer
  const customer = dbRepository.addCustomer({
    name: 'Madan Test',
    phone: '9876500001',
    status: 'ACTIVE' as any,
    isActive: true,
    currentDueAmount: 0,
    wheatBalanceKg: 0,
    riceCreditAmount: 0,
    updatedAt: new Date().toISOString(),
  }, false);

  const actor = {
    id: 'user-test-owner',
    name: 'Owner Test',
    role: UserRole.OWNER,
  };

  // 1. Create a 25 kg Wheat Deposit transaction
  const result = await TransactionService.createTransaction(
    {
      type: TransactionType.WHEAT_DEPOSIT,
      customerId: customer.id,
      items: [
        {
          itemType: ItemType.WHEAT,
          direction: ItemDirection.IN,
          grainType: GrainType.WHEAT,
          quantity: 25,
          unit: 'KG',
          ratePerUnit: 0,
          totalAmount: 0,
        },
      ],
      description: 'Deposit 25 kg Wheat',
      notes: 'Initial test deposit',
    },
    actor
  );

  assert.equal(result.success, true);
  assert.ok(result.transaction);

  // 2. Check balance calculation immediately
  const initialBalance = LedgerService.calculateCustomerBalances(customer.id);
  assert.equal(initialBalance.wheatBalanceKg, 25, 'Customer wheat balance must be exactly 25 kg');

  // 3. Simulate remote echoes or duplicated calls (the bug that previously caused 16200, 150200)
  const existingEntries = dbRepository.getCustomerLedgerEntries(customer.id);
  assert.equal(existingEntries.length, 1, 'Should have exactly 1 ledger entry for the deposit');

  const firstEntry = existingEntries[0];

  // Try to add the identical entry 5 times
  for (let i = 0; i < 5; i++) {
    dbRepository.addLedgerEntry(firstEntry, false);
  }

  // Also try to add identical content with a slightly different ID (simulating remote echo doc IDs)
  for (let i = 0; i < 5; i++) {
    dbRepository.addLedgerEntry({
      ...firstEntry,
      id: `led-fake-echo-${i}`,
    }, false);
  }

  // 4. Verify that deduplication guard blocked duplicate insertions
  const entriesAfterSimulatedEcho = dbRepository.getCustomerLedgerEntries(customer.id);
  assert.equal(
    entriesAfterSimulatedEcho.length,
    1,
    'Deduplication guard must block duplicate entries for the same transaction'
  );

  // 5. Verify that customer balance remains strictly 25 kg
  const balanceAfter = LedgerService.calculateCustomerBalances(customer.id);
  assert.equal(
    balanceAfter.wheatBalanceKg,
    25,
    'Customer wheat balance must remain 25 kg and NEVER inflate to 16,200 or 150,200'
  );
});
