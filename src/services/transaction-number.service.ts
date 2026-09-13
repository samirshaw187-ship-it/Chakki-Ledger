/**
 * Chakki Ledger - Transaction Number Service
 *
 * Requirements:
 * - Human-readable unique format: TXN-YYYYMMDD-XXXXX (e.g. TXN-20260912-00001)
 * - Generated on backend
 * - Unique and never reused
 * - Never manually typed by user
 * - Separate from database primary key
 * - Easy to search
 */

import { dbRepository } from '../db/in-memory-db';

export class TransactionNumberService {
  /**
   * Generates the next unique, sequential transaction number for a given transaction date.
   * Format: TXN-YYYYMMDD-XXXXX (e.g. TXN-20260912-00001)
   */
  public static generateNext(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;
    const patternPrefix = `TXN-${datePrefix}-`;

    const existingTransactions = dbRepository.getTransactions();
    let maxSequence = 0;

    for (const tx of existingTransactions) {
      if (tx.transactionNumber && tx.transactionNumber.startsWith(patternPrefix)) {
        const seqPart = tx.transactionNumber.replace(patternPrefix, '');
        const num = parseInt(seqPart, 10);
        if (!isNaN(num) && num > maxSequence) {
          maxSequence = num;
        }
      } else if (tx.transactionNumber) {
        // Also check any existing format such as TXN-YYYY-XXXX
        const fallbackMatch = tx.transactionNumber.match(/TXN-(\d+)-(\d+)/i);
        if (fallbackMatch && fallbackMatch[1] === String(year)) {
          const num = parseInt(fallbackMatch[2], 10);
          if (!isNaN(num) && num > maxSequence) {
            maxSequence = Math.max(maxSequence, num);
          }
        }
      }
    }

    const nextSeq = maxSequence + 1;
    const formattedSeq = String(nextSeq).padStart(5, '0');
    return `TXN-${datePrefix}-${formattedSeq}`;
  }

  /**
   * Validates if a transaction number conforms to readable standard
   */
  public static isValidFormat(txnNumber: string): boolean {
    if (!txnNumber || typeof txnNumber !== 'string') return false;
    // Supports TXN-YYYYMMDD-XXXXX as well as legacy TXN-YYYY-XXXX
    return /^TXN-\d{8}-\d{4,5}$/i.test(txnNumber) || /^TXN-\d{4}-\d{4,5}$/i.test(txnNumber);
  }
}
