import { dbRepository } from '../db/in-memory-db';
import { Permission, hasPermission } from '../modules/auth/permissions';
import {
  AuditAction,
  BusinessProfileSettings,
  InventoryConfiguration,
  InventoryItemCode,
  RateConfiguration,
  ReceiptConfiguration,
  RiceCostingMethod,
  SystemPreferences,
  User,
  GrainUnit,
  InventoryCategory,
} from '../types';
import { AuditService } from './audit.service';

export type RateFieldName = keyof Pick<
  RateConfiguration,
  | 'chaliAttaExchangeRate'
  | 'rollAttaExchangeRate'
  | 'chaliAttaSellingRate'
  | 'rollAttaSellingRate'
  | 'ricePurchaseRate'
  | 'riceCashPurchaseRate'
  | 'wheatCashPurchaseRate'
  | 'riceCostingMethod'
>;

const RATE_AUDIT_ACTIONS: Record<string, AuditAction> = {
  chaliAttaExchangeRate: AuditAction.CHALI_ATTA_EXCHANGE_RATE_CHANGED,
  rollAttaExchangeRate: AuditAction.ROLL_ATTA_EXCHANGE_RATE_CHANGED,
  chaliAttaSellingRate: AuditAction.CHALI_ATTA_SELLING_RATE_CHANGED,
  rollAttaSellingRate: AuditAction.ROLL_ATTA_SELLING_RATE_CHANGED,
  ricePurchaseRate: AuditAction.RICE_PURCHASE_RATE_CHANGED,
  riceCashPurchaseRate: AuditAction.RICE_PURCHASE_RATE_CHANGED,
  wheatCashPurchaseRate: AuditAction.WHEAT_CASH_RATE_CHANGED,
};

const validatePositiveNumber = (value: number, field: string): void => {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    throw new Error(`${field} must be a valid non-negative number.`);
  }
};

export class SettingsService {
  public static getBusinessSettings() {
    return {
      businessProfile: dbRepository.getBusinessProfile(),
      activeRates: dbRepository.getRates(),
      costingMethod: dbRepository.getRates().riceCostingMethod,
      inventory: dbRepository.getInventoryConfiguration(),
      receiptConfiguration: dbRepository.getReceiptConfiguration(),
      systemPreferences: dbRepository.getSystemPreferences(),
    };
  }

  public static getBusinessProfile(): BusinessProfileSettings {
    return dbRepository.getBusinessProfile();
  }

  public static updateBusinessProfile(
    updates: Partial<BusinessProfileSettings>,
    actor: User,
    reason = 'Updated business profile settings'
  ): BusinessProfileSettings {
    if (!hasPermission(actor.role, Permission.SETTINGS_MANAGE)) {
      throw new Error('You do not have permission to update business profile settings.');
    }

    const previous = dbRepository.getBusinessProfile();
    const next = { ...previous, ...updates };
    if (!next.businessName?.trim()) throw new Error('Business name is required.');
    if (!next.phone?.trim()) throw new Error('Business phone is required.');

    dbRepository.updateBusinessProfile(next);
    AuditService.log({
      action: AuditAction.BUSINESS_PROFILE_UPDATED,
      entityType: 'BUSINESS_PROFILE',
      entityId: 'business-profile',
      performedById: actor.id,
      performedByName: actor.name,
      reason,
      previousState: previous as unknown as Record<string, unknown>,
      newState: next as unknown as Record<string, unknown>,
    });

    return dbRepository.getBusinessProfile();
  }

  public static getActiveRates(): RateConfiguration {
    return dbRepository.getRates();
  }

  public static updateRate(
    field: RateFieldName | 'defaultWholesaleRiceSellingRate',
    value: number,
    actor: User,
    reason = 'Updated active business rate'
  ): number {
    const allowedRateFields = new Set<RateFieldName | 'defaultWholesaleRiceSellingRate'>([
      'chaliAttaExchangeRate',
      'rollAttaExchangeRate',
      'chaliAttaSellingRate',
      'rollAttaSellingRate',
      'ricePurchaseRate',
      'riceCashPurchaseRate',
      'wheatCashPurchaseRate',
      'defaultWholesaleRiceSellingRate',
    ] as const);

    if (!allowedRateFields.has(field)) {
      throw new Error(`Rate field ${field} is not a supported business setting.`);
    }

    if (!hasPermission(actor.role, Permission.RATE_MANAGE) && !hasPermission(actor.role, Permission.SETTINGS_MANAGE)) {
      throw new Error('You do not have permission to modify business rates.');
    }

    validatePositiveNumber(value, field);

    const current = dbRepository.getRates();
    const previousValue = (current[field as keyof RateConfiguration] as number | undefined) ?? 0;
    if (previousValue === value) return value;

    const updates: Partial<RateConfiguration> = { [field]: value } as Partial<RateConfiguration>;
    dbRepository.updateRateConfig(updates);

    const auditAction = RATE_AUDIT_ACTIONS[field] || AuditAction.RATE_CHANGED;
    AuditService.log({
      action: auditAction,
      entityType: 'RATE',
      entityId: field,
      performedById: actor.id,
      performedByName: actor.name,
      reason,
      previousState: { [field]: previousValue } as Record<string, unknown>,
      newState: { [field]: value } as Record<string, unknown>,
    });

    return value;
  }

  public static getCostingMethod(): RiceCostingMethod {
    return dbRepository.getRates().riceCostingMethod;
  }

  public static updateCostingMethod(
    method: RiceCostingMethod,
    actor: User,
    reason = 'Updated rice costing method'
  ): RiceCostingMethod {
    if (!hasPermission(actor.role, Permission.COSTING_MANAGE) && !hasPermission(actor.role, Permission.SETTINGS_MANAGE)) {
      throw new Error('You do not have permission to change the costing method.');
    }

    const current = dbRepository.getRates().riceCostingMethod;
    if (!Object.values(RiceCostingMethod).includes(method)) {
      throw new Error('Invalid rice costing method.');
    }

    dbRepository.updateRateConfig({ riceCostingMethod: method });
    AuditService.log({
      action: AuditAction.RICE_COSTING_METHOD_CHANGED,
      entityType: 'BUSINESS_SETTING',
      entityId: 'rice-costing-method',
      performedById: actor.id,
      performedByName: actor.name,
      reason,
      previousState: { method: current },
      newState: { method },
    });

    return method;
  }

  public static getInventoryConfiguration(): InventoryConfiguration[] {
    return dbRepository.getInventoryConfiguration();
  }

  public static updateInventoryConfiguration(
    itemCode: InventoryItemCode,
    updates: Partial<InventoryConfiguration>,
    actor: User,
    reason = 'Updated inventory configuration'
  ): InventoryConfiguration {
    if (!hasPermission(actor.role, Permission.INVENTORY_CONFIG_MANAGE) && !hasPermission(actor.role, Permission.SETTINGS_MANAGE)) {
      throw new Error('You do not have permission to configure inventory settings.');
    }

    const previous = dbRepository.getInventoryConfiguration().find((item) => item.itemCode === itemCode);
    if (!previous) throw new Error('Inventory item not found.');

    const next = {
      ...previous,
      ...updates,
    };
    if (typeof next.reorderLevel === 'number' && next.reorderLevel < 0) {
      throw new Error('Reorder level cannot be negative.');
    }

    dbRepository.updateInventoryConfiguration(itemCode, next);
    AuditService.log({
      action: AuditAction.INVENTORY_SETTING_CHANGED,
      entityType: 'INVENTORY_ITEM',
      entityId: itemCode,
      performedById: actor.id,
      performedByName: actor.name,
      reason,
      previousState: previous as unknown as Record<string, unknown>,
      newState: next as unknown as Record<string, unknown>,
    });

    return dbRepository.getInventoryConfiguration().find((item) => item.itemCode === itemCode)!;
  }

  public static getReceiptConfiguration(): ReceiptConfiguration {
    return dbRepository.getReceiptConfiguration();
  }

  public static updateReceiptConfiguration(
    updates: Partial<ReceiptConfiguration>,
    actor: User,
    reason = 'Updated receipt configuration'
  ): ReceiptConfiguration {
    if (!hasPermission(actor.role, Permission.RECEIPT_CONFIG_MANAGE) && !hasPermission(actor.role, Permission.SETTINGS_MANAGE)) {
      throw new Error('You do not have permission to update receipt settings.');
    }

    const previous = dbRepository.getReceiptConfiguration();
    const next = { ...previous, ...updates };
    if (!next.businessName?.trim()) throw new Error('Business name is required in receipt settings.');
    if (!next.phone?.trim()) throw new Error('Receipt phone is required.');
    if (!['THERMAL', 'A4'].includes(next.receiptFormat)) throw new Error('Invalid receipt format.');

    dbRepository.updateReceiptConfiguration(next);
    AuditService.log({
      action: AuditAction.RECEIPT_CONFIG_UPDATED,
      entityType: 'RECEIPT_CONFIG',
      entityId: 'receipt-config',
      performedById: actor.id,
      performedByName: actor.name,
      reason,
      previousState: previous as unknown as Record<string, unknown>,
      newState: next as unknown as Record<string, unknown>,
    });

    return dbRepository.getReceiptConfiguration();
  }

  public static getSystemPreferences(): SystemPreferences {
    return dbRepository.getSystemPreferences();
  }

  public static updateSystemPreferences(
    updates: Partial<SystemPreferences>,
    actor: User,
    reason = 'Updated system preferences'
  ): SystemPreferences {
    if (!hasPermission(actor.role, Permission.SETTINGS_MANAGE)) {
      throw new Error('You do not have permission to update system preferences.');
    }

    const previous = dbRepository.getSystemPreferences();
    const next = { ...previous, ...updates };
    if (next.currency && next.currency !== 'INR') {
      throw new Error('Only INR is supported at this time.');
    }

    dbRepository.updateSystemPreferences(next);
    AuditService.log({
      action: AuditAction.SYSTEM_PREFERENCES_UPDATED,
      entityType: 'SYSTEM_PREFERENCES',
      entityId: 'system-preferences',
      performedById: actor.id,
      performedByName: actor.name,
      reason,
      previousState: previous as unknown as Record<string, unknown>,
      newState: next as unknown as Record<string, unknown>,
    });

    return dbRepository.getSystemPreferences();
  }

  public static getRecentChanges(limit = 10) {
    return AuditService.getAllLogs()
      .filter((log) =>
        log.entityType === 'RATE' ||
        log.entityType === 'BUSINESS_PROFILE' ||
        log.entityType === 'RECEIPT_CONFIG' ||
        log.entityType === 'SYSTEM_PREFERENCES' ||
        log.entityType === 'INVENTORY_ITEM' ||
        log.entityType === 'BUSINESS_SETTING'
      )
      .slice(0, limit)
      .map((log) => ({
        id: log.id,
        setting: log.entityId,
        action: log.action,
        changedBy: log.performedByName,
        changedAt: log.timestamp,
        oldValue: log.previousState ? JSON.stringify(log.previousState) : '-',
        newValue: log.newState ? JSON.stringify(log.newState) : '-',
      }));
  }
}
