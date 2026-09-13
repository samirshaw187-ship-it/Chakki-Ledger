/**
 * Chakki Ledger - Settlement & Financial Calculation Services
 *
 * Core Principle: Business calculations must reside strictly within this service layer,
 * never directly inside React UI components.
 */

import {
  SettlementCalculationInput,
  SettlementCalculationResult,
  SettlementDirection,
  Transaction,
  Payment,
} from '../types';

export class SettlementService {
  /**
   * Calculates total monetary value of ration rice sold by customer to the shop.
   * Formula: Rice Quantity (kg) × Rice Purchase Rate (₹/kg)
   */
  public static calculateRiceValue(quantityKg: number, ratePerKg: number): number {
    if (quantityKg < 0 || ratePerKg < 0) {
      throw new Error('Quantity and rate must be non-negative');
    }
    return Math.round(quantityKg * ratePerKg * 100) / 100;
  }

  /**
   * Calculates total monetary value of atta purchased by customer.
   * Formula: Atta Quantity (kg) × Atta Selling Rate (₹/kg)
   */
  public static calculateAttaValue(quantityKg: number, ratePerKg: number): number {
    if (quantityKg < 0 || ratePerKg < 0) {
      throw new Error('Quantity and rate must be non-negative');
    }
    return Math.round(quantityKg * ratePerKg * 100) / 100;
  }

  /**
   * Calculates net settlement when a customer brings rice to offset atta purchase:
   * Net Settlement = Atta Value - Rice Value
   * - If Net > 0: Customer pays the shop (balance due)
   * - If Net < 0: Shop pays the customer (cash payout or advance credit)
   * - If Net == 0: Settled exactly (no cash exchange required)
   */
  public static calculateSettlement(input: SettlementCalculationInput): SettlementCalculationResult {
    const riceKg = Math.max(0, input.riceQuantityKg || 0);
    const riceRate = Math.max(0, input.ricePurchaseRate || 0);
    const attaKg = Math.max(0, input.attaQuantityKg || 0);
    const attaRate = Math.max(0, input.attaSellingRate || 0);

    const riceValue = this.calculateRiceValue(riceKg, riceRate);
    const attaValue = this.calculateAttaValue(attaKg, attaRate);
    const netSettlement = Math.round((attaValue - riceValue) * 100) / 100;

    let direction: SettlementDirection = 'SETTLED';
    let summaryText = 'Transactions settle equally (₹0)';

    if (netSettlement > 0) {
      direction = 'CUSTOMER_PAYS';
      summaryText = `Customer owes shop ₹${netSettlement.toFixed(2)}`;
    } else if (netSettlement < 0) {
      direction = 'SHOP_PAYS';
      summaryText = `Shop pays customer ₹${Math.abs(netSettlement).toFixed(2)}`;
    }

    return {
      riceValue,
      attaValue,
      netSettlement,
      direction,
      summaryText,
    };
  }

  /**
   * Derives customer financial balance from recorded historical transactions and payments.
   * Rule: Balance must NEVER be arbitrary; it is derived from audit transactions.
   * Positive = Customer owes shop.
   * Negative = Customer has advance credit with shop.
   */
  public static calculateCustomerBalance(
    transactions: Pick<Transaction, 'balanceDelta' | 'status'>[],
    payments: Pick<Payment, 'amount'>[]
  ): number {
    const transactionDues = transactions
      .filter((t) => t.status !== 'REVERSED')
      .reduce((sum, t) => sum + (t.balanceDelta || 0), 0);

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    return Math.round((transactionDues - totalPaid) * 100) / 100;
  }

  /**
   * Derives customer's current wheat balance (kg held at mill).
   * Positive = Wheat waiting to be milled or collected.
   */
  public static calculateWheatBalance(
    wheatLedgerRecords: { inQuantityKg: number; outQuantityKg: number }[]
  ): number {
    const totalIn = wheatLedgerRecords.reduce((sum, r) => sum + (r.inQuantityKg || 0), 0);
    const totalOut = wheatLedgerRecords.reduce((sum, r) => sum + (r.outQuantityKg || 0), 0);
    return Math.round((totalIn - totalOut) * 1000) / 1000;
  }

  /**
   * Calculates profit from reselling ration rice to wholesalers:
   * Profit = Wholesale Revenue - Purchase Cost - Transportation/Handling Expenses
   */
  public static calculateRiceProfit(
    purchasedKg: number,
    purchaseRatePerKg: number,
    wholesaleSaleRatePerKg: number,
    allocatedExpenses: number = 0
  ): { grossProfit: number; netProfit: number; profitMarginPercentage: number } {
    const cost = purchasedKg * purchaseRatePerKg;
    const revenue = purchasedKg * wholesaleSaleRatePerKg;
    const grossProfit = Math.round((revenue - cost) * 100) / 100;
    const netProfit = Math.round((grossProfit - allocatedExpenses) * 100) / 100;
    const profitMarginPercentage = cost > 0 ? Math.round((netProfit / cost) * 1000) / 10 : 0;

    return {
      grossProfit,
      netProfit,
      profitMarginPercentage,
    };
  }
}
