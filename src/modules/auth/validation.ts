/**
 * Chakki Ledger - Authentication Validation Utilities
 *
 * Rules:
 * 1. Email: Must end with @gmail.com (case-insensitive) and have valid characters before @gmail.com
 * 2. Password: Minimum 8 characters, at least one special character, at least one number,
 *    at least one uppercase letter, and at least one lowercase letter.
 */

export interface PasswordRuleStatus {
  minLength: boolean;      // >= 8 chars
  hasSpecial: boolean;     // at least one special character
  hasNumber: boolean;      // at least one digit
  hasUpper: boolean;       // at least one uppercase letter
  hasLower: boolean;       // at least one lowercase letter
}

export interface PasswordValidationResult {
  isValid: boolean;
  rules: PasswordRuleStatus;
  error?: string;
}

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates whether an email ends with @gmail.com and has a valid local-part.
 */
export function validateGmail(email: string): EmailValidationResult {
  const trimmed = email.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Email address is required' };
  }

  // Must end with @gmail.com (case-insensitive)
  if (!trimmed.toLowerCase().endsWith('@gmail.com')) {
    return { isValid: false, error: 'Email address must end with @gmail.com' };
  }

  // Check prefix before @gmail.com
  const localPart = trimmed.slice(0, -10);
  if (!localPart || localPart.length < 1) {
    return { isValid: false, error: 'Please enter a valid Gmail address (e.g. owner@gmail.com)' };
  }

  if (!/^[a-zA-Z0-9._%+-]+$/.test(localPart)) {
    return { isValid: false, error: 'Gmail address contains invalid characters' };
  }

  return { isValid: true };
}

/**
 * Validates a password against strict security requirements:
 * - Minimum 8 characters
 * - At least one special character (!@#$%^&* etc.)
 * - At least one number (0-9)
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 */
export function validatePassword(password: string): PasswordValidationResult {
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  // Special character: any character that is not an ASCII letter or digit
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const rules: PasswordRuleStatus = {
    minLength,
    hasSpecial,
    hasNumber,
    hasUpper,
    hasLower,
  };

  const isValid = minLength && hasSpecial && hasNumber && hasUpper && hasLower;

  let error: string | undefined;
  if (!isValid) {
    const missing: string[] = [];
    if (!minLength) missing.push('minimum 8 characters');
    if (!hasUpper) missing.push('at least one uppercase letter');
    if (!hasLower) missing.push('at least one lowercase letter');
    if (!hasNumber) missing.push('at least one number');
    if (!hasSpecial) missing.push('at least one special character');
    error = `Password must contain: ${missing.join(', ')}.`;
  }

  return {
    isValid,
    rules,
    error,
  };
}
