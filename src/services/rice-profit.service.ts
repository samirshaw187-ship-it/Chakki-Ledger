import { dbRepository } from '../db/in-memory-db';
import { AuditService } from './audit.service';
import { InventoryService } from './inventory.service';
import {
  AuditAction,
  GrainType,
  InventoryItemCode,
  ItemType,
  RiceCostBreakdownLine,
  RiceCostLayer,
  RiceCostingMethod,
  RiceProfitSnapshot,
  Transaction,
  TransactionStatus,
  TransactionType,
  User,
} from '../types';
import { hasPermission, Permission } from '../modules/auth/permissions';
import { roundCurrency, roundQuantity } from '../utils/precision';

export interface RiceSaleProfit extends RiceProfitSnapshot {
  saleTransactionId: string;
  saleTransactionNumber: string;
  status: 'PROFIT' | 'LOSS';
}

const riceItem = (transaction: Transaction) => transaction.items.find((item) => item.itemType === ItemType.RICE || item.grainType === GrainType.RATION_RICE);
const isActive = (transaction: Transaction) => transaction.status !== TransactionStatus.CANCELLED && transaction.status !== TransactionStatus.DRAFT && transaction.status !== TransactionStatus.REVERSED;
const isPurchase = (transaction: Transaction) => [TransactionType.RICE_PURCHASE, TransactionType.RICE_ATTA_SETTLEMENT, TransactionType.RICE_CASH_SETTLEMENT].includes(transaction.type);
const isSale = (transaction: Transaction) => transaction.type === TransactionType.RICE_WHOLESALE_SALE;
const round = (value: number) => roundQuantity(value || 0);

function effectiveSale(transaction: Transaction): { quantity: number; rate: number; revenue: number } {
  const item = riceItem(transaction);
  if (!item) return { quantity: 0, rate: 0, revenue: 0 };
  let quantity = item.quantity;
  let rate = item.ratePerUnit;
  const corrections = dbRepository.getTransactions().filter((candidate) => candidate.isCorrectionOfId === transaction.id);
  for (const correction of corrections) {
    const correctionItem = riceItem(correction);
    if (!correctionItem) continue;
    quantity += correctionItem.direction === 'IN' ? -correctionItem.quantity : correctionItem.quantity;
    if (correctionItem.ratePerUnit > 0) rate = correctionItem.ratePerUnit;
  }
  quantity = round(Math.max(0, quantity));
  return { quantity, rate, revenue: roundCurrency(quantity * rate) };
}

function addPurchaseLayer(layers: RiceCostLayer[], transaction: Transaction): void {
  const item = riceItem(transaction);
  if (!item || item.quantity <= 0) return;
  layers.push({
    id: `layer-${transaction.id}`,
    sourceTransactionId: transaction.id,
    sourceTransactionNumber: transaction.transactionNumber,
    purchaseDate: transaction.date,
    quantityReceived: round(item.quantity),
    quantityRemaining: round(item.quantity),
    purchaseRate: roundCurrency(item.ratePerUnit),
    totalCost: roundCurrency(item.totalAmount || item.quantity * item.ratePerUnit),
  });
}

function consumeFifo(layers: RiceCostLayer[], quantity: number): { cogs: number; breakdown: RiceCostBreakdownLine[] } {
  let remaining = round(quantity);
  let cogs = 0;
  const breakdown: RiceCostBreakdownLine[] = [];
  for (const layer of layers) {
    if (remaining <= 0) break;
    const consumed = round(Math.min(remaining, layer.quantityRemaining));
    if (consumed <= 0) continue;
    const cost = roundCurrency(consumed * layer.purchaseRate);
    layer.quantityRemaining = round(layer.quantityRemaining - consumed);
    layer.totalCost = roundCurrency(layer.quantityRemaining * layer.purchaseRate);
    remaining = round(remaining - consumed);
    cogs = roundCurrency(cogs + cost);
    breakdown.push({ layerId: layer.id, sourceTransactionId: layer.sourceTransactionId, sourceTransactionNumber: layer.sourceTransactionNumber, quantity: consumed, rate: layer.purchaseRate, cost, label: `${consumed} kg from ${layer.sourceTransactionNumber || 'purchase lot'}` });
  }
  if (remaining > 0) throw new Error(`Rice costing failed: ${remaining} kg has no available purchase cost layer.`);
  return { cogs: roundCurrency(cogs), breakdown };
}

function consumeWeighted(layers: RiceCostLayer[], quantity: number): { cogs: number; breakdown: RiceCostBreakdownLine[] } {
  const availableQuantity = layers.reduce((sum, layer) => sum + layer.quantityRemaining, 0);
  const availableCost = layers.reduce((sum, layer) => sum + layer.totalCost, 0);
  if (quantity > availableQuantity + 0.000001) throw new Error(`Rice costing failed: ${round(quantity - availableQuantity)} kg has no available purchase cost layer.`);
  const average = availableQuantity > 0 ? availableCost / availableQuantity : 0;
  const cogs = roundCurrency(quantity * average);
  const ratio = availableQuantity > 0 ? quantity / availableQuantity : 0;
  for (const layer of layers) {
    layer.quantityRemaining = round(layer.quantityRemaining * (1 - ratio));
    layer.totalCost = roundCurrency(layer.totalCost * (1 - ratio));
  }
  return { cogs, breakdown: [{ quantity: round(quantity), rate: roundCurrency(average), cost: cogs, label: `${round(quantity)} kg at perpetual weighted average` }] };
}

function consume(layers: RiceCostLayer[], quantity: number, method: RiceCostingMethod) {
  return method === RiceCostingMethod.FIFO ? consumeFifo(layers, quantity) : consumeWeighted(layers, quantity);
}

export class RiceProfitService {
  public static calculateFifoCOGS(layers: RiceCostLayer[], quantity: number) {
    return consumeFifo(layers.map((layer) => ({ ...layer })), quantity);
  }

  public static calculateWeightedAverageCOGS(layers: RiceCostLayer[], quantity: number) {
    return consumeWeighted(layers.map((layer) => ({ ...layer })), quantity);
  }

  public static getCostingMethod(): RiceCostingMethod {
    return dbRepository.getRates().riceCostingMethod;
  }

  public static setCostingMethod(method: RiceCostingMethod, actor: User): RiceCostingMethod {
    if (!hasPermission(actor.role, Permission.MANAGE_RICE_TRADING)) throw new Error('You do not have permission to change rice costing method.');
    const previous = this.getCostingMethod();
    dbRepository.updateRateConfig({ riceCostingMethod: method });
    AuditService.log({ action: AuditAction.RICE_COSTING_METHOD_CHANGED, entityType: 'BUSINESS_SETTING', entityId: 'rice-costing-method', performedById: actor.id, performedByName: actor.name, reason: 'Costing method applies to future finalized sales.', previousState: { method: previous }, newState: { method } });
    return method;
  }

  public static getRiceCostLayers(): RiceCostLayer[] {
    return dbRepository.getTransactions().filter(isPurchase).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).flatMap((transaction) => {
      const item = riceItem(transaction);
      if (!item || item.quantity <= 0) return [];
      return [{ id: `layer-${transaction.id}`, sourceTransactionId: transaction.id, sourceTransactionNumber: transaction.transactionNumber, purchaseDate: transaction.date, quantityReceived: round(item.quantity), quantityRemaining: round(item.quantity), purchaseRate: roundCurrency(item.ratePerUnit), totalCost: roundCurrency(item.totalAmount || item.quantity * item.ratePerUnit) }];
    });
  }

  public static calculateSaleCOGS(saleTransactionId: string, method = this.getCostingMethod()): RiceSaleProfit {
    const target = dbRepository.getTransactionById(saleTransactionId);
    if (!target || !isSale(target)) throw new Error('Rice wholesale sale not found.');
    if (!isActive(target)) throw new Error('Reversed or cancelled sales do not have active profit.');
    const transactions = dbRepository.getTransactions().filter((transaction) => isPurchase(transaction) || isSale(transaction)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const layers: RiceCostLayer[] = [];
    let targetResult: { cogs: number; breakdown: RiceCostBreakdownLine[] } | undefined;
    for (const transaction of transactions) {
      if (!isActive(transaction)) continue;
      if (isPurchase(transaction)) { addPurchaseLayer(layers, transaction); continue; }
      const sale = effectiveSale(transaction);
      const saleMethod = transaction.profitSnapshot?.costingMethod || method;
      const result = consume(layers, sale.quantity, saleMethod);
      if (transaction.id === target.id) targetResult = result;
    }
    if (!targetResult) throw new Error('Unable to calculate rice sale cost.');
    const sale = effectiveSale(target);
    const revenue = sale.revenue;
    const grossProfit = roundCurrency(revenue - targetResult.cogs);
    return { saleTransactionId: target.id, saleTransactionNumber: target.transactionNumber, costingMethod: method, revenue, cogs: targetResult.cogs, grossProfit, profitPerKg: sale.quantity ? roundCurrency(grossProfit / sale.quantity) : 0, grossMargin: revenue ? roundCurrency((grossProfit / revenue) * 100) : 0, saleQuantity: sale.quantity, sellingRate: sale.rate, costPerKg: sale.quantity ? roundCurrency(targetResult.cogs / sale.quantity) : 0, breakdown: targetResult.breakdown, finalizedAt: new Date().toISOString(), status: grossProfit >= 0 ? 'PROFIT' : 'LOSS' };
  }

  public static finalizeSaleProfit(transaction: Transaction): RiceProfitSnapshot {
    const snapshot = this.calculateSaleCOGS(transaction.id, this.getCostingMethod());
    const { saleTransactionId: _saleTransactionId, saleTransactionNumber: _saleTransactionNumber, status: _status, ...profitSnapshot } = snapshot;
    transaction.profitSnapshot = profitSnapshot;
    dbRepository.saveTransaction(transaction);
    return profitSnapshot;
  }

  public static getRiceProfitSummary(startDate?: string, endDate?: string) {
    const sales = dbRepository.getTransactions().filter((transaction) => isSale(transaction) && isActive(transaction)).filter((transaction) => !startDate || new Date(transaction.date).getTime() >= new Date(startDate).getTime()).filter((transaction) => !endDate || new Date(transaction.date).getTime() <= new Date(`${endDate}T23:59:59.999`).getTime());
    const profits = sales.map((sale) => sale.profitSnapshot && sale.status !== TransactionStatus.CORRECTED ? { ...sale.profitSnapshot, saleTransactionId: sale.id, saleTransactionNumber: sale.transactionNumber, status: sale.profitSnapshot.grossProfit >= 0 ? 'PROFIT' as const : 'LOSS' as const } : this.calculateSaleCOGS(sale.id));
    const revenue = roundCurrency(profits.reduce((sum, profit) => sum + profit.revenue, 0));
    const cogs = roundCurrency(profits.reduce((sum, profit) => sum + profit.cogs, 0));
    const quantity = round(profits.reduce((sum, profit) => sum + profit.saleQuantity, 0));
    const grossProfit = roundCurrency(revenue - cogs);
    return { revenue, cogs, grossProfit, quantity, profitPerKg: quantity ? roundCurrency(grossProfit / quantity) : 0, grossMargin: revenue ? roundCurrency((grossProfit / revenue) * 100) : 0, sales: profits };
  }
}