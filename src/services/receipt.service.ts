import jsPDF from 'jspdf';
import { BUSINESS_INFO } from '../config/business.config';
import { dbRepository } from '../db/in-memory-db';
import {
  Customer,
  CustomerStatement,
  Payment,
  PaymentMode,
  PaymentType,
  Transaction,
  TransactionItem,
  TransactionStatus,
  TransactionType,
} from '../types';
import { LedgerService } from './ledger.service';

export interface ReceiptLine {
  label: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  amount?: number;
  detail?: string;
}

export interface ReceiptSection {
  title: string;
  rows: Array<{ label: string; value: string; emphasis?: boolean }>;
}

export interface ReceiptViewModel {
  referenceNumber: string;
  title: string;
  businessName: string;
  tagline: string;
  date: string;
  time: string;
  customer?: { name: string; code?: string; phone?: string };
  status: string;
  statusTone: 'normal' | 'warning' | 'danger';
  lines: ReceiptLine[];
  sections: ReceiptSection[];
  notes?: string;
  footer: string;
  fileName: string;
}

const money = (value = 0) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const quantity = (value = 0) => value.toLocaleString('en-IN', { maximumFractionDigits: 3 });
const pretty = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/(^| )\S/g, (letter) => letter.toUpperCase());
const dateText = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const timeText = (value: string) => new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
const fileSafe = (value: string) => value.replace(/[^a-z0-9-_]/gi, '-');

function customerFor(transaction: Transaction): Customer | undefined {
  return transaction.customerId ? dbRepository.getCustomerById(transaction.customerId) : undefined;
}

function itemLabel(item: TransactionItem): string {
  return pretty(String(item.attaType || item.grainType || item.itemType || 'Item'));
}

function paymentStatus(transaction: Transaction): string {
  if (transaction.status === TransactionStatus.REVERSED) return 'REVERSED';
  if (transaction.status === TransactionStatus.CORRECTED) return 'CORRECTED';
  return String(transaction.paymentStatus || transaction.status || 'RECORDED');
}

function statusTone(status: string): ReceiptViewModel['statusTone'] {
  return status === 'REVERSED' ? 'danger' : status === 'PARTIAL' || status === 'DUE' ? 'warning' : 'normal';
}

export function buildTransactionReceiptData(transactionId: string): ReceiptViewModel | undefined {
  const transaction = dbRepository.getTransactionById(transactionId);
  if (!transaction) return undefined;

  const customer = customerFor(transaction);
  const status = paymentStatus(transaction);
  const lines = (transaction.items || []).map((item) => ({
    label: itemLabel(item),
    quantity: item.quantity,
    unit: String(item.unit).toLowerCase(),
    rate: item.ratePerUnit,
    amount: item.totalAmount,
    detail: item.notes,
  }));
  const sections: ReceiptSection[] = [];
  const balance = Math.abs(transaction.balanceDelta || 0);

  if (transaction.type === TransactionType.WHEAT_ATTA_EXCHANGE) {
    const wheat = transaction.items.find((item) => String(item.grainType || item.itemType).includes('WHEAT'));
    const atta = transaction.items.find((item) => String(item.grainType || item.itemType).includes('ATTA')) || transaction.items[0];
    sections.push({ title: 'Exchange', rows: [
      { label: 'Wheat received', value: wheat ? `${quantity(wheat.quantity)} ${String(wheat.unit).toLowerCase()}` : 'Stored in transaction items' },
      { label: 'Atta type', value: atta ? itemLabel(atta) : 'Atta' },
      { label: 'Applied exchange rate', value: atta ? `${money(atta.ratePerUnit)}/${String(atta.unit).toLowerCase()}` : '-' },
      { label: 'Atta given', value: atta ? `${quantity(atta.quantity)} ${String(atta.unit).toLowerCase()}` : '-' },
    ] });
  } else if (transaction.type === TransactionType.RICE_ATTA_SETTLEMENT) {
    const rice = transaction.items.find((item) => String(item.grainType || item.itemType).includes('RICE'));
    const atta = transaction.items.find((item) => String(item.grainType || item.itemType).includes('ATTA'));
    sections.push({ title: 'Settlement', rows: [
      { label: 'Rice value', value: rice ? money(rice.totalAmount) : '-' },
      { label: 'Atta value', value: atta ? money(atta.totalAmount) : '-' },
      { label: transaction.settlementDirection === 'CUSTOMER_RECEIVES' ? 'Customer receives' : transaction.settlementDirection === 'CUSTOMER_PAYS' ? 'Customer pays' : 'Settlement', value: balance ? money(balance) : 'Settled exactly', emphasis: true },
    ] });
  } else if (transaction.type === TransactionType.RICE_CASH_SETTLEMENT || transaction.type === TransactionType.WHEAT_CASH_SETTLEMENT || transaction.type === TransactionType.ATTA_PURCHASE) {
    sections.push({ title: 'Payment', rows: [
      { label: 'Bill', value: money(transaction.netAmount), emphasis: true },
      { label: 'Paid', value: money(transaction.paidAmount) },
      ...(transaction.paidAmount > transaction.netAmount ? [{ label: 'Customer credit', value: money(transaction.paidAmount - transaction.netAmount), emphasis: true }] : []),
      ...(balance > 0 ? [{ label: 'Remaining', value: money(balance), emphasis: true }] : []),
    ] });
  }

  if (transaction.type === TransactionType.CASH_PAYMENT) {
    const linkedPayment = dbRepository.getPayments().find((payment) => payment.transactionId === transaction.id);
    sections.push({ title: 'Payment', rows: [
      { label: 'Payment type', value: pretty(String(linkedPayment?.paymentType || 'Payment')) },
      { label: 'Amount', value: money(linkedPayment?.amount || transaction.paidAmount), emphasis: true },
      { label: 'Payment method', value: pretty(String(linkedPayment?.mode || PaymentMode.CASH)) },
      ...(linkedPayment?.appliedToBillAmount !== undefined ? [{ label: 'Applied to bill', value: money(linkedPayment.appliedToBillAmount) }] : []),
      ...(linkedPayment?.creditCreatedAmount ? [{ label: 'Credit created', value: money(linkedPayment.creditCreatedAmount), emphasis: true }] : []),
    ] });
  }

  if (!sections.length) {
    sections.push({ title: 'Summary', rows: [
      { label: 'Net amount', value: money(transaction.netAmount), emphasis: true },
      { label: 'Paid', value: money(transaction.paidAmount) },
      ...(balance ? [{ label: transaction.balanceDelta < 0 ? 'Customer receives' : 'Remaining', value: money(balance), emphasis: true }] : []),
    ] });
  }

  if (transaction.status === TransactionStatus.CORRECTED) {
    sections.push({ title: 'Correction', rows: [
      { label: 'Status', value: 'CORRECTED', emphasis: true },
      ...(transaction.correctionReason ? [{ label: 'Reason', value: transaction.correctionReason }] : []),
      ...(transaction.netCorrectionDiff ? [{ label: 'Adjustment', value: transaction.netCorrectionDiff }] : []),
    ] });
  }
  if (transaction.status === TransactionStatus.REVERSED) {
    sections.push({ title: 'Reversal', rows: [
      { label: 'Status', value: 'REVERSED TRANSACTION', emphasis: true },
      ...(transaction.reversalReason ? [{ label: 'Reason', value: transaction.reversalReason }] : []),
    ] });
  }

  return {
    referenceNumber: transaction.transactionNumber,
    title: `${pretty(transaction.type)} Receipt`,
    businessName: BUSINESS_INFO.name,
    tagline: BUSINESS_INFO.tagline,
    date: dateText(transaction.date),
    time: timeText(transaction.createdAt || transaction.date),
    customer: customer || (transaction.customerName ? { name: transaction.customerName, code: transaction.customerCode, phone: transaction.customerPhone } : undefined),
    status,
    statusTone: statusTone(status),
    lines,
    sections,
    notes: transaction.notes,
    footer: 'Computer-generated receipt. Thank you for your business.',
    fileName: `ChakkiLedger-${fileSafe(transaction.transactionNumber)}.pdf`,
  };
}

export function buildPaymentReceiptData(paymentId: string): ReceiptViewModel | undefined {
  const payment = dbRepository.getPayments().find((item) => item.id === paymentId || item.receiptNumber === paymentId);
  if (!payment) return undefined;
  const customer = dbRepository.getCustomerById(payment.customerId);
  const status = String(payment.status || 'PAID');
  const previous = payment.amount - (payment.appliedToBillAmount || 0);
  return {
    referenceNumber: payment.receiptNumber,
    title: 'Payment Receipt',
    businessName: BUSINESS_INFO.name,
    tagline: BUSINESS_INFO.tagline,
    date: dateText(payment.date),
    time: timeText(payment.createdAt || payment.date),
    customer: customer || { name: payment.customerName || 'Customer', code: payment.customerCode },
    status,
    statusTone: status === 'REVERSED' ? 'danger' : status === 'PARTIAL' ? 'warning' : 'normal',
    lines: [{ label: 'Payment', quantity: 1, unit: 'receipt', rate: payment.amount, amount: payment.amount }],
    sections: [{ title: 'Payment', rows: [
      { label: 'Payment type', value: pretty(String(payment.paymentType || PaymentType.RECEIVE_PAYMENT)), emphasis: true },
      { label: payment.paymentType === PaymentType.PAY_CUSTOMER ? 'Paid to customer' : 'Received from customer', value: money(payment.amount), emphasis: true },
      { label: 'Payment method', value: pretty(String(payment.mode || PaymentMode.CASH)) },
      ...(payment.appliedToBillAmount !== undefined ? [{ label: 'Applied to bill', value: money(payment.appliedToBillAmount) }] : []),
      ...(payment.creditCreatedAmount || previous > 0 ? [{ label: 'Customer credit', value: money(payment.creditCreatedAmount || previous), emphasis: true }] : []),
      ...(payment.transactionNumber ? [{ label: 'Related transaction', value: payment.transactionNumber }] : []),
    ] }],
    notes: payment.notes,
    footer: 'Computer-generated receipt. Thank you for your business.',
    fileName: `ChakkiLedger-${fileSafe(payment.receiptNumber)}.pdf`,
  };
}

export function downloadReceiptPdf(receipt: ReceiptViewModel): void {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;
  const line = (label: string, value: string, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.text(label, 18, y);
    pdf.text(value, 190, y, { align: 'right' });
    y += 7;
  };
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(receipt.businessName, 18, y);
  y += 7;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(receipt.tagline, 18, y);
  y += 10;
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.text(receipt.title, 18, y);
  y += 8;
  pdf.setFontSize(10);
  line('Transaction / Receipt No.', receipt.referenceNumber, true);
  line('Date', `${receipt.date} ${receipt.time}`);
  if (receipt.customer) {
    line('Customer', receipt.customer.name, true);
    if (receipt.customer.code) line('Customer ID', receipt.customer.code);
    if (receipt.customer.phone) line('Phone', receipt.customer.phone);
  }
  line('Status', receipt.status, true);
  y += 3;
  pdf.line(18, y, 190, y);
  y += 8;
  if (receipt.lines.length) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Items', 18, y);
    y += 7;
    receipt.lines.forEach((item) => {
      const detail = item.quantity !== undefined ? `${quantity(item.quantity)} ${item.unit || ''}` : '';
      line(item.label, `${detail}${item.rate !== undefined ? ` @ ${money(item.rate)}` : ''}  ${item.amount !== undefined ? money(item.amount) : ''}`);
    });
  }
  receipt.sections.forEach((section) => {
    y += 3;
    pdf.setFont('helvetica', 'bold');
    pdf.text(section.title, 18, y);
    y += 7;
    section.rows.forEach((row) => line(row.label, row.value, row.emphasis));
  });
  if (receipt.notes) {
    y += 3;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Notes', 18, y);
    y += 7;
    pdf.setFont('helvetica', 'normal');
    const noteLines = pdf.splitTextToSize(receipt.notes, 172);
    pdf.text(noteLines, 18, y);
    y += noteLines.length * 5;
  }
  pdf.setFont('helvetica', 'italic');
  pdf.text(receipt.footer, 18, Math.min(y + 12, 280));
  pdf.save(receipt.fileName);
}

export function downloadStatementPdf(statement: CustomerStatement): void {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(BUSINESS_INFO.name, 18, y);
  y += 7;
  pdf.setFontSize(13);
  pdf.text('Customer Statement', 18, y);
  y += 8;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Customer: ${statement.customer.name} (${statement.customer.customerCode})`, 18, y);
  y += 6;
  pdf.text(`Period: ${statement.periodLabel}`, 18, y);
  y += 9;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Summary', 18, y);
  y += 7;
  pdf.setFont('helvetica', 'normal');
  const summaryRows = [
    ['Total Wheat', `${statement.summary.totalWheatInKg} kg`],
    ['Total Rice', `${statement.summary.totalRiceInKg} kg`],
    ['Total Atta', `${statement.summary.totalAttaInKg} kg`],
    ['Cash Paid', money(statement.summary.totalCashOutAmount)],
    ['Cash Received', money(statement.summary.totalCashInAmount)],
    ['Customer Credit', money(statement.summary.netCashCreditAmount)],
    ['Customer Due', money(statement.summary.netCashDueAmount)],
  ];
  summaryRows.forEach(([label, value]) => { pdf.text(label, 18, y); pdf.text(value, 190, y, { align: 'right' }); y += 6; });
  y += 5;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Transaction history', 18, y);
  y += 7;
  pdf.setFont('helvetica', 'normal');
  statement.entries.slice(0, 35).forEach((entry) => {
    const text = `${dateText(entry.date)}  ${entry.transactionNumber || entry.transactionId}  ${entry.description}`;
    const wrapped = pdf.splitTextToSize(text, 172);
    if (y > 275) { pdf.addPage(); y = 18; }
    pdf.text(wrapped, 18, y);
    y += wrapped.length * 5;
  });
  pdf.save(`ChakkiLedger-Statement-${fileSafe(statement.customer.customerCode)}-${new Date().toISOString().slice(0, 7)}.pdf`);
}

export function getStatementForCustomer(customerId: string): CustomerStatement {
  return LedgerService.getCustomerStatement(customerId, { preset: 'ALL' });
}
