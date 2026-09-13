/**
 * Chakki Ledger - Payment & Settlement Service
 *
 * Handles:
 * - Customer Credit / Debit & Payment Settlements
 * - Overpayment management (Bill vs Paid -> Applied to bill & Credit created)
 * - Customer dues partial/full settlement
 * - Paying customer out of available credit
 * - Applying existing customer credit to bills
 * - Traceable payment receipts and audit trail
 */

import { dbRepository } from '../db/in-memory-db';
import {
  AuditAction,
  CustomerAccountBalance,
  ItemDirection,
  ItemType,
  LedgerDirection,
  LedgerEntry,
  LedgerEntryType,
  LedgerStatus,
  LedgerUnit,
  Payment,
  PaymentMode,
  PaymentStatus,
  PaymentType,
  Transaction,
  TransactionStatus,
  TransactionType,
  User,
  UserRole,
} from '../types';
import { hasPermission, Permission } from '../modules/auth/permissions';
import { AuditService } from './audit.service';
import { LedgerService } from './ledger.service';
import { formatRupees, roundCurrency } from '../utils/precision';

export interface RecordPaymentInput {
  customerId: string;
  actionType: PaymentType;
  amount: number;
  mode?: PaymentMode;
  targetTransactionId?: string;
  referenceNo?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface SettlementPreview {
  currentDue: number;
  currentCredit: number;
  amountAppliedToDue: number;
  creditCreated: number;
  payoutAmount: number;
  newDue: number;
  newCredit: number;
  isValid: boolean;
  error?: string;
  summaryText: string;
}

export interface PaymentExecutionResult {
  success: boolean;
  payment?: Payment;
  transaction?: Transaction;
  newBalances?: CustomerAccountBalance;
  message: string;
  error?: string;
}

export class PaymentService {
  private static idempotencySet: Set<string> = new Set();

  /**
   * Preview settlement outcome before confirming
   */
  public static calculateSettlement(
    customerId: string,
    actionType: PaymentType,
    amount: number,
    targetTransactionId?: string
  ): SettlementPreview {
    const balances = LedgerService.calculateCustomerBalances(customerId);
    const amt = roundCurrency(Math.max(0, amount || 0));

    let currentDue = balances.cashDueAmount;
    const currentCredit = balances.cashCreditAmount;

    // If target transaction specified, check its remaining due
    if (targetTransactionId) {
      const targetTx = dbRepository.getTransactionById(targetTransactionId);
      if (targetTx && targetTx.balanceDelta > 0) {
        currentDue = targetTx.balanceDelta;
      }
    }

    let amountAppliedToDue = 0;
    let creditCreated = 0;
    let payoutAmount = 0;
    let newDue = currentDue;
    let newCredit = currentCredit;
    let isValid = true;
    let error: string | undefined;
    let summaryText = '';

    if (amt <= 0) {
      return {
        currentDue,
        currentCredit,
        amountAppliedToDue: 0,
        creditCreated: 0,
        payoutAmount: 0,
        newDue: currentDue,
        newCredit: currentCredit,
        isValid: false,
        error: 'Please enter a valid amount greater than ₹0',
        summaryText: 'Enter amount to calculate settlement',
      };
    }

    switch (actionType) {
      case PaymentType.RECEIVE_PAYMENT:
      case PaymentType.SETTLE_DUE: {
        if (currentDue > 0) {
          if (amt <= currentDue) {
            amountAppliedToDue = amt;
            creditCreated = 0;
            newDue = roundCurrency(currentDue - amt);
            newCredit = currentCredit;
            summaryText = `₹${amt} applied to dues. Remaining dues: ₹${newDue}`;
          } else {
            // Overpayment!
            amountAppliedToDue = currentDue;
            creditCreated = roundCurrency(amt - currentDue);
            newDue = 0;
            newCredit = roundCurrency(currentCredit + creditCreated);
            summaryText = `₹${currentDue} clears all dues in full. Excess ₹${creditCreated} will be credited to customer khata.`;
          }
        } else {
          // No existing dues -> Entire amount becomes advance credit
          amountAppliedToDue = 0;
          creditCreated = amt;
          newDue = 0;
          newCredit = roundCurrency(currentCredit + amt);
          summaryText = `Customer has ₹0 dues. Full ₹${amt} will be credited as advance balance.`;
        }
        break;
      }

      case PaymentType.PAY_CUSTOMER: {
        payoutAmount = amt;
        if (currentCredit <= 0) {
          isValid = false;
          error = 'No customer credit available to pay out';
          summaryText = 'Customer credit balance is ₹0. Cannot pay out.';
        } else if (amt > currentCredit) {
          isValid = false;
          error = `Cannot pay out more than available credit (₹${currentCredit})`;
          summaryText = `Maximum payable amount is ₹${currentCredit}`;
        } else {
          newCredit = roundCurrency(currentCredit - amt);
          newDue = currentDue;
          summaryText = `Pay ₹${amt} cash to customer. Remaining credit: ₹${newCredit}`;
        }
        break;
      }

      case PaymentType.APPLY_CREDIT: {
        if (currentCredit <= 0) {
          isValid = false;
          error = 'No customer credit available to apply';
          summaryText = 'Customer credit balance is ₹0';
        } else if (currentDue <= 0) {
          isValid = false;
          error = 'Customer has no outstanding dues to offset';
          summaryText = 'No dues to offset against credit';
        } else {
          const maxApplicable = Math.min(currentCredit, currentDue);
          if (amt > maxApplicable) {
            isValid = false;
            error = `Cannot apply more than available credit or due (Max ₹${maxApplicable})`;
            summaryText = `Maximum applicable credit is ₹${maxApplicable}`;
          } else {
            amountAppliedToDue = amt;
            newCredit = roundCurrency(currentCredit - amt);
            newDue = roundCurrency(currentDue - amt);
            summaryText = `₹${amt} credit applied to dues. Dues reduced to ₹${newDue}, Credit remaining: ₹${newCredit}`;
          }
        }
        break;
      }

      default: {
        isValid = false;
        error = 'Invalid payment action type';
        summaryText = 'Select a valid payment action';
      }
    }

    return {
      currentDue,
      currentCredit,
      amountAppliedToDue,
      creditCreated,
      payoutAmount,
      newDue,
      newCredit,
      isValid,
      error,
      summaryText,
    };
  }

  /**
   * Execute and persist payment atomically
   */
  public static recordPayment(
    input: RecordPaymentInput,
    actor: User
  ): PaymentExecutionResult {
    // 1. Idempotency protection
    if (input.idempotencyKey) {
      if (this.idempotencySet.has(input.idempotencyKey)) {
        return {
          success: false,
          error: 'Duplicate payment submission prevented.',
          message: 'Payment was already processed.',
        };
      }
      this.idempotencySet.add(input.idempotencyKey);
    }

    const customer = dbRepository.getCustomerById(input.customerId);
    if (!customer) {
      return { success: false, error: 'Customer not found.', message: 'Customer record missing.' };
    }

    const preview = this.calculateSettlement(
      input.customerId,
      input.actionType,
      input.amount,
      input.targetTransactionId
    );

    if (!preview.isValid) {
      return {
        success: false,
        error: preview.error || 'Invalid payment parameters',
        message: preview.error || 'Payment calculation failed',
      };
    }

    const now = new Date().toISOString();
    const mode = input.mode || PaymentMode.CASH;
    const amount = roundCurrency(input.amount);

    // 2. Create underlying Transaction record for ledger audit integrity
    let txType: TransactionType = TransactionType.CASH_PAYMENT;
    let txStatus: TransactionStatus = TransactionStatus.COMPLETED;
    let balanceDelta = 0;
    let settlementDirection: 'CUSTOMER_PAYS' | 'SHOP_PAYS' | 'SETTLED' = 'SETTLED';

    if (input.actionType === PaymentType.PAY_CUSTOMER) {
      balanceDelta = amount; // Reduces shop debt to customer
      settlementDirection = 'SHOP_PAYS';
    } else if (input.actionType === PaymentType.APPLY_CREDIT) {
      balanceDelta = 0; // Offsetting within ledger
      settlementDirection = 'SETTLED';
    } else {
      // RECEIVE_PAYMENT or SETTLE_DUE
      balanceDelta = -amount; // Reduces customer dues / creates credit
      settlementDirection = 'CUSTOMER_PAYS';
    }

    const newTxn = dbRepository.addTransaction({
      type: txType,
      status: txStatus,
      date: now,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerCode: customer.customerCode,
      grossAmount: amount,
      discountAmount: 0,
      netAmount: amount,
      paidAmount: amount,
      balanceDelta,
      settlementDirection,
      paymentStatus: 'PAID',
      items: [
        {
          id: `item-${Date.now()}`,
          transactionId: '',
          itemType: ItemType.CASH,
          direction: input.actionType === PaymentType.PAY_CUSTOMER ? ItemDirection.OUT : ItemDirection.IN,
          quantity: 1,
          unit: 'RUPEE',
          ratePerUnit: amount,
          totalAmount: amount,
          notes: input.notes || `${input.actionType} via ${mode}`,
        },
      ],
      notes: input.notes,
      description: `${input.actionType}: ${formatRupees(amount)} via ${mode}`,
      createdById: actor.id,
      createdByName: actor.name,
    });

    // 3. Create explicit, traceable Payment record
    let paymentStatus: PaymentStatus = PaymentStatus.PAID;
    if (preview.newDue > 0) {
      paymentStatus = PaymentStatus.PARTIAL;
    } else {
      paymentStatus = PaymentStatus.SETTLED;
    }

    const newPayment = dbRepository.addPayment({
      date: now,
      customerId: customer.id,
      customerName: customer.name,
      customerCode: customer.customerCode,
      transactionId: newTxn.id,
      transactionNumber: newTxn.transactionNumber,
      paymentType: input.actionType,
      amount,
      appliedToBillAmount: preview.amountAppliedToDue,
      creditCreatedAmount: preview.creditCreated,
      mode,
      status: paymentStatus,
      referenceNo: input.referenceNo,
      notes: input.notes,
      createdById: actor.id,
      createdByName: actor.name,
    });

    // 4. Generate Ledger Entries
    if (input.actionType === PaymentType.RECEIVE_PAYMENT || input.actionType === PaymentType.SETTLE_DUE) {
      if (preview.amountAppliedToDue > 0) {
        dbRepository.addLedgerEntry({
          customerId: customer.id,
          customerName: customer.name,
          transactionId: newTxn.id,
          transactionNumber: newTxn.transactionNumber,
          entryType: LedgerEntryType.CASH,
          amount: preview.amountAppliedToDue,
          unit: LedgerUnit.RUPEE,
          direction: LedgerDirection.IN,
          status: LedgerStatus.PAID,
          description: `Cash Payment Received (${formatRupees(preview.amountAppliedToDue)} applied to dues)`,
          date: now,
          createdById: actor.id,
          createdByName: actor.name,
          notes: input.notes,
        });
      }

      if (preview.creditCreated > 0) {
        dbRepository.addLedgerEntry({
          customerId: customer.id,
          customerName: customer.name,
          transactionId: newTxn.id,
          transactionNumber: newTxn.transactionNumber,
          entryType: LedgerEntryType.CASH,
          amount: preview.creditCreated,
          unit: LedgerUnit.RUPEE,
          direction: LedgerDirection.IN,
          status: LedgerStatus.CREDIT,
          description: `Customer Credit from Overpayment (${formatRupees(preview.creditCreated)} credited to khata)`,
          date: now,
          createdById: actor.id,
          createdByName: actor.name,
          notes: input.notes,
        });
      }
    } else if (input.actionType === PaymentType.PAY_CUSTOMER) {
      dbRepository.addLedgerEntry({
        customerId: customer.id,
        customerName: customer.name,
        transactionId: newTxn.id,
        transactionNumber: newTxn.transactionNumber,
        entryType: LedgerEntryType.CASH,
        amount,
        unit: LedgerUnit.RUPEE,
        direction: LedgerDirection.OUT,
        status: LedgerStatus.PAID,
        description: `Cash Paid to Customer (${formatRupees(amount)} out of available credit)`,
        date: now,
        createdById: actor.id,
        createdByName: actor.name,
        notes: input.notes,
      });
    } else if (input.actionType === PaymentType.APPLY_CREDIT) {
      // 1. Consume credit (Direction OUT, status PAID)
      dbRepository.addLedgerEntry({
        customerId: customer.id,
        customerName: customer.name,
        transactionId: newTxn.id,
        transactionNumber: newTxn.transactionNumber,
        entryType: LedgerEntryType.CASH,
        amount,
        unit: LedgerUnit.RUPEE,
        direction: LedgerDirection.OUT,
        status: LedgerStatus.PAID,
        description: `Customer Credit Applied to Dues (${formatRupees(amount)})`,
        date: now,
        createdById: actor.id,
        createdByName: actor.name,
        notes: input.notes,
      });

      // 2. Settle dues (Direction IN, status PAID)
      dbRepository.addLedgerEntry({
        customerId: customer.id,
        customerName: customer.name,
        transactionId: newTxn.id,
        transactionNumber: newTxn.transactionNumber,
        entryType: LedgerEntryType.CASH,
        amount,
        unit: LedgerUnit.RUPEE,
        direction: LedgerDirection.IN,
        status: LedgerStatus.PAID,
        description: `Dues Cleared via Credit Offset (${formatRupees(amount)})`,
        date: now,
        createdById: actor.id,
        createdByName: actor.name,
        notes: input.notes,
      });
    }

    // 5. If target transaction was specified, update its status
    if (input.targetTransactionId) {
      const targetTx = dbRepository.getTransactionById(input.targetTransactionId);
      if (targetTx) {
        const remainingDelta = Math.max(0, roundCurrency(targetTx.balanceDelta - preview.amountAppliedToDue));
        targetTx.balanceDelta = remainingDelta;
        targetTx.paidAmount = roundCurrency(targetTx.paidAmount + preview.amountAppliedToDue);
        if (remainingDelta === 0) {
          targetTx.paymentStatus = 'PAID';
        } else {
          targetTx.paymentStatus = 'PARTIAL';
        }
        dbRepository.saveTransaction(targetTx);
      }
    }

    // 6. Recalculate customer balances and update cache
    const updatedBalances = LedgerService.calculateCustomerBalances(customer.id);
    customer.currentDueAmount = updatedBalances.cashDueAmount;
    customer.lastTransactionAt = now;
    dbRepository.updateCustomer(customer.id, customer);

    // 7. Non-destructive Audit Log
    AuditService.log({
      action: AuditAction.CREATE,
      entityType: 'PAYMENT',
      entityId: newPayment.id,
      performedById: actor.id,
      performedByName: actor.name,
      reason: `${input.actionType} of ${formatRupees(amount)} recorded for ${customer.name}. New Due: ${formatRupees(updatedBalances.cashDueAmount)}, New Credit: ${formatRupees(updatedBalances.cashCreditAmount)}`,
      newState: {
        paymentId: newPayment.id,
        receiptNumber: newPayment.receiptNumber,
        transactionNumber: newTxn.transactionNumber,
        amount,
        mode,
        actionType: input.actionType,
        appliedToDue: preview.amountAppliedToDue,
        creditCreated: preview.creditCreated,
        updatedDue: updatedBalances.cashDueAmount,
        updatedCredit: updatedBalances.cashCreditAmount,
      },
    });

    return {
      success: true,
      payment: newPayment,
      transaction: newTxn,
      newBalances: updatedBalances,
      message: `Successfully processed ${input.actionType.replace(/_/g, ' ')} of ${formatRupees(amount)}.`,
    };
  }

  /**
   * Fetch all payments for a specific customer
   */
  public static getCustomerPayments(customerId: string): Payment[] {
    const all = dbRepository.getPayments();
    return all
      .filter((p) => p.customerId === customerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Fetch all payments across system with filtering
   */
  public static getAllPayments(filters?: {
    customerId?: string;
    mode?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Payment[] {
    let list = dbRepository.getPayments();

    if (filters?.customerId) {
      list = list.filter((p) => p.customerId === filters.customerId);
    }
    if (filters?.mode && filters.mode !== 'ALL') {
      list = list.filter((p) => p.mode === filters.mode);
    }
    if (filters?.type && filters.type !== 'ALL') {
      list = list.filter((p) => p.paymentType === filters.type);
    }
    if (filters?.startDate) {
      const start = new Date(filters.startDate).getTime();
      list = list.filter((p) => new Date(p.date).getTime() >= start);
    }
    if (filters?.endDate) {
      const end = new Date(filters.endDate).getTime();
      list = list.filter((p) => new Date(p.date).getTime() <= end);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.receiptNumber.toLowerCase().includes(q) ||
          p.customerName?.toLowerCase().includes(q) ||
          p.customerCode?.toLowerCase().includes(q) ||
          p.notes?.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Fetch pending dues transactions for a customer
   */
  public static getPendingTransactions(customerId: string): Transaction[] {
    const txs = dbRepository.getCustomerTransactions(customerId);
    return txs.filter((t) => t.balanceDelta > 0 && t.status !== TransactionStatus.CANCELLED);
  }

  /**
   * Non-destructive payment correction:
   * - Preserves the original payment receipt (marked CORRECTED)
   * - Spawns a compensating adjustment receipt for the difference
   * - Posts compensating cash ledger entries
   * - Updates customer khata balances atomically
   * - Records PAYMENT_UPDATED in the immutable audit log
   */
  public static correctPayment(
    paymentId: string,
    newAmount: number,
    reason: string,
    actor: { id: string; name: string; role: UserRole }
  ): { original: Payment; adjustmentPayment: Payment; summary: string } {
    if (!hasPermission(actor.role, Permission.CORRECT_TRANSACTION)) {
      throw new Error(
        'Unauthorized: Your role does not possess permission to correct financial payments. Only Owner or Accountant can perform corrections.'
      );
    }

    if (!reason || reason.trim().length < 4) {
      throw new Error('A mandatory, detailed reason (minimum 4 characters) is required for payment correction.');
    }

    if (typeof newAmount !== 'number' || newAmount < 0 || isNaN(newAmount)) {
      throw new Error('Corrected payment amount must be a valid non-negative number.');
    }

    const allPayments = dbRepository.getPayments();
    const payment = allPayments.find((p) => p.id === paymentId || p.receiptNumber === paymentId);
    if (!payment) {
      throw new Error(`Payment receipt ${paymentId} not found.`);
    }

    if (payment.status === PaymentStatus.REVERSED) {
      throw new Error('Cannot correct a reversed payment receipt.');
    }

    const originalAmount = payment.amount;
    const diff = roundCurrency(newAmount - originalAmount);
    if (diff === 0) {
      throw new Error('No difference in payment amount. Please enter a different amount.');
    }

    const now = new Date().toISOString();

    // 1. Mark original payment as CORRECTED
    payment.status = PaymentStatus.CORRECTED;
    payment.correctionReason = reason;
    payment.correctedAt = now;
    payment.correctedById = actor.id;
    payment.correctedByName = actor.name;

    // 2. Spawn compensating adjustment payment receipt
    const isIncrease = diff > 0;
    const adjReceiptNumber = `RCT-ADJ-${Date.now().toString().slice(-6)}`;
    const adjustmentPayment = dbRepository.addPayment({
      date: now,
      customerId: payment.customerId,
      customerName: payment.customerName,
      customerCode: payment.customerCode,
      transactionId: payment.transactionId,
      transactionNumber: payment.transactionNumber,
      paymentType: payment.paymentType,
      amount: Math.abs(diff),
      mode: payment.mode,
      status: PaymentStatus.SETTLED,
      isCorrectionOfReceipt: payment.receiptNumber,
      correctionReason: reason,
      notes: `Adjustment (${isIncrease ? '+' : '-'}₹${Math.abs(diff)}) for receipt ${payment.receiptNumber}. Reason: ${reason}`,
      createdById: actor.id,
      createdByName: actor.name,
    });

    // 3. Post compensating cash ledger entry
    const customer = dbRepository.getCustomerById(payment.customerId);
    if (customer) {
      dbRepository.addLedgerEntry({
        customerId: customer.id,
        customerName: customer.name,
        transactionId: adjustmentPayment.id,
        transactionNumber: adjustmentPayment.receiptNumber,
        entryType: LedgerEntryType.CASH,
        amount: Math.abs(diff),
        unit: LedgerUnit.RUPEE,
        direction: isIncrease ? LedgerDirection.IN : LedgerDirection.OUT,
        status: isIncrease ? LedgerStatus.PAID : LedgerStatus.DUE,
        description: `Payment Correction for ${payment.receiptNumber} (${isIncrease ? '+' : '-'}₹${Math.abs(diff)} adjustment)`,
        date: now.split('T')[0],
        createdById: actor.id,
        createdByName: actor.name,
        notes: reason,
      });

      // Synchronize customer balances
      const updatedBalance = LedgerService.calculateCustomerBalances(customer.id);
      dbRepository.updateCustomer(customer.id, {
        currentDueAmount: updatedBalance.cashDueAmount,
        lastTransactionAt: now,
      });
    }

    // 4. Update linked transaction if any
    if (payment.transactionId) {
      const targetTx = dbRepository.getTransactionById(payment.transactionId);
      if (targetTx) {
        targetTx.paidAmount = roundCurrency(targetTx.paidAmount + diff);
        targetTx.balanceDelta = roundCurrency(targetTx.balanceDelta - diff);
        targetTx.paymentStatus = targetTx.balanceDelta <= 0 ? 'PAID' : 'PARTIAL';
        dbRepository.saveTransaction(targetTx);
      }
    }

    // 5. Immutable Audit Log
    AuditService.log({
      action: AuditAction.PAYMENT_UPDATED,
      entityType: 'PAYMENT',
      entityId: payment.id,
      entityReference: payment.receiptNumber,
      performedById: actor.id,
      performedByName: actor.name,
      reason,
      previousState: {
        amount: originalAmount,
        receiptNumber: payment.receiptNumber,
        status: 'PAID',
      },
      newState: {
        originalReceipt: payment.receiptNumber,
        effectiveAmount: newAmount,
        delta: diff,
        adjustmentReceipt: adjustmentPayment.receiptNumber,
        reason,
      },
    });

    return {
      original: payment,
      adjustmentPayment,
      summary: `Payment ${payment.receiptNumber} corrected: Original ₹${originalAmount}, Adjustment ${isIncrease ? '+' : '-'}₹${Math.abs(diff)}, Effective ₹${newAmount}.`,
    };
  }

  /**
   * Non-destructive payment reversal
   */
  public static reversePayment(
    paymentId: string,
    reason: string,
    actor: { id: string; name: string; role: UserRole }
  ): { reversedPayment: Payment; summary: string } {
    if (!hasPermission(actor.role, Permission.REVERSE_TRANSACTION)) {
      throw new Error(
        'Unauthorized: Your role does not possess permission to reverse payments. Only Owner or Accountant can perform reversals.'
      );
    }

    if (!reason || reason.trim().length < 4) {
      throw new Error('A mandatory reason (minimum 4 characters) is required for payment reversal.');
    }

    const allPayments = dbRepository.getPayments();
    const payment = allPayments.find((p) => p.id === paymentId || p.receiptNumber === paymentId);
    if (!payment) {
      throw new Error(`Payment receipt ${paymentId} not found.`);
    }

    if (payment.status === PaymentStatus.REVERSED) {
      throw new Error('This payment receipt has already been reversed.');
    }

    const now = new Date().toISOString();
    const originalAmount = payment.amount;

    // 1. Mark as REVERSED
    payment.status = PaymentStatus.REVERSED;
    payment.reversalReason = reason;
    payment.reversalDate = now;
    payment.reversedById = actor.id;
    payment.reversedByName = actor.name;

    // 2. Post opposite ledger entry
    const customer = dbRepository.getCustomerById(payment.customerId);
    if (customer) {
      dbRepository.addLedgerEntry({
        customerId: customer.id,
        customerName: customer.name,
        transactionId: payment.id,
        transactionNumber: `REV-${payment.receiptNumber}`,
        entryType: LedgerEntryType.CASH,
        amount: originalAmount,
        unit: LedgerUnit.RUPEE,
        direction: LedgerDirection.OUT,
        status: LedgerStatus.REVERSED,
        description: `Reversal of Payment ${payment.receiptNumber} (₹${originalAmount}) - Reason: ${reason}`,
        date: now.split('T')[0],
        createdById: actor.id,
        createdByName: actor.name,
        notes: reason,
      });

      const updatedBalance = LedgerService.calculateCustomerBalances(customer.id);
      dbRepository.updateCustomer(customer.id, {
        currentDueAmount: updatedBalance.cashDueAmount,
        lastTransactionAt: now,
      });
    }

    // 3. Revert linked transaction if any
    if (payment.transactionId) {
      const targetTx = dbRepository.getTransactionById(payment.transactionId);
      if (targetTx) {
        targetTx.paidAmount = roundCurrency(Math.max(0, targetTx.paidAmount - originalAmount));
        targetTx.balanceDelta = roundCurrency(targetTx.balanceDelta + originalAmount);
        targetTx.paymentStatus = 'PENDING';
        dbRepository.saveTransaction(targetTx);
      }
    }

    // 4. Audit Log
    AuditService.log({
      action: AuditAction.PAYMENT_UPDATED,
      entityType: 'PAYMENT',
      entityId: payment.id,
      entityReference: payment.receiptNumber,
      performedById: actor.id,
      performedByName: actor.name,
      reason: `Reversed payment: ${reason}`,
      previousState: { amount: originalAmount, status: 'PAID' },
      newState: { status: PaymentStatus.REVERSED, reversalReason: reason },
    });

    return {
      reversedPayment: payment,
      summary: `Payment ${payment.receiptNumber} (₹${originalAmount}) successfully reversed.`,
    };
  }
}

