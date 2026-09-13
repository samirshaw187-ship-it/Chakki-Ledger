import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dbRepository } from '../../db/in-memory-db';
import { TransactionService } from '../transaction.service';
import { RiceAttaSettlementService } from '../rice-atta-settlement.service';
import { GrainCashSettlementService } from '../grain-cash-settlement.service';
import { LedgerService } from '../ledger.service';
import {
  AttaType,
  CustomerStatus,
  GrainType,
  ItemDirection,
  ItemType,
  UserRole,
  TransactionType,
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
  it('consumes available deposited wheat and rejects over-exchange', async () => {
    const cust = customer('Wheat Balance Regression');

    await TransactionService.createTransaction({
      type: TransactionType.WHEAT_DEPOSIT,
      customerId: cust.id,
      items: [{
        itemType: ItemType.WHEAT,
        direction: ItemDirection.IN,
        grainType: GrainType.WHEAT,
        quantity: 15,
        unit: 'KG',
        ratePerUnit: 0,
        totalAmount: 0,
      }],
    }, owner);

    await TransactionService.createTransaction({
      type: TransactionType.WHEAT_ATTA_EXCHANGE,
      customerId: cust.id,
      paidAmount: 100,
      items: [
        { itemType: ItemType.WHEAT, direction: ItemDirection.IN, grainType: GrainType.WHEAT, quantity: 10, unit: 'KG', ratePerUnit: 10, totalAmount: 0 },
        { itemType: ItemType.ATTA, direction: ItemDirection.OUT, grainType: GrainType.ROLL_ATTA, attaType: AttaType.ROLL_ATTA, quantity: 10, unit: 'KG', ratePerUnit: 10, totalAmount: 100 },
      ],
    }, owner);

    assert.equal(LedgerService.calculateCustomerBalances(cust.id).wheatBalanceKg, 5);

    await assert.rejects(
      () => TransactionService.createTransaction({
        type: TransactionType.WHEAT_ATTA_EXCHANGE,
        customerId: cust.id,
        items: [
          { itemType: ItemType.WHEAT, direction: ItemDirection.IN, grainType: GrainType.WHEAT, quantity: 6, unit: 'KG', ratePerUnit: 10, totalAmount: 0 },
          { itemType: ItemType.ATTA, direction: ItemDirection.OUT, grainType: GrainType.ROLL_ATTA, attaType: AttaType.ROLL_ATTA, quantity: 6, unit: 'KG', ratePerUnit: 10, totalAmount: 60 },
        ],
      }, owner),
      /only 5 kg wheat available/
    );

    await assert.rejects(
      () => TransactionService.createTransaction({
        type: TransactionType.WHEAT_ATTA_EXCHANGE,
        customerId: cust.id,
        items: [
          { itemType: ItemType.WHEAT, direction: ItemDirection.IN, grainType: GrainType.WHEAT, quantity: 20, unit: 'KG', ratePerUnit: 10, totalAmount: 0 },
          { itemType: ItemType.ATTA, direction: ItemDirection.OUT, grainType: GrainType.ROLL_ATTA, attaType: AttaType.ROLL_ATTA, quantity: 20, unit: 'KG', ratePerUnit: 10, totalAmount: 200 },
        ],
      }, owner),
      /only 5 kg wheat available/
    );
  });

  it('does not create credit for full payout and records only the remainder for partial payout', async () => {
    const fullCustomer = customer('Full Payout Regression');
    const fullCalc = RiceAttaSettlementService.calculateRiceAttaSettlement({
      riceQuantity: 15,
      riceRate: 21,
      attaType: AttaType.ROLL_ATTA,
      attaQuantity: 0,
      attaRate: 40,
      paymentOption: 'PAID_NOW',
      actorRole: UserRole.OWNER,
    });
    await RiceAttaSettlementService.createRiceAttaSettlement({
      customerId: fullCustomer.id,
      calculation: fullCalc,
      paymentOption: 'PAID_NOW',
    }, owner);
    assert.equal(LedgerService.calculateCustomerBalances(fullCustomer.id).cashCreditAmount, 0);

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
