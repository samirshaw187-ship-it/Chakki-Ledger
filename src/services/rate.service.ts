/**
 * Chakki Ledger - Rate Management & Historical Rate Snapshot Service
 *
 * Core Business Rule:
 * Historical transactions MUST retain the exact rate applied at the moment of the transaction.
 * Future rate changes in settings must NEVER retroactively modify historical transaction line items.
 */

import { DEFAULT_RATE_CONFIGURATION } from '../config/business.config';
import { AttaType, RateConfiguration } from '../types';

export class RateService {
  private static activeConfiguration: RateConfiguration = { ...DEFAULT_RATE_CONFIGURATION };

  /**
   * Retrieves current active rate configuration
   */
  public static getCurrentRates(): RateConfiguration {
    return { ...this.activeConfiguration };
  }

  /**
   * Updates shop rates for all FUTURE transactions.
   * Does NOT alter old records.
   */
  public static updateRates(newRates: Partial<RateConfiguration>): RateConfiguration {
    this.activeConfiguration = {
      ...this.activeConfiguration,
      ...newRates,
      effectiveFrom: new Date().toISOString(),
    };
    return { ...this.activeConfiguration };
  }

  /**
   * Resolves the applied rate snapshot for a given product type.
   * This returned rate must be stored permanently in TransactionItem.ratePerUnit.
   */
  public static getAppliedRateFor(
    product:
      | 'CHALI_ATTA_EXCHANGE'
      | 'ROLL_ATTA_EXCHANGE'
      | 'ROLL_ATTA_SALE'
      | 'RICE_PURCHASE'
      | 'RICE_CASH_PURCHASE'
      | 'WHEAT_CASH_PURCHASE',
    customRateOverride?: number
  ): number {
    if (typeof customRateOverride === 'number' && customRateOverride >= 0) {
      return customRateOverride;
    }

    switch (product) {
      case 'CHALI_ATTA_EXCHANGE':
        return this.activeConfiguration.chaliAttaExchangeRate; // ₹8/kg
      case 'ROLL_ATTA_EXCHANGE':
        return this.activeConfiguration.rollAttaExchangeRate;  // ₹10/kg
      case 'ROLL_ATTA_SALE':
        return this.activeConfiguration.rollAttaSellingRate;   // ₹40/kg
      case 'RICE_PURCHASE':
      case 'RICE_CASH_PURCHASE':
        return this.activeConfiguration.riceCashPurchaseRate ?? this.activeConfiguration.ricePurchaseRate ?? 21; // ₹21/kg
      case 'WHEAT_CASH_PURCHASE':
        return this.activeConfiguration.wheatCashPurchaseRate ?? 24; // Configurable Wheat Cash Purchase Rate (distinct from Chali/Roll milling)
      default:
        throw new Error(`Unknown product rate lookup: ${product}`);
    }
  }

  /**
   * Helper to fetch milling exchange rate by AttaType
   */
  public static getMillingRateByAttaType(attaType: AttaType): number {
    return attaType === AttaType.ROLL_ATTA
      ? this.activeConfiguration.rollAttaExchangeRate
      : this.activeConfiguration.chaliAttaExchangeRate;
  }

  /**
   * Helper to fetch configured Rice Cash Purchase Rate
   */
  public static getRiceCashPurchaseRate(rates?: RateConfiguration): number {
    const active = rates || this.activeConfiguration;
    return active.riceCashPurchaseRate ?? active.ricePurchaseRate ?? 21;
  }

  /**
   * Helper to fetch configured Wheat Cash Purchase Rate
   * IMPORTANT: Never assume this is the milling exchange rate!
   */
  public static getWheatCashPurchaseRate(rates?: RateConfiguration): number {
    const active = rates || this.activeConfiguration;
    return active.wheatCashPurchaseRate ?? 24;
  }
}
