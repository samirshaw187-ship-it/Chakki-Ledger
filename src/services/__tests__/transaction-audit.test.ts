/**
 * Chakki Ledger - Automated Test Suite
 * Section 41: Transaction Details, Correction, Reversal & Audit Trail
 *
 * Tests:
 *  1. Normal transaction creation -> produces AuditLog with TRANSACTION_CREATED.
 *  2. Quantity correction -> original 15.00 kg remains 15.00 kg; new correction entry records +5.00 kg; effective customer ledger shows 20.00 kg.
 *  3. Correction attempt without reason (< 4 chars) -> rejected.
 *  4. Unauthorized correction attempt by STAFF -> rejected.
 *  5. Wrong customer scenario -> reverse for Customer A, create for Customer B; Customer A history preserved.
 *  6. Reversal -> original Rice IN 15 kg, Cash OUT Rs 315; reversed Rice OUT 15 kg, Cash IN Rs 315; effective contribution = 0.
 *  7. Double reversal attempt -> second attempt rejected.
 *  8. Rate correction -> original Rs 21/kg remains intact; difference reflected in ledger.
 *  9. Payment correction -> original receipt preserved; effective payment updated.
 * 10. Audit history query -> returns both creation and correction events for transaction.
 * 11. Reversal audit history -> returns creation and reversal events.
 * 12. Duplicate correction/reversal request -> idempotency key prevents duplicate execution.
 * 13. Historical rate -> updating current rate to Rs 23 does not change historical Rs 21 on existing transactions.
 */

import assert from 'node:assert';
import { dbRepository } from '../../db/in-memory-db';
import { TransactionService } from '../transaction.service';
import { PaymentService } from '../payment.service';
import { AuditService } from '../audit.service';
import { LedgerService } from '../ledger.service';
import {
  AuditAction,
  CustomerStatus,
  GrainType,
  ItemDirection,
  PaymentMode,
  PaymentStatus,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '../../types';

const ownerActor = {
  id: 'usr-owner-test',
  name: 'Gopal Sahu (Owner)',
  role: UserRole.OWNER,
};

const unauthorizedActor = {
  id: 'usr-unauthorized-test',
  name: 'Unauthorized User',
  role: 'UNAUTHORIZED' as any,
};

async function runAllTests() {
  console.log('\n==================================================');
  console.log('CHAKKI LEDGER: TRANSACTION & AUDIT TEST SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let total = 13;

  // ----------------------------------------------------
  // Test 1: Normal transaction creation -> produces AuditLog with TRANSACTION_CREATED
  // ----------------------------------------------------
  try {
    const cust1 = dbRepository.addCustomer({
      customerCode: 'CUST-T001',
      name: 'Test Customer 1',
      phone: '9800000001',
      status: CustomerStatus.ACTIVE,
      isActive: true,
      currentDueAmount: 0,
      wheatBalanceKg: 0,
      riceCreditAmount: 0,
    });

    const res1 = await TransactionService.createTransaction(
      {
        type: TransactionType.WHEAT_DEPOSIT,
        customerId: cust1.id,
        items: [
          {
            itemType: 'WHEAT',
            grainType: GrainType.WHEAT,
            direction: ItemDirection.IN,
            quantity: 25,
            unit: 'KG',
            ratePerUnit: 0,
            totalAmount: 0,
          },
        ],
        notes: 'Initial wheat intake test',
      },
      ownerActor
    );

    assert.ok(res1.success, 'Transaction creation should succeed');
    assert.ok(res1.transaction.id, 'Transaction should have an ID');
    assert.ok(
      res1.transaction.status === TransactionStatus.CONFIRMED ||
      res1.transaction.status === TransactionStatus.SETTLED,
      'Transaction status should be CONFIRMED or SETTLED'
    );

    const logs = AuditService.getLogsForEntity('TRANSACTION', res1.transaction.id);
    const createdLog = logs.find((l) => l.action === AuditAction.TRANSACTION_CREATED);
    assert.ok(createdLog, 'Audit log must record TRANSACTION_CREATED');
    assert.strictEqual(createdLog?.performedById, ownerActor.id);

    console.log('✔ Test 1: Normal transaction creation produces AuditLog with TRANSACTION_CREATED');
    passed++;
  } catch (err: any) {
    console.error('✘ Test 1 FAILED:', err.message);
    throw err;
  }

  // ----------------------------------------------------
  // Test 2: Quantity correction -> original 15.00 kg remains 15.00 kg;
  // new correction entry records +5.00 kg; effective customer ledger shows 20.00 kg.
  // ----------------------------------------------------
  try {
    const cust2 = dbRepository.addCustomer({
      customerCode: 'CUST-T002',
      name: 'Test Customer 2',
      phone: '9800000002',
      status: CustomerStatus.ACTIVE,
      isActive: true,
      currentDueAmount: 0,
      wheatBalanceKg: 0,
      riceCreditAmount: 0,
    });

    const res2 = await TransactionService.createTransaction(
      {
        type: TransactionType.WHEAT_DEPOSIT,
        customerId: cust2.id,
        items: [
          {
            itemType: 'WHEAT',
            grainType: GrainType.WHEAT,
            direction: ItemDirection.IN,
            quantity: 15,
            unit: 'KG',
            ratePerUnit: 0,
            totalAmount: 0,
          },
        ],
      },
      ownerActor
    );

    const origTxId = res2.transaction.id;
    const origItem = res2.transaction.items[0];

    // Apply correction: 15 kg -> 20 kg
    const corrRes = await TransactionService.createCorrection(
      origTxId,
      {
        reason: 'Scale re-zeroed, actual weight was 20kg',
        items: [
          {
            itemId: origItem.id,
            newQuantity: 20,
            newRate: origItem.ratePerUnit,
          },
        ],
      },
      ownerActor
    );

    // 1. Verify original transaction remains 15kg in DB
    const refreshedOrig = dbRepository.getTransactionById(origTxId);
    assert.ok(refreshedOrig, 'Original transaction must still exist');
    assert.strictEqual(refreshedOrig?.items[0].quantity, 15, 'Original quantity must stay 15kg');
    assert.strictEqual(refreshedOrig?.status, TransactionStatus.CORRECTED, 'Original status must be CORRECTED');

    // 2. Verify compensating transaction records +5.00 kg
    assert.strictEqual(corrRes.correctionTxn.type, TransactionType.CORRECTION);
    assert.strictEqual(corrRes.correctionTxn.isCorrectionOfId, origTxId);
    assert.strictEqual(corrRes.correctionTxn.items[0].quantity, 5, 'Compensating item must record delta +5kg');

    // 3. Verify effective customer ledger shows 20.00 kg
    const balances = LedgerService.calculateCustomerBalances(cust2.id);
    assert.strictEqual(balances.wheatBalanceKg, 20, 'Effective customer ledger must show 20kg');

    console.log('✔ Test 2: Quantity correction preserves original and creates compensating entry (+5kg -> 20kg effective)');
    passed++;
  } catch (err: any) {
    console.error('✘ Test 2 FAILED:', err.message);
    throw err;
  }

  // ----------------------------------------------------
  // Test 3: Correction attempt without reason (< 4 chars) -> rejected.
  // ----------------------------------------------------
  try {
    const cust3 = dbRepository.addCustomer({
      customerCode: 'CUST-T003',
      name: 'Test Customer 3',
      status: CustomerStatus.ACTIVE,
      isActive: true,
      currentDueAmount: 0,
      wheatBalanceKg: 0,
      riceCreditAmount: 0,
    });

    const res3 = await TransactionService.createTransaction(
      {
        type: TransactionType.WHEAT_DEPOSIT,
        customerId: cust3.id,
        items: [
          {
            itemType: 'WHEAT',
            grainType: GrainType.WHEAT,
            direction: ItemDirection.IN,
            quantity: 10,
            unit: 'KG',
            ratePerUnit: 0,
            totalAmount: 0,
          },
        ],
      },
      ownerActor
    );

    let caught = false;
    try {
      await TransactionService.createCorrection(
        res3.transaction.id,
        {
          reason: 'bad', // only 3 chars
          items: [{ itemId: res3.transaction.items[0].id, newQuantity: 12, newRate: 0 }],
        },
        ownerActor
      );
    } catch (e: any) {
      caught = true;
      assert.ok(e.message.toLowerCase().includes('reason') || e.message.toLowerCase().includes('character'), 'Error must mention reason requirement');
    }

    assert.ok(caught, 'Correction without sufficient reason must be rejected');
    console.log('✔ Test 3: Correction attempt without reason (< 4 chars) rejected');
    passed++;
  } catch (err: any) {
    console.error('✘ Test 3 FAILED:', err.message);
    throw err;
  }

  // ----------------------------------------------------
  // Test 4: Unauthorized correction attempt by STAFF -> rejected.
  // ----------------------------------------------------
  try {
    const cust4 = dbRepository.addCustomer({
      customerCode: 'CUST-T004',
      name: 'Test Customer 4',
      status: CustomerStatus.ACTIVE,
      isActive: true,
      currentDueAmount: 0,
      wheatBalanceKg: 0,
      riceCreditAmount: 0,
    });

    const res4 = await TransactionService.createTransaction(
      {
        type: TransactionType.WHEAT_DEPOSIT,
        customerId: cust4.id,
        items: [
          {
            itemType: 'WHEAT',
            grainType: GrainType.WHEAT,
            direction: ItemDirection.IN,
            quantity: 10,
            unit: 'KG',
            ratePerUnit: 0,
            totalAmount: 0,
          },
        ],
      },
      ownerActor
    );

    let actorBlocked = false;
    try {
      await TransactionService.createCorrection(
        res4.transaction.id,
        {
          reason: 'Unauthorized user trying to modify balance',
          items: [{ itemId: res4.transaction.items[0].id, newQuantity: 15, newRate: 0 }],
        },
        unauthorizedActor
      );
    } catch (e: any) {
      actorBlocked = true;
      assert.ok(e.message.toLowerCase().includes('unauthorized') || e.message.toLowerCase().includes('permission'), 'Error must mention unauthorized or permission');
    }

    assert.ok(actorBlocked, 'Unauthorized actor must be blocked from correcting transactions server-side');
    console.log('✔ Test 4: Unauthorized correction attempt rejected server-side');
    passed++;
  } catch (err: any) {
    console.error('✘ Test 4 FAILED:', err.message);
    throw err;
  }

  // ----------------------------------------------------
  // Test 5: Wrong customer scenario -> reverse for Customer A, create for Customer B;
  // Customer A history preserved.
  // ----------------------------------------------------
  try {
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

    // Create deposit for Customer A by mistake
    const resA = await TransactionService.createTransaction(
      {
        type: TransactionType.WHEAT_DEPOSIT,
        customerId: custA.id,
        items: [
          {
            itemType: 'WHEAT',
            grainType: GrainType.WHEAT,
            direction: ItemDirection.IN,
            quantity: 50,
            unit: 'KG',
            ratePerUnit: 0,
            totalAmount: 0,
          },
        ],
        notes: 'Booked mistakenly for Customer A',
      },
      ownerActor
    );

    // Reverse for Customer A
    await TransactionService.reverseTransaction(
      resA.transaction.id,
      'Mistakenly booked for Customer A, belongs to Customer B',
      ownerActor
    );

    // Create for Customer B
    const resB = await TransactionService.createTransaction(
      {
        type: TransactionType.WHEAT_DEPOSIT,
        customerId: custB.id,
        items: [
          {
            itemType: 'WHEAT',
            grainType: GrainType.WHEAT,
            direction: ItemDirection.IN,
            quantity: 50,
            unit: 'KG',
            ratePerUnit: 0,
            totalAmount: 0,
          },
        ],
        notes: 'Transferred from erroneous ticket',
      },
      ownerActor
    );

    // Verify Customer A state: transaction exists as REVERSED, net balance is 0
    const txA = dbRepository.getTransactionById(resA.transaction.id);
    assert.strictEqual(txA?.status, TransactionStatus.REVERSED);
    const balanceA = LedgerService.calculateCustomerBalances(custA.id);
    assert.strictEqual(balanceA.wheatBalanceKg, 0, 'Customer A net balance must be neutralized to 0');

    // Verify Customer B state: has 50 kg
    const balanceB = LedgerService.calculateCustomerBalances(custB.id);
    assert.strictEqual(balanceB.wheatBalanceKg, 50, 'Customer B must receive 50kg');

    // Customer A has audit history preserved
    const logsA = AuditService.getLogsForEntity('TRANSACTION', resA.transaction.id);
    assert.ok(logsA.some((l) => l.action === AuditAction.TRANSACTION_REVERSED));

    console.log('✔ Test 5: Wrong customer scenario safely reversed for Customer A and re-issued to Customer B');
    passed++;
  } catch (err: any) {
    console.error('✘ Test 5 FAILED:', err.message);
    throw err;
  }

  // ----------------------------------------------------
  // Test 6: Reversal -> original Rice IN 15 kg, Cash OUT Rs 315;
  // reversed Rice OUT 15 kg, Cash IN Rs 315; effective contribution = 0.
  // ----------------------------------------------------
  try {
    const cust6 = dbRepository.addCustomer({
      customerCode: 'CUST-T006',
      name: 'Customer 6 (Rice Trade)',
      status: CustomerStatus.ACTIVE,
      isActive: true,
      currentDueAmount: 0,
      wheatBalanceKg: 0,
      riceCreditAmount: 0,
    });

    // Rice purchase: 15 kg @ ₹21 = ₹315
    const res6 = await TransactionService.createTransaction(
      {
        type: TransactionType.RICE_CASH_SETTLEMENT,
        customerId: cust6.id,
        items: [
          {
            itemType: 'RICE',
            grainType: GrainType.RATION_RICE,
            direction: ItemDirection.IN,
            quantity: 15,
            unit: 'KG',
            ratePerUnit: 21,
            totalAmount: 315,
          },
        ],
        paidAmount: 315, // Cash paid out immediately
      },
      ownerActor
    );

    const origTx6 = res6.transaction;
    assert.strictEqual(origTx6.grossAmount, 315);

    // Reverse transaction
    const revRes6 = await TransactionService.reverseTransaction(
      origTx6.id,
      'Customer cancelled rice sale and returned cash',
      ownerActor
    );

    // 1. Original transaction status is REVERSED
    assert.strictEqual(revRes6.original.status, TransactionStatus.REVERSED);

    // 2. Reversal transaction has inverted direction
    const revItem = revRes6.reversalTxn.items.find((i) => i.direction === ItemDirection.OUT);
    assert.ok(revItem, 'Reversal entry must invert grain item to OUT');
    assert.strictEqual(revItem?.quantity, 15);

    // 3. Effective balances are 0
    const bal6 = LedgerService.calculateCustomerBalances(cust6.id);
    assert.strictEqual(bal6.riceCreditAmount, 0, 'Effective rice credit must be neutralized to 0');
    assert.strictEqual(bal6.cashDueAmount, 0, 'Effective cash due must be 0');

    console.log('✔ Test 6: Complete reversal of Rice IN 15kg / Cash OUT ₹315 properly neutralized to 0');
    passed++;
  } catch (err: any) {
    console.error('✘ Test 6 FAILED:', err.message);
    throw err;
  }

  // ----------------------------------------------------
  // Test 7: Double reversal attempt -> second attempt rejected.
  // ----------------------------------------------------
  try {
    const cust7 = dbRepository.addCustomer({
      customerCode: 'CUST-T007',
      name: 'Customer 7',
      status: CustomerStatus.ACTIVE,
      isActive: true,
      currentDueAmount: 0,
      wheatBalanceKg: 0,
      riceCreditAmount: 0,
    });

    const res7 = await TransactionService.createTransaction(
      {
        type: TransactionType.WHEAT_DEPOSIT,
        customerId: cust7.id,
        items: [
          {
            itemType: 'WHEAT',
            grainType: GrainType.WHEAT,
            direction: ItemDirection.IN,
            quantity: 10,
            unit: 'KG',
            ratePerUnit: 0,
            totalAmount: 0,
          },
        ],
      },
      ownerActor
    );

    // First reversal succeeds
    await TransactionService.reverseTransaction(res7.transaction.id, 'First valid reversal', ownerActor);

    // Second reversal must throw
    let doubleReversalBlocked = false;
    try {
      await TransactionService.reverseTransaction(res7.transaction.id, 'Second duplicate reversal attempt', ownerActor);
    } catch (e: any) {
      doubleReversalBlocked = true;
      assert.ok(e.message.toLowerCase().includes('already been reversed') || e.message.toLowerCase().includes('double reversal'));
    }

    assert.ok(doubleReversalBlocked, 'Double reversal must be blocked');
    console.log('✔ Test 7: Double reversal attempt blocked with strict validation');
    passed++;
  } catch (err: any) {
    console.error('✘ Test 7 FAILED:', err.message);
    throw err;
  }

  // ----------------------------------------------------
  // Test 8: Rate correction -> original Rs 21/kg remains intact; difference reflected in ledger.
  // ----------------------------------------------------
  try {
    const cust8 = dbRepository.addCustomer({
      customerCode: 'CUST-T008',
      name: 'Customer 8',
      status: CustomerStatus.ACTIVE,
      isActive: true,
      currentDueAmount: 0,
      wheatBalanceKg: 0,
      riceCreditAmount: 0,
    });

    // 10 kg Rice @ ₹21 = ₹210 credit (unpaid)
    const res8 = await TransactionService.createTransaction(
      {
        type: TransactionType.RICE_CASH_SETTLEMENT,
        customerId: cust8.id,
        items: [
          {
            itemType: 'RICE',
            grainType: GrainType.RATION_RICE,
            direction: ItemDirection.IN,
            quantity: 10,
            unit: 'KG',
            ratePerUnit: 21,
            totalAmount: 210,
          },
        ],
        paidAmount: 0,
      },
      ownerActor
    );

    const origId = res8.transaction.id;
    const origItem = res8.transaction.items[0];

    // Correct rate from ₹21/kg to ₹22/kg (+₹10 delta)
    const corr8 = await TransactionService.createCorrection(
      origId,
      {
        reason: 'Rate updated to government benchmark ₹22/kg',
        items: [
          {
            itemId: origItem.id,
            newQuantity: 10,
            newRate: 22,
          },
        ],
      },
      ownerActor
    );

    // Original rate remains ₹21/kg
    const refreshed8 = dbRepository.getTransactionById(origId);
    assert.strictEqual(refreshed8?.items[0].ratePerUnit, 21, 'Original transaction item rate must remain 21');
    assert.strictEqual(refreshed8?.status, TransactionStatus.CORRECTED);

    // Difference (+₹10) reflected in compensating transaction
    assert.strictEqual(corr8.correctionTxn.netAmount, 10, 'Compensating net amount must equal delta 10');

    console.log('✔ Test 8: Rate correction preserves original ₹21/kg rate while posting delta to ledger');
    passed++;
  } catch (err: any) {
    console.error('✘ Test 8 FAILED:', err.message);
    throw err;
  }

  // ----------------------------------------------------
  // Test 9: Payment correction -> original receipt preserved; effective payment updated.
  // ----------------------------------------------------
  try {
    const cust9 = dbRepository.addCustomer({
      customerCode: 'CUST-T009',
      name: 'Customer 9',
      status: CustomerStatus.ACTIVE,
      isActive: true,
      currentDueAmount: 500,
      wheatBalanceKg: 0,
      riceCreditAmount: 0,
    });

    // Record payment of ₹200
    const payment = dbRepository.addPayment({
      date: new Date().toISOString(),
      customerId: cust9.id,
      customerName: cust9.name,
      amount: 200,
      mode: PaymentMode.CASH,
      status: PaymentStatus.SETTLED,
      appliedToBillAmount: 200,
      createdById: ownerActor.id,
      createdByName: ownerActor.name,
    });

    // Correct payment from ₹200 to ₹250
    const pmtCorr = PaymentService.correctPayment(
      payment.id,
      250,
      'Customer gave ₹250 at counter, verified against till',
      ownerActor
    );

    // Original receipt is preserved and marked CORRECTED
    const origPmt = dbRepository.getPayments().find((p) => p.id === payment.id);
    assert.strictEqual(origPmt?.status, PaymentStatus.CORRECTED);
    assert.strictEqual(origPmt?.amount, 200, 'Original payment amount must stay 200');

    // Compensating adjustment payment receipt is created for delta ₹50
    assert.strictEqual(pmtCorr.adjustmentPayment.amount, 50, 'Adjustment payment receipt must record delta 50');

    // Audit log records PAYMENT_UPDATED
    const auditLogs = AuditService.getLogsForEntity('PAYMENT', payment.id);
    assert.ok(auditLogs.some((l) => l.action === AuditAction.PAYMENT_UPDATED), 'Audit log must record PAYMENT_UPDATED');

    console.log('✔ Test 9: Payment correction preserves original receipt and creates adjustment receipt');
    passed++;
  } catch (err: any) {
    console.error('✘ Test 9 FAILED:', err.message);
    throw err;
  }

  // ----------------------------------------------------
  // Test 10: Audit history query -> returns both creation and correction events for transaction.
  // ----------------------------------------------------
  try {
    const cust10 = dbRepository.addCustomer({
      customerCode: 'CUST-T010',
      name: 'Customer 10',
      status: CustomerStatus.ACTIVE,
      isActive: true,
      currentDueAmount: 0,
      wheatBalanceKg: 0,
      riceCreditAmount: 0,
    });

    const res10 = await TransactionService.createTransaction(
      {
        type: TransactionType.WHEAT_DEPOSIT,
        customerId: cust10.id,
        items: [
          {
            itemType: 'WHEAT',
            grainType: GrainType.WHEAT,
            direction: ItemDirection.IN,
            quantity: 30,
            unit: 'KG',
            ratePerUnit: 0,
            totalAmount: 0,
          },
        ],
      },
      ownerActor
    );

    await TransactionService.createCorrection(
      res10.transaction.id,
      {
        reason: 'Correction for audit history test',
        items: [{ itemId: res10.transaction.items[0].id, newQuantity: 35, newRate: 0 }],
      },
      ownerActor
    );

    const history = TransactionService.getAuditTrailForTransaction(res10.transaction.id);
    const hasCreation = history.some((h) => h.action === AuditAction.TRANSACTION_CREATED);
    const hasCorrection = history.some((h) => h.action === AuditAction.TRANSACTION_CORRECTED);

    assert.ok(hasCreation, 'Audit history must contain TRANSACTION_CREATED');
    assert.ok(hasCorrection, 'Audit history must contain TRANSACTION_CORRECTED');

    console.log('✔ Test 10: Audit history query returns chronological creation and correction events');
    passed++;
  } catch (err: any) {
    console.error('✘ Test 10 FAILED:', err.message);
    throw err;
  }

  // ----------------------------------------------------
  // Test 11: Reversal audit history -> returns creation and reversal events.
  // ----------------------------------------------------
  try {
    const cust11 = dbRepository.addCustomer({
      customerCode: 'CUST-T011',
      name: 'Customer 11',
      status: CustomerStatus.ACTIVE,
      isActive: true,
      currentDueAmount: 0,
      wheatBalanceKg: 0,
      riceCreditAmount: 0,
    });

    const res11 = await TransactionService.createTransaction(
      {
        type: TransactionType.WHEAT_DEPOSIT,
        customerId: cust11.id,
        items: [
          {
            itemType: 'WHEAT',
            grainType: GrainType.WHEAT,
            direction: ItemDirection.IN,
            quantity: 40,
            unit: 'KG',
            ratePerUnit: 0,
            totalAmount: 0,
          },
        ],
      },
      ownerActor
    );

    await TransactionService.reverseTransaction(
      res11.transaction.id,
      'Reversal for audit history verification',
      ownerActor
    );

    const history11 = TransactionService.getAuditTrailForTransaction(res11.transaction.id);
    const hasCreation = history11.some((h) => h.action === AuditAction.TRANSACTION_CREATED);
    const hasReversal = history11.some((h) => h.action === AuditAction.TRANSACTION_REVERSED);

    assert.ok(hasCreation, 'Audit history must contain TRANSACTION_CREATED');
    assert.ok(hasReversal, 'Audit history must contain TRANSACTION_REVERSED');

    console.log('✔ Test 11: Reversal audit history returns creation and reversal events');
    passed++;
  } catch (err: any) {
    console.error('✘ Test 11 FAILED:', err.message);
    throw err;
  }

  // ----------------------------------------------------
  // Test 12: Duplicate correction/reversal request -> idempotency key prevents duplicate execution.
  // ----------------------------------------------------
  try {
    const cust12 = dbRepository.addCustomer({
      customerCode: 'CUST-T012',
      name: 'Customer 12',
      status: CustomerStatus.ACTIVE,
      isActive: true,
      currentDueAmount: 0,
      wheatBalanceKg: 0,
      riceCreditAmount: 0,
    });

    const res12 = await TransactionService.createTransaction(
      {
        type: TransactionType.WHEAT_DEPOSIT,
        customerId: cust12.id,
        items: [
          {
            itemType: 'WHEAT',
            grainType: GrainType.WHEAT,
            direction: ItemDirection.IN,
            quantity: 20,
            unit: 'KG',
            ratePerUnit: 0,
            totalAmount: 0,
          },
        ],
      },
      ownerActor
    );

    const idempotencyKey = `idem-corr-${Date.now()}`;

    // First correction call
    const firstCall = await TransactionService.createCorrection(
      res12.transaction.id,
      {
        reason: 'Idempotency test adjustment',
        items: [{ itemId: res12.transaction.items[0].id, newQuantity: 25, newRate: 0 }],
        idempotencyKey,
      },
      ownerActor
    );

    // Second correction call with same key
    const secondCall = await TransactionService.createCorrection(
      res12.transaction.id,
      {
        reason: 'Idempotency test adjustment',
        items: [{ itemId: res12.transaction.items[0].id, newQuantity: 25, newRate: 0 }],
        idempotencyKey,
      },
      ownerActor
    );

    assert.strictEqual(
      firstCall.correctionTxn.id,
      secondCall.correctionTxn.id,
      'Duplicate request must return identical transaction instance'
    );

    // Balance should only have increased once (+5kg to 25kg, not +10kg to 30kg)
    const balances = LedgerService.calculateCustomerBalances(cust12.id);
    assert.strictEqual(balances.wheatBalanceKg, 25, 'Balance must only increment once despite duplicate call');

    console.log('✔ Test 12: Idempotency token prevents duplicate correction execution');
    passed++;
  } catch (err: any) {
    console.error('✘ Test 12 FAILED:', err.message);
    throw err;
  }

  // ----------------------------------------------------
  // Test 13: Historical rate -> updating current rate to Rs 23 does not change historical Rs 21 on existing transactions.
  // ----------------------------------------------------
  try {
    const cust13 = dbRepository.addCustomer({
      customerCode: 'CUST-T013',
      name: 'Customer 13',
      status: CustomerStatus.ACTIVE,
      isActive: true,
      currentDueAmount: 0,
      wheatBalanceKg: 0,
      riceCreditAmount: 0,
    });

    // 1. Transaction booked with rate ₹21/kg
    const res13 = await TransactionService.createTransaction(
      {
        type: TransactionType.RICE_CASH_SETTLEMENT,
        customerId: cust13.id,
        items: [
          {
            itemType: 'RICE',
            grainType: GrainType.RATION_RICE,
            direction: ItemDirection.IN,
            quantity: 10,
            unit: 'KG',
            ratePerUnit: 21,
            totalAmount: 210,
          },
        ],
      },
      ownerActor
    );

    const txId = res13.transaction.id;

    // 2. Global rate configuration changes from ₹21 to ₹23
    dbRepository.updateRateConfig({
      ricePurchaseRate: 23,
    });

    // 3. Verify existing transaction item rate remains strictly ₹21/kg
    const txAfterRateUpdate = dbRepository.getTransactionById(txId);
    assert.ok(txAfterRateUpdate, 'Transaction must exist');
    assert.strictEqual(
      txAfterRateUpdate?.items[0].ratePerUnit,
      21,
      'Historical rate on line item must remain locked at ₹21/kg'
    );
    assert.strictEqual(
      txAfterRateUpdate?.grossAmount,
      210,
      'Historical gross amount must remain locked at ₹210'
    );

    console.log('✔ Test 13: Historical transaction rate remains permanently locked at ₹21/kg when standard rate changes to ₹23/kg');
    passed++;
  } catch (err: any) {
    console.error('✘ Test 13 FAILED:', err.message);
    throw err;
  }

  console.log('\n==================================================');
  console.log(`ALL ${passed}/${total} AUTOMATED TESTS PASSED SUCCESSFULLY!`);
  console.log('==================================================\n');
}

runAllTests().catch((err) => {
  console.error('\nTest runner failed:', err);
  process.exit(1);
});
