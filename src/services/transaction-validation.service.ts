/**
 * Chakki Ledger - Transaction Validation Service
 *
 * Requirements:
 * - Customer must exist when required
 * - Transaction type must be valid enum
 * - Quantities cannot be negative (unless explicitly correction/reversal)
 * - Rates cannot be negative
 * - Amounts must be valid numbers
 * - Required transaction fields must exist
 * - Do not trust frontend calculations (recalculate and verify)
 * - Verify user role permissions
 */

import { SettlementPaymentStatus, TransactionType, UserRole } from '../types';
import { dbRepository } from '../db/in-memory-db';
import { TRANSACTION_DEFINITIONS, TransactionItemInput } from '../modules/transactions/definitions';
import { roundCurrency, roundQuantity } from '../utils/precision';

export interface CreateTransactionDTO {
  type: TransactionType;
  customerId?: string;
  items: TransactionItemInput[];
  paidAmount?: number;
  paymentStatus?: SettlementPaymentStatus | 'CALCULATED' | 'PENDING' | 'PAID' | 'PARTIAL';
  notes?: string;
  description?: string;
  date?: string;
}

export interface ValidationFailure {
  field: string;
  message: string;
}

export interface ValidationOutcome {
  isValid: boolean;
  errors: ValidationFailure[];
  errorSummary?: string;
}

export class TransactionValidationService {
  public static validate(
    dto: CreateTransactionDTO,
    actorRole: UserRole
  ): ValidationOutcome {
    const errors: ValidationFailure[] = [];

    // 1. Transaction Type Check
    if (!dto.type) {
      errors.push({ field: 'type', message: 'Transaction type is required' });
      return { isValid: false, errors, errorSummary: 'Transaction type is required' };
    }

    const definition = TRANSACTION_DEFINITIONS[dto.type];
    if (!definition) {
      errors.push({ field: 'type', message: `Invalid transaction type: ${dto.type}` });
      return { isValid: false, errors, errorSummary: `Invalid transaction type: ${dto.type}` };
    }

    // 2. Role Permission Check
    if (!definition.allowedRoles.includes(actorRole)) {
      errors.push({
        field: 'permission',
        message: `Your role (${actorRole}) does not have permission to create ${definition.label} transactions.`,
      });
    }

    // 3. Customer Check
    if (definition.requiresCustomer) {
      if (!dto.customerId) {
        errors.push({
          field: 'customerId',
          message: `Customer selection is required for ${definition.label}.`,
        });
      } else {
        const customer = dbRepository.getCustomerById(dto.customerId);
        if (!customer) {
          errors.push({
            field: 'customerId',
            message: `Selected customer (ID: ${dto.customerId}) was not found in the database.`,
          });
        } else if (!customer.isActive) {
          errors.push({
            field: 'customerId',
            message: `Customer "${customer.name}" is marked inactive and cannot perform new transactions.`,
          });
        }
      }
    }

    // 4. Items Validation
    const isAdjustment = dto.type === TransactionType.CORRECTION || dto.type === TransactionType.REVERSAL;

    if (!isAdjustment) {
      if (!dto.items || dto.items.length === 0) {
        errors.push({
          field: 'items',
          message: 'At least one item or line entry is required for this transaction.',
        });
      } else {
        dto.items.forEach((item, index) => {
          const itemIndex = index + 1;
          const qty = roundQuantity(item.quantity || 0);
          const rate = roundCurrency(item.ratePerUnit || 0);

          if (qty < 0) {
            errors.push({
              field: `items[${index}].quantity`,
              message: `Item #${itemIndex}: Quantity cannot be negative (${qty}).`,
            });
          }

          if (rate < 0) {
            errors.push({
              field: `items[${index}].ratePerUnit`,
              message: `Item #${itemIndex}: Rate cannot be negative (${rate}).`,
            });
          }

          if (item.totalAmount < 0) {
            errors.push({
              field: `items[${index}].totalAmount`,
              message: `Item #${itemIndex}: Item amount cannot be negative (${item.totalAmount}).`,
            });
          }
        });
      }
    }

    // 5. Special Validation Rules for WHEAT_ATTA_EXCHANGE
    if (dto.type === TransactionType.WHEAT_ATTA_EXCHANGE) {
      if (!dto.customerId) {
        errors.push({
          field: 'customerId',
          message: 'Customer selection is required for Wheat → Atta Exchange.',
        });
      }

      const wheatItem = dto.items.find(
        (i) => i.itemType === 'WHEAT' || i.grainType === 'WHEAT' || i.direction === 'IN'
      ) || dto.items[0];

      const attaItem = dto.items.find(
        (i) => i.itemType === 'ATTA' || i.attaType || i.direction === 'OUT'
      ) || dto.items[1] || dto.items[0];

      const wheatQty = wheatItem ? roundQuantity(wheatItem.quantity || 0) : 0;
      if (wheatQty <= 0) {
        errors.push({
          field: 'wheatQuantity',
          message: 'Please enter a valid wheat quantity greater than 0.',
        });
      }

      const appliedRate = attaItem?.ratePerUnit || wheatItem?.ratePerUnit || 0;
      if (appliedRate <= 0) {
        errors.push({
          field: 'ratePerUnit',
          message: 'Exchange rate must be greater than 0.',
        });
      }

      // Check if rate override was attempted
      const rates = dbRepository.getRates();
      const standardRate = attaItem?.attaType === 'CHALI_ATTA'
        ? (rates.chaliAttaExchangeRate ?? 8.0)
        : (rates.rollAttaExchangeRate ?? 10.0);

      const isRateOverridden = Math.abs(appliedRate - standardRate) > 0.001;
      if (isRateOverridden) {
        if (actorRole !== UserRole.OWNER) {
          errors.push({
            field: 'permission',
            message: 'Your account does not have permission to override rates.',
          });
        }
        const hasReason = (dto.notes && dto.notes.trim().length > 0) || (dto.description && dto.description.trim().length > 0);
        if (!hasReason) {
          errors.push({
            field: 'overrideReason',
            message: 'Reason is required for custom rate override.',
          });
        }
      }
    }

    // 6. Correction / Reversal mandatory reason
    if (isAdjustment) {
      const reason = dto.notes || dto.description;
      if (!reason || reason.trim().length < 4) {
        errors.push({
          field: 'notes',
          message: 'A detailed reason (at least 4 characters) is mandatory for any adjustment or reversal.',
        });
      }
    }

    // 7. Paid amount check
    if (typeof dto.paidAmount === 'number' && dto.paidAmount < 0) {
      errors.push({
        field: 'paidAmount',
        message: 'Paid cash amount cannot be negative.',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      errorSummary: errors.length > 0 ? errors.map((e) => e.message).join('; ') : undefined,
    };
  }
}
