import assert from 'node:assert/strict';
import { RiceProfitService } from '../rice-profit.service';
import { RiceCostLayer, RiceCostingMethod } from '../../types';

const layers: RiceCostLayer[] = [
  { id: 'lot-a', sourceTransactionId: 'tx-a', purchaseDate: '2026-09-01', quantityReceived: 50, quantityRemaining: 50, purchaseRate: 21, totalCost: 1050 },
  { id: 'lot-b', sourceTransactionId: 'tx-b', purchaseDate: '2026-09-02', quantityReceived: 30, quantityRemaining: 30, purchaseRate: 22, totalCost: 660 },
  { id: 'lot-c', sourceTransactionId: 'tx-c', purchaseDate: '2026-09-03', quantityReceived: 20, quantityRemaining: 20, purchaseRate: 20, totalCost: 400 },
];

const fifo = RiceProfitService.calculateFifoCOGS(layers, 60);
assert.equal(fifo.cogs, 1270, 'FIFO should consume 50kg at 21 and 10kg at 22');
assert.deepEqual(fifo.breakdown.map((line) => line.quantity), [50, 10]);

const weighted = RiceProfitService.calculateWeightedAverageCOGS(layers, 60);
assert.equal(weighted.cogs, 1266, 'Weighted average should use 2110 / 100 = 21.10 per kg');
assert.equal(weighted.breakdown[0].rate, 21.1);

const revenue = 60 * 31;
assert.equal(revenue - fifo.cogs, 590);
assert.equal(revenue - weighted.cogs, 594);

const loss = 100 * 29 - 100 * 32;
assert.equal(loss, -300, 'Loss must remain negative');
assert.equal(RiceCostingMethod.WEIGHTED_AVERAGE, 'WEIGHTED_AVERAGE');

console.log('Rice profit tests passed');