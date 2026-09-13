/**
 * Chakki Ledger - Business Validation Service
 *
 * Enforces business rules:
 * - Quantities and rates must never be negative (unless explicitly CORRECTION/REVERSAL)
 * - Required fields check
 * - Date integrity
 */

import { TransactionType } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export class ValidationService {
  public static validateTransactionInput(input: {
    type?: TransactionType;
    customerId?: string;
    quantity?: number;
    ratePerUnit?: number;
    amount?: number;
    date?: string;
  }): ValidationResult {
    const errors: Record<string, string> = {};

    // 1. Transaction Type
    if (!input.type) {
      errors.type = 'Transaction type is required';
    }

    // 2. Customer ID for customer-associated transactions
    const nonCustomerTypes = [TransactionType.EXPENSE, TransactionType.RICE_WHOLESALE_SALE];
    if (input.type && !nonCustomerTypes.includes(input.type) && !input.customerId) {
      errors.customerId = 'Customer selection is required for this transaction';
    }

    // 3. Quantity check
    const isAdjustment = input.type === TransactionType.CORRECTION || input.type === TransactionType.REVERSAL;
    if (typeof input.quantity === 'number') {
      if (!isAdjustment && input.quantity <= 0) {
        errors.quantity = 'Quantity must be greater than 0';
      }
    }

    // 4. Rate check
    if (typeof input.ratePerUnit === 'number') {
      if (!isAdjustment && input.ratePerUnit < 0) {
        errors.ratePerUnit = 'Rate cannot be negative';
      }
    }

    // 5. Amount check
    if (typeof input.amount === 'number') {
      if (!isAdjustment && input.amount < 0) {
        errors.amount = 'Amount cannot be negative';
      }
    }

    // 6. Date validation
    if (input.date) {
      const parsedDate = new Date(input.date);
      if (isNaN(parsedDate.getTime())) {
        errors.date = 'Invalid transaction date format';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  public static validatePaymentInput(input: {
    customerId?: string;
    amount?: number;
    mode?: string;
  }): ValidationResult {
    const errors: Record<string, string> = {};

    if (!input.customerId) {
      errors.customerId = 'Customer is required for recording payment';
    }

    if (input.amount === undefined || input.amount <= 0) {
      errors.amount = 'Payment amount must be greater than ₹0';
    }

    if (!input.mode) {
      errors.mode = 'Payment mode is required (Cash, UPI, etc.)';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  public static validateCustomerInput(input: {
    name?: string;
    phone?: string;
    alternatePhone?: string;
    address?: string;
    notes?: string;
  }): ValidationResult {
    const errors: Record<string, string> = {};

    // 1. Name validation
    if (!input.name || input.name.trim().length === 0) {
      errors.name = 'Full name is required';
    } else if (input.name.trim().length < 2) {
      errors.name = 'Full name must be at least 2 characters';
    } else if (input.name.trim().length > 100) {
      errors.name = 'Full name must be less than 100 characters';
    }

    // 2. Phone validation (optional, but if provided must be valid Indian 10-digit format or 10-12 digits)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (input.phone && input.phone.trim().length > 0) {
      const cleanPhone = input.phone.replace(/[\s\-+]/g, '').replace(/^91/, '');
      if (!phoneRegex.test(cleanPhone)) {
        errors.phone = 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9';
      }
    }

    // 3. Alternate phone validation (optional)
    if (input.alternatePhone && input.alternatePhone.trim().length > 0) {
      const cleanAltPhone = input.alternatePhone.replace(/[\s\-+]/g, '').replace(/^91/, '');
      if (!phoneRegex.test(cleanAltPhone)) {
        errors.alternatePhone = 'Alternate phone must be a valid 10-digit mobile number';
      }
    }

    // 4. Notes and Address length constraints
    if (input.notes && input.notes.length > 500) {
      errors.notes = 'Notes cannot exceed 500 characters';
    }

    if (input.address && input.address.length > 200) {
      errors.address = 'Address cannot exceed 200 characters';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
