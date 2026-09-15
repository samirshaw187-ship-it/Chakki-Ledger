import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dbRepository } from '../../db/in-memory-db';
import { TransactionService } from '../transaction.service';
import { RiceAttaSettlementService } from '../rice-atta-settlement.service';
import { GrainCashSettlementService } from '../grain-cash-settlement.service';
import { LedgerService } from '../ledger.service';
import { TransactionValidationService } from '../transaction-validation.service';
import {
  AttaType,
  CustomerStatus,
  GrainType,
  ItemDirection,
  ItemType,
  UserRole,
  TransactionType,
  TransactionStatus,
} from '../../types';

const owner = { id: 'regression-owner', name: 'Regression Owner', role: UserRole.OWNER };

function customer(name: string) {
  return dbRepository.addCustomer({
    customerCode: `REG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    phone: `98${String(Date.now()).slice(-8)}`,
    status: CustomerStatus.ACTIVE,
    isActive: true,
    currentDueAmount: 0,
    wheatBalanceKg: 0,
    riceCreditAmount: 0,
  });
}

describe('settlement and wheat balance regressions', () => {
  it('TEST 1: Customer Wheat Balance = 20 kg, Wheat -> Atta Exchange = 35 kg is blocked with clear message', async () => {
    const cust = customer('Test 1 Customer');

    // Deposit 20 kg wheat
    await TransactionService.createTransaction({
      type: TransactionType.WHEAT_DEPOSIT,
      customerId: cust.id,
      items: [{
        itemType: ItemType.WHEAT,
        direction: ItemDirection.IN,
        grainType: GrainType.WHEAT,
        quantity: 20,
        unit: 'KG',
        ratePerUnit: 0,
        totalAmount: 0,
      }],
    }, owner);

    assert.equal(LedgerService.calculateCustomerBalances(cust.id).wheatBalanceKg, 20);

    // Validation service check: 35 kg > 20 kg must fail with exact message
    const validation = TransactionValidationService.validate({
      type: TransactionType.WHEAT_ATTA_EXCHANGE,
      customerId: cust.id,
      items: [
        { itemType: ItemType.WHEAT, direction: ItemDirection.IN, grainType: GrainType.WHEAT, quantity: 35, unit: 'KG', ratePerUnit: 10, totalAmount: 0 },
        { itemType: ItemType.ATTA, direction: ItemDirection.OUT, grainType: GrainType.ROLL_ATTA, attaType: AttaType.ROLL_ATTA, quantity: 35, unit: 'KG', ratePerUnit: 10, totalAmount: 350 },
      ],
    }, UserRole.OWNER);

    assert.equal(validation.isValid, false);
    const wheatError = validation.errors.find((e) => e.field === 'wheatQuantity');
    assert.ok(wheatError, 'Should contain wheatQuantity error');
    assert.equal(wheatError?.message, 'Customer has only 20 kg wheat available. Please enter 20 kg or less.');

    // TransactionService execution should also reject
    await assert.rejects(
      () => TransactionService.createTransaction({
        type: TransactionType.WHEAT_ATTA_EXCHANGE,
        customerId: cust.id,
        items: [
          { itemType: ItemType.WHEAT, direction: ItemDirection.IN, grainType: GrainType.WHEAT, quantity: 35, unit: 'KG', ratePerUnit: 10, totalAmount: 0 },
          { itemType: ItemType.ATTA, direction: ItemDirection.OUT, grainType: GrainType.ROLL_ATTA, attaType: AttaType.ROLL_ATTA, quantity: 35, unit: 'KG', ratePerUnit: 10, totalAmount: 350 },
        ],
      }, owner),
      /Customer has only 20 kg wheat available. Please enter 20 kg or less./
    );

    // Verify balance remains completely unchanged
    assert.equal(LedgerService.calculateCustomerBalances(cust.id).wheatBalanceKg, 20);
  });

  it('TEST 2: Customer sells 15kg Ration Rice @ ₹21 (=₹315), purchases 5kg Roll Atta @ ₹40 (=₹200) -> Net ₹115 Cash Handed Over Now', async () => {
    const cust = customer('Test 2 Customer');

    const calc = RiceAttaSettlementService.calculateRiceAttaSettlement({
      riceQuantity: 15,
      riceRate: 21,
      attaType: AttaType.ROLL_ATTA,
      attaQuantity: 5,
      attaRate: 40,
      paymentOption: 'PAID_NOW',
      actorRole: UserRole.OWNER,
    });

    assert.equal(calc.riceValue, 315);
    assert.equal(calc.attaValue, 200);
    assert.equal(calc.settlementAmount, 115);
    assert.equal(calc.settlementDirection, 'CUSTOMER_RECEIVES');
    assert.equal(calc.effectivePaidAmount, 115);
    assert.equal(calc.settlementAmount - calc.effectivePaidAmount, 0);
    assert.equal(calc.paymentStatus, 'PAID');
    assert.equal(calc.customerBalanceDelta, 0);

    const result = await RiceAttaSettlementService.createRiceAttaSettlement({
      customerId: cust.id,
      calculation: calc,
      paymentOption: 'PAID_NOW',
    }, owner);

    assert.equal(result.transaction.netAmount, 115);
    assert.equal(result.transaction.paidAmount, 115);
    assert.equal(result.transaction.status, TransactionStatus.PAID);
    assert.equal(result.transaction.paymentStatus, 'PAID');

    // Check customer ledger balances
    const balances = LedgerService.calculateCustomerBalances(cust.id);
    assert.equal(balances.cashCreditAmount, 0, 'Customer Credit must be 0');
    assert.equal(balances.cashDueAmount, 0, 'Customer Due must be 0');
    assert.equal(balances.wheatBalanceKg, 0);
  });

  it('TEST 3: Atta Retail Bill = ₹480 (12 kg @ ₹40), Full Cash Paid', async () => {
    const cust = customer('Test 3 Customer');

    const result = await TransactionService.createTransaction({
      type: TransactionType.ATTA_PURCHASE,
      customerId: cust.id,
      items: [{
        itemType: ItemType.ATTA,
        direction: ItemDirection.OUT,
        grainType: GrainType.ROLL_ATTA,
        attaType: AttaType.ROLL_ATTA,
        quantity: 12,
        unit: 'KG',
        ratePerUnit: 40,
        totalAmount: 480,
      }],
      paidAmount: 480,
      paymentStatus: 'PAID',
    }, owner);

    assert.equal(result.transaction.netAmount, 480);
    assert.equal(result.transaction.paidAmount, 480);
    assert.equal(result.transaction.balanceDelta, 0);
    assert.equal(result.transaction.status, TransactionStatus.PAID);
    assert.equal(result.transaction.paymentStatus, 'PAID');

    const balances = LedgerService.calculateCustomerBalances(cust.id);
    assert.equal(balances.cashDueAmount, 0, 'Customer Due must be 0');
    assert.equal(balances.cashCreditAmount, 0, 'Customer Credit must be 0');
  });

  it('TEST 4: Atta Retail Bill = ₹480 (12 kg @ ₹40), Add to Khata Due', async () => {
    const cust = customer('Test 4 Customer');

    const result = await TransactionService.createTransaction({
      type: TransactionType.ATTA_PURCHASE,
      customerId: cust.id,
      items: [{
        itemType: ItemType.ATTA,
        direction: ItemDirection.OUT,
        grainType: GrainType.ROLL_ATTA,
        attaType: AttaType.ROLL_ATTA,
        quantity: 12,
        unit: 'KG',
        ratePerUnit: 40,
        totalAmount: 480,
      }],
      paidAmount: 0,
      paymentStatus: 'DUE',
      status: TransactionStatus.DUE,
    }, owner);

    assert.equal(result.transaction.netAmount, 480);
    assert.equal(result.transaction.paidAmount, 0);
    assert.equal(result.transaction.balanceDelta, 480);
    assert.equal(result.transaction.status, TransactionStatus.DUE);
    assert.equal(result.transaction.paymentStatus, 'DUE');

    const balances = LedgerService.calculateCustomerBalances(cust.id);
    assert.equal(balances.cashDueAmount, 480, 'Customer Due must be 480');
    assert.equal(balances.cashCreditAmount, 0, 'Customer Credit must be 0');
  });

  it('TEST 5: Atta Retail Bill = ₹480 (12 kg @ ₹40), Partial Payment = ₹300', async () => {
    const cust = customer('Test 5 Customer');

    const result = await TransactionService.createTransaction({
      type: TransactionType.ATTA_PURCHASE,
      customerId: cust.id,
      items: [{
        itemType: ItemType.ATTA,
        direction: ItemDirection.OUT,
        grainType: GrainType.ROLL_ATTA,
        attaType: AttaType.ROLL_ATTA,
        quantity: 12,
        unit: 'KG',
        ratePerUnit: 40,
        totalAmount: 480,
      }],
      paidAmount: 300,
      paymentStatus: 'PARTIAL',
      status: TransactionStatus.PARTIAL,
    }, owner);

    assert.equal(result.transaction.netAmount, 480);
    assert.equal(result.transaction.paidAmount, 300);
    assert.equal(result.transaction.balanceDelta, 180);
    assert.equal(result.transaction.status, TransactionStatus.PARTIAL);
    assert.equal(result.transaction.paymentStatus, 'PARTIAL');

    const balances = LedgerService.calculateCustomerBalances(cust.id);
    assert.equal(balances.cashDueAmount, 180, 'Customer Due must be 180');
    assert.equal(balances.cashCreditAmount, 0, 'Customer Credit must be 0');
  });

  it('Validates Atta Purchase constraints (invalid partial payment and missing customer for khata due)', async () => {
    const cust = customer('Validation Test Customer');

    // Partial payment with 0 must be rejected
    const validationZero = TransactionValidationService.validate({
      type: TransactionType.ATTA_PURCHASE,
      customerId: cust.id,
      items: [{ itemType: ItemType.ATTA, direction: ItemDirection.OUT, grainType: GrainType.ROLL_ATTA, quantity: 12, unit: 'KG', ratePerUnit: 40, totalAmount: 480 }],
      paidAmount: 0,
      paymentStatus: 'PARTIAL',
    }, UserRole.OWNER);
    assert.equal(validationZero.isValid, false);
    assert.ok(validationZero.errors.some((e) => e.field === 'paidAmount'));

    // Partial payment with >= bill must be rejected
    const validationOver = TransactionValidationService.validate({
      type: TransactionType.ATTA_PURCHASE,
      customerId: cust.id,
      items: [{ itemType: ItemType.ATTA, direction: ItemDirection.OUT, grainType: GrainType.ROLL_ATTA, quantity: 12, unit: 'KG', ratePerUnit: 40, totalAmount: 480 }],
      paidAmount: 480,
      paymentStatus: 'PARTIAL',
    }, UserRole.OWNER);
    assert.equal(validationOver.isValid, false);
    assert.ok(validationOver.errors.some((e) => e.field === 'paidAmount'));

    // Khata due without customer must be rejected
    const validationNoCust = TransactionValidationService.validate({
      type: TransactionType.ATTA_PURCHASE,
      items: [{ itemType: ItemType.ATTA, direction: ItemDirection.OUT, grainType: GrainType.ROLL_ATTA, quantity: 12, unit: 'KG', ratePerUnit: 40, totalAmount: 480 }],
      paidAmount: 0,
      paymentStatus: 'DUE',
    }, UserRole.OWNER);
    assert.equal(validationNoCust.isValid, false);
    assert.ok(validationNoCust.errors.some((e) => e.field === 'customerId'));
  });

  it('Rice-Atta and Grain-Cash partial settlements record remainder correctly', async () => {
    const partialCustomer = customer('Partial Payout Regression');
    const partialCalc = RiceAttaSettlementService.calculateRiceAttaSettlement({
      riceQuantity: 15,
      riceRate: 21,
      attaType: AttaType.ROLL_ATTA,
      attaQuantity: 0,
      attaRate: 40,
      paymentOption: 'PARTIAL',
      cashPaidAmount: 200,
      actorRole: UserRole.OWNER,
    });
    await RiceAttaSettlementService.createRiceAttaSettlement({
      customerId: partialCustomer.id,
      calculation: partialCalc,
      paymentOption: 'PARTIAL',
      cashPaidAmount: 200,
    }, owner);
    assert.equal(LedgerService.calculateCustomerBalances(partialCustomer.id).cashCreditAmount, 115);

    const grainCustomer = customer('Grain Cash Regression');
    const grainCalc = GrainCashSettlementService.calculateGrainCashSettlement({
      grainType: GrainType.RATION_RICE,
      quantity: 15,
      rate: 21,
      paymentOption: 'PARTIAL',
      amountPaid: 200,
    });
    await GrainCashSettlementService.executeGrainCashSettlement(grainCustomer.id, grainCalc, owner);
    assert.equal(LedgerService.calculateCustomerBalances(grainCustomer.id).cashCreditAmount, 115);
  });
});
