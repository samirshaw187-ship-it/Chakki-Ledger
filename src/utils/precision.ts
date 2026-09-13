/**
 * Chakki Ledger - Precision & Decimal Utilities
 *
 * Implements safe decimal and numeric calculation strategies for financial
 * values and grain quantities to eliminate floating-point arithmetic errors.
 */

/**
 * Rounds a monetary amount to exactly 2 decimal places (paise precision)
 */
export function roundCurrency(value: number): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Rounds a quantity (e.g. grain kg) to 3 decimal places (gram precision)
 */
export function roundQuantity(value: number): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/**
 * Safe multiplication of quantity and rate:
 * Converts to scaled integers to prevent floating-point inaccuracies
 * (e.g. 15.00 * 21.00 = 315.00)
 */
export function safeMultiply(qty: number, rate: number): number {
  const safeQty = roundQuantity(qty);
  const safeRate = roundCurrency(rate);
  return roundCurrency(safeQty * safeRate);
}

/**
 * Safe addition of multiple currency numbers
 */
export function safeAdd(...values: number[]): number {
  const sumInPaise = values.reduce((acc, val) => {
    const paise = Math.round((val || 0) * 100);
    return acc + paise;
  }, 0);
  return sumInPaise / 100;
}

/**
 * Safe subtraction of currency numbers (a - b)
 */
export function safeSubtract(a: number, b: number): number {
  const aPaise = Math.round((a || 0) * 100);
  const bPaise = Math.round((b || 0) * 100);
  return (aPaise - bPaise) / 100;
}

/**
 * Formats a rupee amount consistently with Indian Rupee symbol and two decimal places
 */
export function formatRupees(amount: number, includeDecimalsIfZero = false): string {
  const rounded = roundCurrency(amount);
  if (!includeDecimalsIfZero && Number.isInteger(rounded)) {
    return `₹${rounded.toLocaleString('en-IN')}`;
  }
  return `₹${rounded.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats a weight quantity in KG
 */
export function formatKg(quantity: number): string {
  const rounded = roundQuantity(quantity);
  // If whole number, e.g. 15 kg
  if (Number.isInteger(rounded)) {
    return `${rounded} kg`;
  }
  // Otherwise display up to 3 decimals without trailing zeros
  return `${parseFloat(rounded.toFixed(3))} kg`;
}

/**
 * Formats a Date or ISO string for user-facing displays
 */
export function formatDate(dateOrString: string | Date): string {
  try {
    const d = typeof dateOrString === 'string' ? new Date(dateOrString) : dateOrString;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateOrString);
  }
}

