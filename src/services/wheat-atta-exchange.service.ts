/**
 * Chakki Ledger - Centralized Wheat → Atta Exchange Service
 *
 * Core domain service managing:
 * - Deterministic calculation of Wheat → Atta exchange
 * - Retrieval of business rates from configuration (never hardcoded in UI components)
 * - Support for Chali Atta (₹8/kg) and Roll Atta (₹10/kg)
 * - Configurable wheat-to-atta yield/conversion ratio (default: 1.0)
 * - Role-authorized rate override with mandatory audit reason
 * - Safe monetary precision avoiding floating-point rounding errors
 */

import { AttaType, RateConfiguration, UserRole } from '../types';
import { dbRepository } from '../db/in-memory-db';
import { safeMultiply, roundCurrency, roundQuantity, formatKg, formatRupees } from '../utils/precision';

export interface WheatAttaExchangeInput {
  wheatQuantity: number;
  attaType: AttaType;
  customRate?: number;
  overrideReason?: string;
  isCustomRate?: boolean;
  rates?: RateConfiguration;
  actorRole?: UserRole;
}

export interface WheatAttaExchangeCalculation {
  wheatQuantity: number;
  attaType: AttaType;
  attaTypeName: string; // "Chali Atta" or "Roll Atta"
  standardRate: number; // Configured default rate
  appliedRate: number;  // Immutably locked rate for this transaction
  isCustomRate: boolean;
  overrideReason?: string;
  conversionRatio: number; // Configurable ratio (default: 1.0)
  attaQuantityGiven: number; // calculated atta output
  calculatedExchangeValue: number; // Wheat Qty × Applied Rate
  explanationText: string;
  summaryText: string;
  detailedLines: Array<{
    label: string;
    subtext?: string;
    quantity?: number;
    unit?: string;
    rate?: number;
    amount?: number;
    type?: 'in' | 'out';
    isHighlight?: boolean;
  }>;
}

export class WheatAttaExchangeService {
  /**
   * Look up configured default rate for the given atta type
   */
  public static getDefaultRate(attaType: AttaType, rates?: RateConfiguration): number {
    const config = rates || dbRepository.getRates();
    if (attaType === AttaType.CHALI_ATTA) {
      return roundCurrency(config.chaliAttaExchangeRate ?? 8.0);
    }
    return roundCurrency(config.rollAttaExchangeRate ?? 10.0);
  }

  /**
   * Get human-readable name for atta type
   */
  public static getAttaTypeName(attaType: AttaType): string {
    return attaType === AttaType.CHALI_ATTA ? 'Chali Atta' : 'Roll Atta';
  }

  /**
   * Centralized Calculation:
   * Exchange Value = Wheat Quantity (kg) × Applied Exchange Rate (₹/kg)
   * Atta Given = Wheat Quantity (kg) × Configurable Conversion Ratio
   */
  public static calculate(input: WheatAttaExchangeInput): WheatAttaExchangeCalculation {
    const rates = input.rates || dbRepository.getRates();
    const attaType = input.attaType || AttaType.ROLL_ATTA;
    const attaTypeName = this.getAttaTypeName(attaType);
    const standardRate = this.getDefaultRate(attaType, rates);

    const wheatQty = roundQuantity(input.wheatQuantity || 0);

    // Rate selection & override logic
    let appliedRate = standardRate;
    let isCustom = false;
    let overrideReason = input.overrideReason?.trim();

    if (input.isCustomRate && typeof input.customRate === 'number' && input.customRate > 0) {
      // Permission check: only OWNER can override rates
      if (input.actorRole && input.actorRole !== UserRole.OWNER) {
        throw new Error('Your account does not have permission to override rates.');
      }

      if (!overrideReason) {
        throw new Error('Reason is required for custom rate override.');
      }

      appliedRate = roundCurrency(input.customRate);
      isCustom = true;
    }

    if (appliedRate <= 0) {
      throw new Error(`Invalid exchange rate: ₹${appliedRate}/kg. Rate must be greater than 0.`);
    }

    // Configurable business ratio (default: 1.0)
    const conversionRatio = rates.wheatToAttaConversionRatio > 0
      ? rates.wheatToAttaConversionRatio
      : 1.0;

    // Financial calculation using safe arithmetic
    const calculatedExchangeValue = safeMultiply(wheatQty, appliedRate);
    const attaQuantityGiven = roundQuantity(wheatQty * conversionRatio);

    const explanationText = `${formatKg(wheatQty)} Wheat × ${isCustom ? `Custom Rate ` : ''}₹${appliedRate}/kg = ${formatRupees(calculatedExchangeValue)}`;
    const summaryText = `${formatKg(wheatQty)} Wheat → ${formatKg(attaQuantityGiven)} ${attaTypeName} @ ₹${appliedRate}/kg`;

    const detailedLines = [
      {
        label: 'Wheat Inflow',
        subtext: 'Grain brought by customer for milling exchange',
        quantity: wheatQty,
        unit: 'kg',
        type: 'in' as const,
      },
      {
        label: `${attaTypeName} Outflow`,
        subtext: conversionRatio !== 1.0
          ? `Milled atta output at configured yield ratio (${conversionRatio}x)`
          : 'Milled atta output (1:1 conversion)',
        quantity: attaQuantityGiven,
        unit: 'kg',
        type: 'out' as const,
      },
      {
        label: 'Applied Exchange Rate',
        subtext: isCustom
          ? `Custom rate override applied (Reason: ${overrideReason})`
          : `Configured business rate for ${attaTypeName}`,
        rate: appliedRate,
        unit: '₹/kg',
      },
      {
        label: 'Calculated Exchange Value',
        subtext: `${formatKg(wheatQty)} × ₹${appliedRate}/kg`,
        amount: calculatedExchangeValue,
        isHighlight: true,
      },
    ];

    return {
      wheatQuantity: wheatQty,
      attaType,
      attaTypeName,
      standardRate,
      appliedRate,
      isCustomRate: isCustom,
      overrideReason,
      conversionRatio,
      attaQuantityGiven,
      calculatedExchangeValue,
      explanationText,
      summaryText,
      detailedLines,
    };
  }
}
