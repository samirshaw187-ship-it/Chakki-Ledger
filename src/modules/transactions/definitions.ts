/**
 * Chakki Ledger - Transaction Type Definitions & Form Engine Schemas
 *
 * Central architecture for all 14 transaction types:
 * - Label, category, visual icons and descriptions
 * - Role-based permissions
 * - Dynamic fields configuration
 * - Safe calculation engine
 * - Ledger effects mapping
 */

import {
  TransactionType,
  UserRole,
  GrainType,
  AttaType,
  GrainUnit,
  LedgerEntry,
  LedgerEntryType,
  LedgerDirection,
  LedgerStatus,
  LedgerUnit,
  Transaction,
  RateConfiguration,
  ItemType,
  ItemDirection,
  SettlementDirection,
  SettlementPaymentStatus,
} from '../../types';
import { roundCurrency, roundQuantity, safeMultiply, safeSubtract, safeAdd, formatRupees, formatKg } from '../../utils/precision';
import { GrainCashSettlementService } from '../../services/grain-cash-settlement.service';

export interface TransactionItemInput {
  itemType: ItemType | string;
  direction: ItemDirection | 'IN' | 'OUT';
  grainType?: GrainType;
  attaType?: AttaType;
  quantity: number;
  unit: GrainUnit | 'KG' | 'RUPEE';
  ratePerUnit: number;
  totalAmount: number;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface CalculatedTransactionSummary {
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount: number;
  balanceDelta: number; // positive = customer owes shop, negative = shop owes customer
  settlementDirection: SettlementDirection;
  settlementText: string;
  itemsSummary: string;
  detailedLines: Array<{
    label: string;
    subtext?: string;
    amount?: number;
    quantity?: number;
    unit?: string;
    rate?: number;
    isHighlight?: boolean;
    type?: 'in' | 'out' | 'summary';
  }>;
}

export interface TransactionFieldDefinition {
  name: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'radio' | 'items_table';
  placeholder?: string;
  required?: boolean;
  min?: number;
  step?: number;
  unit?: string;
  options?: Array<{ label: string; value: string }>;
}

export interface TransactionDefinition {
  type: TransactionType;
  label: string;
  shortLabel: string;
  category: 'milling' | 'trading' | 'khata' | 'adjustment' | 'business';
  description: string;
  iconName: string;
  colorTheme: {
    bg: string;
    text: string;
    border: string;
    badge: string;
  };
  requiresCustomer: boolean;
  allowedRoles: UserRole[];
  fields: TransactionFieldDefinition[];
  getDefaultItems: (rates: RateConfiguration) => TransactionItemInput[];
  calculate: (items: TransactionItemInput[], paidAmount?: number, notes?: string) => CalculatedTransactionSummary;
  buildLedgerEntries: (
    transaction: Transaction,
    customerName?: string
  ) => Array<Omit<LedgerEntry, 'id' | 'createdAt'>>;
}

/**
 * Registry of Transaction Definitions
 */
export const TRANSACTION_DEFINITIONS: Record<TransactionType, TransactionDefinition> = {
  // 1. WHEAT_DEPOSIT
  [TransactionType.WHEAT_DEPOSIT]: {
    type: TransactionType.WHEAT_DEPOSIT,
    label: 'Wheat Deposit',
    shortLabel: 'Wheat Deposit',
    category: 'milling',
    description: 'Customer deposits raw wheat grain for storage and future milling',
    iconName: 'Scale',
    colorTheme: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    },
    requiresCustomer: true,
    allowedRoles: [UserRole.OWNER, UserRole.ADMIN],
    fields: [
      { name: 'quantity', label: 'Wheat Quantity', type: 'number', placeholder: 'e.g. 50', unit: 'kg', min: 0.1, step: 0.1, required: true },
      { name: 'notes', label: 'Bag Marks / Notes', type: 'text', placeholder: 'e.g. 1 bag marked RS' },
    ],
    getDefaultItems: () => [
      {
        itemType: ItemType.WHEAT,
        direction: ItemDirection.IN,
        grainType: GrainType.WHEAT,
        quantity: 50,
        unit: GrainUnit.KG,
        ratePerUnit: 0,
        totalAmount: 0,
        notes: 'Wheat deposit for milling',
      },
    ],
    calculate: (items) => {
      const wheatItem = items[0] || { quantity: 0, ratePerUnit: 0, totalAmount: 0 };
      const qty = roundQuantity(wheatItem.quantity || 0);
      return {
        grossAmount: 0,
        discountAmount: 0,
        netAmount: 0,
        paidAmount: 0,
        balanceDelta: 0,
        settlementDirection: 'SETTLED',
        settlementText: `Added ${formatKg(qty)} wheat to customer account`,
        itemsSummary: `${formatKg(qty)} Wheat Deposited`,
        detailedLines: [
          { label: 'Wheat Inflow', quantity: qty, unit: 'kg', type: 'in' },
          { label: 'Account Impact', subtext: `+${formatKg(qty)} available in mill grain balance`, isHighlight: true },
        ],
      };
    },
    buildLedgerEntries: (tx, customerName) => {
      const item = tx.items[0];
      const qty = item ? item.quantity : 0;
      if (!tx.customerId) return [];
      return [
        {
          customerId: tx.customerId,
          customerName: customerName || tx.customerName,
          transactionId: tx.id,
          transactionNumber: tx.transactionNumber,
          entryType: LedgerEntryType.WHEAT,
          quantity: qty,
          unit: LedgerUnit.KG,
          rate: 0,
          amount: 0,
          direction: LedgerDirection.IN,
          status: LedgerStatus.SETTLED,
          description: `Wheat Deposit (${formatKg(qty)})`,
          date: tx.date,
          createdById: tx.createdById,
          createdByName: tx.createdByName,
          notes: tx.notes || item?.notes,
        },
      ];
    },
  },

  // 2. WHEAT_ATTA_EXCHANGE
  [TransactionType.WHEAT_ATTA_EXCHANGE]: {
    type: TransactionType.WHEAT_ATTA_EXCHANGE,
    label: 'Wheat → Atta Exchange',
    shortLabel: 'Wheat → Atta',
    category: 'milling',
    description: 'Exchange brought wheat for milled flour (Chali or Roll Atta) at configured service rates',
    iconName: 'Wheat',
    colorTheme: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-900 border-amber-300',
    },
    requiresCustomer: true,
    allowedRoles: [UserRole.OWNER, UserRole.ADMIN],
    fields: [
      {
        name: 'attaType',
        label: 'Atta Type',
        type: 'select',
        options: [
          { label: 'Roll Atta (Fine Flour) - ₹10/kg', value: AttaType.ROLL_ATTA },
          { label: 'Chali Atta (Coarse Flour) - ₹8/kg', value: AttaType.CHALI_ATTA },
        ],
        required: true,
      },
      { name: 'quantity', label: 'Wheat Quantity', type: 'number', placeholder: 'e.g. 15', unit: 'kg', min: 0.1, step: 0.1, required: true },
      { name: 'ratePerUnit', label: 'Applied Exchange Rate', type: 'number', placeholder: 'Rate per kg', unit: '₹/kg', required: true },
      { name: 'paidAmount', label: 'Cash Paid Now', type: 'number', placeholder: '0.00', unit: '₹' },
    ],
    getDefaultItems: (rates) => {
      const rollRate = rates.rollAttaExchangeRate || 10.0;
      const conversionRatio = rates.wheatToAttaConversionRatio || 1.0;
      const defaultWheatQty = 15;
      const defaultAttaQty = roundQuantity(defaultWheatQty * conversionRatio);
      return [
        {
          itemType: ItemType.WHEAT,
          direction: ItemDirection.IN,
          grainType: GrainType.WHEAT,
          quantity: defaultWheatQty,
          unit: GrainUnit.KG,
          ratePerUnit: rollRate,
          totalAmount: 0,
          notes: 'Wheat received for atta exchange',
        },
        {
          itemType: ItemType.ATTA,
          direction: ItemDirection.OUT,
          grainType: GrainType.ROLL_ATTA,
          attaType: AttaType.ROLL_ATTA,
          quantity: defaultAttaQty,
          unit: GrainUnit.KG,
          ratePerUnit: rollRate,
          totalAmount: safeMultiply(defaultWheatQty, rollRate),
          notes: 'Roll Atta given in exchange',
        },
      ];
    },
    calculate: (items, paid = 0) => {
      // Look for wheat inflow item and atta outflow item
      const wheatItem = items.find((i) => i.direction === ItemDirection.IN || i.itemType === ItemType.WHEAT) || items[0];
      const attaItem = items.find((i) => i.direction === ItemDirection.OUT || i.itemType === ItemType.ATTA) || items[1] || items[0];

      const wheatQty = roundQuantity(wheatItem?.quantity || 0);
      const appliedRate = roundCurrency(attaItem?.ratePerUnit || wheatItem?.ratePerUnit || 10);
      const isChali = (attaItem as any)?.attaType === AttaType.CHALI_ATTA || (attaItem as any)?.grainType === GrainType.CHALI_ATTA;
      const attaTypeName = isChali ? 'Chali Atta' : 'Roll Atta';

      // Configured 1:1 or custom ratio
      const attaQty = roundQuantity(attaItem?.quantity || wheatQty);

      // Exchange Value = Wheat Quantity (kg) × Applied Exchange Rate (₹/kg)
      const gross = safeMultiply(wheatQty, appliedRate);
      const paidAmt = roundCurrency(paid || 0);
      const due = safeSubtract(gross, paidAmt);

      const isSettled = due === 0;
      const direction = due > 0 ? 'CUSTOMER_PAYS' : 'SETTLED';
      const settlementText = isSettled
        ? `Fully Settled (${formatRupees(gross)} paid in full)`
        : `Milling fee ${formatRupees(gross)}. Paid ${formatRupees(paidAmt)}. Remaining Due: ${formatRupees(due)}`;

      const itemsSummary = `${formatKg(wheatQty)} Wheat → ${formatKg(attaQty)} ${attaTypeName} @ ₹${appliedRate}/kg`;

      return {
        grossAmount: gross,
        discountAmount: 0,
        netAmount: gross,
        paidAmount: paidAmt,
        balanceDelta: due,
        settlementDirection: direction,
        settlementText,
        itemsSummary,
        detailedLines: [
          { label: 'Wheat Received', quantity: wheatQty, unit: 'kg', type: 'in' },
          { label: `${attaTypeName} Given`, quantity: attaQty, unit: 'kg', rate: appliedRate, amount: gross, type: 'out' },
          { label: 'Calculated Exchange Value', amount: gross, isHighlight: true },
          { label: 'Cash Paid by Customer', amount: paidAmt, type: 'in' },
          { label: isSettled ? 'Settlement Status' : 'Net Khata Due Added', amount: due, isHighlight: due > 0, subtext: isSettled ? 'Zero outstanding balance' : undefined },
        ],
      };
    },
    buildLedgerEntries: (tx, customerName) => {
      if (!tx.customerId) return [];
      const wheatItem = tx.items.find((i) => i.direction === ItemDirection.IN || i.itemType === ItemType.WHEAT) || tx.items[0];
      const attaItem = tx.items.find((i) => i.direction === ItemDirection.OUT || i.itemType === ItemType.ATTA) || tx.items[1] || tx.items[0];

      const wheatQty = roundQuantity(wheatItem?.quantity || 0);
      const appliedRate = roundCurrency(attaItem?.ratePerUnit || wheatItem?.ratePerUnit || 10);
      const isChali = (attaItem as any)?.attaType === AttaType.CHALI_ATTA || (attaItem as any)?.grainType === GrainType.CHALI_ATTA;
      const attaTypeName = isChali ? 'Chali Atta' : 'Roll Atta';
      const attaQty = roundQuantity(attaItem?.quantity || wheatQty);

      const entries: Array<Omit<LedgerEntry, 'id' | 'createdAt'>> = [];

      // Exchange consumes wheat already deposited by the customer.
      // Do not add a new wheat inflow here or the balance would never decrease.
      // 1. Atta Given / Exchanged (Customer Digital Ledger entry)
      entries.push({
        customerId: tx.customerId,
        customerName: customerName || tx.customerName,
        transactionId: tx.id,
        transactionNumber: tx.transactionNumber,
        entryType: LedgerEntryType.ATTA,
        quantity: attaQty,
        unit: LedgerUnit.KG,
        rate: appliedRate,
        amount: tx.netAmount,
        direction: LedgerDirection.OUT,
        status: LedgerStatus.SETTLED,
        description: `${attaTypeName} Given (${formatKg(attaQty)} @ ₹${appliedRate}/kg)`,
        date: tx.date,
        createdById: tx.createdById,
        createdByName: tx.createdByName,
        notes: tx.notes,
      });

      // 2. Wheat Outflow from the customer's available deposited balance
      entries.push({
        customerId: tx.customerId,
        customerName: customerName || tx.customerName,
        transactionId: tx.id,
        transactionNumber: tx.transactionNumber,
        entryType: LedgerEntryType.WHEAT,
        quantity: wheatQty,
        unit: LedgerUnit.KG,
        rate: appliedRate,
        amount: 0,
        direction: LedgerDirection.OUT,
        status: LedgerStatus.SETTLED,
        description: `Wheat Milled into ${attaTypeName} (${formatKg(wheatQty)})`,
        date: tx.date,
        createdById: tx.createdById,
        createdByName: tx.createdByName,
      });

      // 3. Financial Entries
      if (tx.netAmount > 0) {
        entries.push({
          customerId: tx.customerId,
          customerName: customerName || tx.customerName,
          transactionId: tx.id,
          transactionNumber: tx.transactionNumber,
          entryType: LedgerEntryType.CASH,
          amount: tx.netAmount,
          unit: LedgerUnit.RUPEE,
          direction: LedgerDirection.OUT,
          status: LedgerStatus.DUE,
          description: `Milling Exchange Charges (${formatRupees(tx.netAmount)})`,
          date: tx.date,
          createdById: tx.createdById,
          createdByName: tx.createdByName,
        });
      }

      if (tx.paidAmount > 0) {
        entries.push({
          customerId: tx.customerId,
          customerName: customerName || tx.customerName,
          transactionId: tx.id,
          transactionNumber: tx.transactionNumber,
          entryType: LedgerEntryType.CASH,
          amount: tx.paidAmount,
          unit: LedgerUnit.RUPEE,
          direction: LedgerDirection.IN,
          status: LedgerStatus.PAID,
          description: `Cash Paid for Milling Exchange (${formatRupees(tx.paidAmount)})`,
          date: tx.date,
          createdById: tx.createdById,
          createdByName: tx.createdByName,
        });
      }

      return entries;
    },
  },

  // 4. RICE_PURCHASE
  [TransactionType.RICE_PURCHASE]: {
    type: TransactionType.RICE_PURCHASE,
    label: 'Rice Purchase',
    shortLabel: 'Rice Purchase',
    category: 'trading',
    description: 'Chakki buys ration rice from customer at standardized rate (₹21/kg)',
    iconName: 'ShoppingBag',
    colorTheme: {
      bg: 'bg-sky-50',
      text: 'text-sky-800',
      border: 'border-sky-200',
      badge: 'bg-sky-100 text-sky-900 border-sky-300',
    },
    requiresCustomer: true,
    allowedRoles: [UserRole.OWNER, UserRole.ADMIN],
    fields: [
      { name: 'quantity', label: 'Rice Quantity', type: 'number', placeholder: 'e.g. 20', unit: 'kg', min: 0.1, step: 0.1, required: true },
      { name: 'ratePerUnit', label: 'Purchase Rate', type: 'number', placeholder: '21', unit: '₹/kg', required: true },
    ],
    getDefaultItems: (rates) => [
      {
        itemType: ItemType.RICE,
        direction: ItemDirection.IN,
        grainType: GrainType.RATION_RICE,
        quantity: 20,
        unit: GrainUnit.KG,
        ratePerUnit: rates.ricePurchaseRate || 21,
        totalAmount: safeMultiply(20, rates.ricePurchaseRate || 21),
        notes: 'Ration rice bought from customer',
      },
    ],
    calculate: (items) => {
      const item = items[0] || { quantity: 0, ratePerUnit: 21, totalAmount: 0 };
      const qty = roundQuantity(item.quantity || 0);
      const rate = roundCurrency(item.ratePerUnit || 21);
      const total = safeMultiply(qty, rate);
      return {
        grossAmount: total,
        discountAmount: 0,
        netAmount: total,
        paidAmount: 0,
        balanceDelta: -total, // Credit to customer
        settlementDirection: 'SHOP_PAYS',
        settlementText: `Customer receives ₹${total} (or credited to khata)`,
        itemsSummary: `${formatKg(qty)} Ration Rice @ ₹${rate}/kg`,
        detailedLines: [
          { label: 'Ration Rice Inflow', quantity: qty, unit: 'kg', rate, amount: total, type: 'in' },
          { label: 'Payable to Customer', amount: total, isHighlight: true },
        ],
      };
    },
    buildLedgerEntries: (tx, customerName) => {
      if (!tx.customerId) return [];
      const item = tx.items[0];
      return [
        {
          customerId: tx.customerId,
          customerName: customerName || tx.customerName,
          transactionId: tx.id,
          transactionNumber: tx.transactionNumber,
          entryType: LedgerEntryType.RICE,
          quantity: item?.quantity || 0,
          unit: LedgerUnit.KG,
          rate: item?.ratePerUnit || 21,
          amount: tx.netAmount,
          direction: LedgerDirection.IN,
          status: LedgerStatus.CREDIT,
          description: `Ration Rice Purchased (${formatKg(item?.quantity || 0)} @ ₹${item?.ratePerUnit || 21})`,
          date: tx.date,
          createdById: tx.createdById,
          createdByName: tx.createdByName,
        },
      ];
    },
  },

  // 5. RICE_ATTA_SETTLEMENT (The core test scenario from Section 35!)
  [TransactionType.RICE_ATTA_SETTLEMENT]: {
    type: TransactionType.RICE_ATTA_SETTLEMENT,
    label: 'Rice → Atta Settlement',
    shortLabel: 'Rice → Atta',
    category: 'trading',
    description: 'Customer sells ration rice to offset purchased retail atta',
    iconName: 'ArrowLeftRight',
    colorTheme: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-900',
      border: 'border-emerald-300',
      badge: 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold',
    },
    requiresCustomer: true,
    allowedRoles: [UserRole.OWNER, UserRole.ADMIN],
    fields: [
      { name: 'riceQty', label: 'Rice Sold by Customer', type: 'number', placeholder: '15', unit: 'kg', min: 0.1, step: 0.1, required: true },
      { name: 'riceRate', label: 'Rice Rate', type: 'number', placeholder: '21', unit: '₹/kg', required: true },
      { name: 'attaQty', label: 'Atta Taken by Customer', type: 'number', placeholder: '5', unit: 'kg', min: 0.1, step: 0.1, required: true },
      { name: 'attaRate', label: 'Atta Selling Rate', type: 'number', placeholder: '40', unit: '₹/kg', required: true },
    ],
    getDefaultItems: (rates) => [
      // Item 1: Rice IN (e.g. 15kg @ ₹21 = ₹315)
      {
        itemType: ItemType.RICE,
        direction: ItemDirection.IN,
        grainType: GrainType.RATION_RICE,
        quantity: 15,
        unit: GrainUnit.KG,
        ratePerUnit: rates.ricePurchaseRate || 21,
        totalAmount: safeMultiply(15, rates.ricePurchaseRate || 21),
        notes: '15 kg ration rice submitted',
      },
      // Item 2: Atta OUT (e.g. 5kg @ ₹40 = ₹200)
      {
        itemType: ItemType.ATTA,
        direction: ItemDirection.OUT,
        grainType: GrainType.ROLL_ATTA,
        attaType: AttaType.ROLL_ATTA,
        quantity: 5,
        unit: GrainUnit.KG,
        ratePerUnit: rates.rollAttaSellingRate || 40,
        totalAmount: safeMultiply(5, rates.rollAttaSellingRate || 40),
        notes: '5 kg roll atta purchased',
      },
    ],
    calculate: (items, paidAmount) => {
      const riceItem = items.find((i) => i.itemType === ItemType.RICE) || { quantity: 0, ratePerUnit: 21, totalAmount: 0 };
      const attaItem = items.find((i) => i.itemType === ItemType.ATTA) || { quantity: 0, ratePerUnit: 40, totalAmount: 0 };

      const riceVal = safeMultiply(riceItem.quantity, riceItem.ratePerUnit);
      const attaVal = safeMultiply(attaItem.quantity, attaItem.ratePerUnit);

      // Business Formula: Settlement = Atta Value - Rice Value
      // If > 0: Customer pays the shop
      // If < 0: Shop pays the customer (Customer receives)
      // If = 0: Settled exactly
      const settlementRaw = safeSubtract(attaVal, riceVal); // 200 - 315 = -115
      const settlementAbs = Math.abs(settlementRaw);

      let direction: SettlementDirection = 'SETTLED';
      let settlementText = 'SETTLED EXACTLY';
      let balanceDelta = 0;

      if (settlementRaw < 0) {
        // Customer receives money / credit
        direction = 'CUSTOMER_RECEIVES';
        settlementText = `CUSTOMER RECEIVES ₹${settlementAbs}`;
        const cashPaid = paidAmount || 0;
        const unpaidCredit = safeSubtract(settlementAbs, cashPaid);
        balanceDelta = unpaidCredit > 0 ? -unpaidCredit : 0;
      } else if (settlementRaw > 0) {
        // Customer pays money / due
        direction = 'CUSTOMER_PAYS';
        settlementText = `CUSTOMER PAYS ₹${settlementAbs}`;
        const cashPaid = paidAmount || 0;
        const unpaidDue = safeSubtract(settlementAbs, cashPaid);
        balanceDelta = unpaidDue > 0 ? unpaidDue : 0;
      }

      return {
        grossAmount: safeAdd(riceVal, attaVal),
        discountAmount: 0,
        netAmount: settlementAbs,
        paidAmount: paidAmount || 0,
        balanceDelta,
        settlementDirection: direction,
        settlementText,
        itemsSummary: `${formatKg(riceItem.quantity)} Rice (${formatRupees(riceVal)}) ⇄ ${formatKg(attaItem.quantity)} Atta (${formatRupees(attaVal)})`,
        detailedLines: [
          {
            label: 'Rice Credit (Inflow)',
            subtext: `${formatKg(riceItem.quantity)} × ₹${riceItem.ratePerUnit}/kg`,
            amount: riceVal,
            type: 'in',
          },
          {
            label: 'Atta Bill (Outflow)',
            subtext: `${formatKg(attaItem.quantity)} × ₹${attaItem.ratePerUnit}/kg`,
            amount: attaVal,
            type: 'out',
          },
          {
            label: 'Settlement Result',
            subtext: settlementText,
            amount: settlementAbs,
            isHighlight: true,
          },
        ],
      };
    },
    buildLedgerEntries: (tx, customerName) => {
      if (!tx.customerId) return [];
      const riceItem = tx.items.find((i) => i.itemType === ItemType.RICE || i.grainType === GrainType.RATION_RICE);
      const attaItem = tx.items.find((i) => i.itemType === ItemType.ATTA || i.grainType === GrainType.ROLL_ATTA || i.grainType === GrainType.CHALI_ATTA);

      const entries: Array<Omit<LedgerEntry, 'id' | 'createdAt'>> = [];

      if (riceItem && riceItem.quantity > 0) {
        entries.push({
          customerId: tx.customerId,
          customerName: customerName || tx.customerName,
          transactionId: tx.id,
          transactionNumber: tx.transactionNumber,
          entryType: LedgerEntryType.RICE,
          quantity: riceItem.quantity,
          unit: LedgerUnit.KG,
          rate: riceItem.ratePerUnit,
          amount: riceItem.totalAmount,
          direction: LedgerDirection.IN,
          status: LedgerStatus.SETTLED,
          description: `Ration Rice Traded (${formatKg(riceItem.quantity)} @ ₹${riceItem.ratePerUnit}/kg)`,
          date: tx.date,
          createdById: tx.createdById,
          createdByName: tx.createdByName,
        });
      }

      if (attaItem && attaItem.quantity > 0) {
        entries.push({
          customerId: tx.customerId,
          customerName: customerName || tx.customerName,
          transactionId: tx.id,
          transactionNumber: tx.transactionNumber,
          entryType: LedgerEntryType.ATTA,
          quantity: attaItem.quantity,
          unit: LedgerUnit.KG,
          rate: attaItem.ratePerUnit,
          amount: attaItem.totalAmount,
          direction: LedgerDirection.OUT,
          status: LedgerStatus.SETTLED,
          description: `Atta Purchased in Trade (${formatKg(attaItem.quantity)} @ ₹${attaItem.ratePerUnit}/kg)`,
          date: tx.date,
          createdById: tx.createdById,
          createdByName: tx.createdByName,
        });
      }

      // Physical payment and outstanding balance are separate ledger facts.
      if (tx.paidAmount > 0) {
        entries.push({
          customerId: tx.customerId,
          customerName: customerName || tx.customerName,
          transactionId: tx.id,
          transactionNumber: tx.transactionNumber,
          entryType: LedgerEntryType.CASH,
          amount: tx.paidAmount,
          unit: LedgerUnit.RUPEE,
          direction: tx.settlementDirection === 'CUSTOMER_RECEIVES' ? LedgerDirection.OUT : LedgerDirection.IN,
          status: LedgerStatus.PAID,
          description: `Settlement Cash ${tx.settlementDirection === 'CUSTOMER_RECEIVES' ? 'Paid to Customer' : 'Received from Customer'} (${formatRupees(tx.paidAmount)})`,
          date: tx.date,
          createdById: tx.createdById,
          createdByName: tx.createdByName,
        });
      }

      if (tx.settlementDirection !== 'SETTLED' && tx.netAmount > 0) {
        const isCredit = tx.settlementDirection === 'CUSTOMER_RECEIVES';
        entries.push({
          customerId: tx.customerId,
          customerName: customerName || tx.customerName,
          transactionId: tx.id,
          transactionNumber: tx.transactionNumber,
          entryType: LedgerEntryType.CASH,
          amount: tx.netAmount,
          unit: LedgerUnit.RUPEE,
          direction: isCredit ? LedgerDirection.IN : LedgerDirection.OUT,
          status: isCredit ? LedgerStatus.CREDIT : LedgerStatus.DUE,
          description: `Rice-Atta Settlement Balance (${isCredit ? 'Customer Credit' : 'Customer Due'})`,
          date: tx.date,
          createdById: tx.createdById,
          createdByName: tx.createdByName,
        });
      }

      return entries;
    },
  },

  // 6. RICE_CASH_SETTLEMENT
  [TransactionType.RICE_CASH_SETTLEMENT]: {
    type: TransactionType.RICE_CASH_SETTLEMENT,
    label: 'Rice → Cash Settlement',
    shortLabel: 'Rice → Cash',
    category: 'trading',
    description: 'Direct cash payout to customer for ration rice (no atta involved)',
    iconName: 'Banknote',
    colorTheme: {
      bg: 'bg-teal-50',
      text: 'text-teal-900',
      border: 'border-teal-300',
      badge: 'bg-teal-100 text-teal-900 border-teal-400 font-bold',
    },
    requiresCustomer: true,
    allowedRoles: [UserRole.OWNER, UserRole.ADMIN],
    fields: [
      { name: 'quantity', label: 'Rice Quantity', type: 'number', placeholder: 'e.g. 15', unit: 'kg', min: 0.1, step: 0.1, required: true },
      { name: 'ratePerUnit', label: 'Purchase Rate', type: 'number', placeholder: '21', unit: '₹/kg', required: true },
      { name: 'paidAmount', label: 'Cash Paid Now', type: 'number', placeholder: 'e.g. 315', unit: '₹' },
    ],
    getDefaultItems: (rates) => {
      const rate = rates.riceCashPurchaseRate || rates.ricePurchaseRate || 21;
      const qty = 15;
      const total = safeMultiply(qty, rate);
      return [
        {
          itemType: ItemType.RICE,
          direction: ItemDirection.IN,
          grainType: GrainType.RATION_RICE,
          quantity: qty,
          unit: GrainUnit.KG,
          ratePerUnit: rate,
          totalAmount: total,
          notes: 'Ration rice sold for cash',
        },
        {
          itemType: ItemType.CASH,
          direction: ItemDirection.OUT,
          quantity: 1,
          unit: 'RUPEE',
          ratePerUnit: total,
          totalAmount: total,
          notes: 'Full cash payment handed to customer',
        },
      ];
    },
    calculate: (items, paid) => {
      const riceItem = items.find((i) => i.itemType === ItemType.RICE || i.grainType === GrainType.RATION_RICE) || items[0] || { quantity: 0, ratePerUnit: 21 };
      const qty = roundQuantity(riceItem.quantity || 0);
      const rate = roundCurrency(riceItem.ratePerUnit || 21);
      const total = safeMultiply(qty, rate);

      // If paid is undefined, default to full payment (standard counter flow)
      const paidAmt = typeof paid === 'number' ? roundCurrency(paid) : total;
      const remaining = safeSubtract(total, paidAmt);
      const paymentOption = paidAmt === total ? 'PAID' : paidAmt === 0 ? 'PENDING' : 'PARTIAL';

      const calc = GrainCashSettlementService.calculateRiceCashSettlement({
        quantity: qty > 0 ? qty : 15,
        rate: rate > 0 ? rate : 21,
        isCustomRate: false,
        paymentOption,
        amountPaid: paidAmt,
      });

      return {
        grossAmount: calc.grossValue,
        discountAmount: 0,
        netAmount: calc.settlementAmount,
        paidAmount: calc.amountPaid,
        balanceDelta: calc.customerBalanceDelta,
        settlementDirection: calc.settlementDirection,
        settlementText: calc.remainingAmount > 0
          ? `${calc.plainLanguageResult} (${formatRupees(calc.amountPaid)} Paid, ${formatRupees(calc.remainingAmount)} Remaining)`
          : `${calc.plainLanguageResult} (Paid in Full)`,
        itemsSummary: `${formatKg(calc.quantity)} Rice @ ₹${calc.rate}/kg = ${formatRupees(calc.settlementAmount)} Cash`,
        detailedLines: calc.detailedLines,
      };
    },
    buildLedgerEntries: (tx, customerName) => {
      return GrainCashSettlementService.buildLedgerEntries(tx, customerName);
    },
  },

  // 7. WHEAT_CASH_SETTLEMENT
  [TransactionType.WHEAT_CASH_SETTLEMENT]: {
    type: TransactionType.WHEAT_CASH_SETTLEMENT,
    label: 'Wheat → Cash Settlement',
    shortLabel: 'Wheat → Cash',
    category: 'trading',
    description: 'Direct cash payout to customer for raw wheat (no atta exchange)',
    iconName: 'Coins',
    colorTheme: {
      bg: 'bg-amber-50',
      text: 'text-amber-900',
      border: 'border-amber-300',
      badge: 'bg-amber-100 text-amber-900 border-amber-400 font-bold',
    },
    requiresCustomer: true,
    allowedRoles: [UserRole.OWNER, UserRole.ADMIN],
    fields: [
      { name: 'quantity', label: 'Wheat Quantity', type: 'number', placeholder: 'e.g. 15', unit: 'kg', min: 0.1, step: 0.1, required: true },
      { name: 'ratePerUnit', label: 'Wheat Cash Rate', type: 'number', placeholder: '24', unit: '₹/kg', required: true },
      { name: 'paidAmount', label: 'Cash Paid Now', type: 'number', placeholder: 'e.g. 360', unit: '₹' },
    ],
    getDefaultItems: (rates) => {
      const rate = rates.wheatCashPurchaseRate || 24;
      const qty = 15;
      const total = safeMultiply(qty, rate);
      return [
        {
          itemType: ItemType.WHEAT,
          direction: ItemDirection.IN,
          grainType: GrainType.WHEAT,
          quantity: qty,
          unit: GrainUnit.KG,
          ratePerUnit: rate,
          totalAmount: total,
          notes: 'Wheat sold for cash',
        },
        {
          itemType: ItemType.CASH,
          direction: ItemDirection.OUT,
          quantity: 1,
          unit: 'RUPEE',
          ratePerUnit: total,
          totalAmount: total,
          notes: 'Full cash payment handed to customer',
        },
      ];
    },
    calculate: (items, paid) => {
      const wheatItem = items.find((i) => i.itemType === ItemType.WHEAT || i.grainType === GrainType.WHEAT) || items[0] || { quantity: 0, ratePerUnit: 24 };
      const qty = roundQuantity(wheatItem.quantity || 0);
      const rate = roundCurrency(wheatItem.ratePerUnit || 24);
      const total = safeMultiply(qty, rate);

      // If paid is undefined, default to full payment (standard counter flow)
      const paidAmt = typeof paid === 'number' ? roundCurrency(paid) : total;
      const remaining = safeSubtract(total, paidAmt);
      const paymentOption = paidAmt === total ? 'PAID' : paidAmt === 0 ? 'PENDING' : 'PARTIAL';

      const calc = GrainCashSettlementService.calculateWheatCashSettlement({
        quantity: qty > 0 ? qty : 15,
        rate: rate > 0 ? rate : 24,
        isCustomRate: false,
        paymentOption,
        amountPaid: paidAmt,
      });

      return {
        grossAmount: calc.grossValue,
        discountAmount: 0,
        netAmount: calc.settlementAmount,
        paidAmount: calc.amountPaid,
        balanceDelta: calc.customerBalanceDelta,
        settlementDirection: calc.settlementDirection,
        settlementText: calc.remainingAmount > 0
          ? `${calc.plainLanguageResult} (${formatRupees(calc.amountPaid)} Paid, ${formatRupees(calc.remainingAmount)} Remaining)`
          : `${calc.plainLanguageResult} (Paid in Full)`,
        itemsSummary: `${formatKg(calc.quantity)} Wheat @ ₹${calc.rate}/kg = ${formatRupees(calc.settlementAmount)} Cash`,
        detailedLines: calc.detailedLines,
      };
    },
    buildLedgerEntries: (tx, customerName) => {
      return GrainCashSettlementService.buildLedgerEntries(tx, customerName);
    },
  },

  // 7. ATTA_PURCHASE
  [TransactionType.ATTA_PURCHASE]: {
    type: TransactionType.ATTA_PURCHASE,
    label: 'Atta Purchase (Retail)',
    shortLabel: 'Atta Purchase',
    category: 'milling',
    description: 'Direct retail sale of atta flour without deposited wheat',
    iconName: 'ShoppingBag',
    colorTheme: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-900 border-amber-300',
    },
    requiresCustomer: false, // Walk-ins allowed
    allowedRoles: [UserRole.OWNER, UserRole.ADMIN],
    fields: [
      { name: 'quantity', label: 'Atta Quantity', type: 'number', placeholder: 'e.g. 5', unit: 'kg', min: 0.1, step: 0.1, required: true },
      { name: 'ratePerUnit', label: 'Selling Rate', type: 'number', placeholder: '40', unit: '₹/kg', required: true },
      { name: 'paidAmount', label: 'Paid Now', type: 'number', placeholder: '0.00', unit: '₹' },
    ],
    getDefaultItems: (rates) => [
      {
        itemType: ItemType.ATTA,
        direction: ItemDirection.OUT,
        grainType: GrainType.ROLL_ATTA,
        attaType: AttaType.ROLL_ATTA,
        quantity: 5,
        unit: GrainUnit.KG,
        ratePerUnit: rates.rollAttaSellingRate || 40,
        totalAmount: safeMultiply(5, rates.rollAttaSellingRate || 40),
      },
    ],
    calculate: (items, paid) => {
      const item = items[0] || { quantity: 0, ratePerUnit: 40, totalAmount: 0 };
      const qty = roundQuantity(item.quantity || 0);
      const rate = roundCurrency(item.ratePerUnit || 40);
      const total = safeMultiply(qty, rate);
      const paidAmt = roundCurrency(typeof paid === 'number' ? paid : total);
      const due = safeSubtract(total, paidAmt);

      return {
        grossAmount: total,
        discountAmount: 0,
        netAmount: total,
        paidAmount: paidAmt,
        balanceDelta: due,
        settlementDirection: due > 0 ? 'CUSTOMER_PAYS' : 'SETTLED',
        settlementText: due > 0
          ? (paidAmt > 0 ? `Total ₹${total}. Paid ₹${paidAmt}. Due: ₹${due}` : `Total ₹${total}. Added to Khata Due: ₹${due}`)
          : `Paid ₹${total} in full cash`,
        itemsSummary: `${formatKg(qty)} Roll Atta @ ₹${rate}/kg = ₹${total}`,
        detailedLines: [
          { label: 'Atta Sold', quantity: qty, unit: 'kg', rate, amount: total, type: 'out' },
          { label: 'Payment Received', amount: paidAmt, type: 'in' },
          { label: 'Khata Due', amount: due, isHighlight: due > 0 },
        ],
      };
    },
    buildLedgerEntries: (tx, customerName) => {
      if (!tx.customerId) return [];
      const item = tx.items[0];
      const entries: Array<Omit<LedgerEntry, 'id' | 'createdAt'>> = [];

      // 1. Atta stock outflow
      entries.push({
        customerId: tx.customerId,
        customerName: customerName || tx.customerName,
        transactionId: tx.id,
        transactionNumber: tx.transactionNumber,
        entryType: LedgerEntryType.ATTA,
        quantity: item?.quantity || 0,
        unit: LedgerUnit.KG,
        rate: item?.ratePerUnit,
        amount: tx.netAmount,
        direction: LedgerDirection.OUT,
        status: tx.balanceDelta > 0 ? LedgerStatus.DUE : LedgerStatus.PAID,
        description: `Direct Atta Sale (${formatKg(item?.quantity || 0)} @ ₹${item?.ratePerUnit}/kg)`,
        date: tx.date,
        createdById: tx.createdById,
        createdByName: tx.createdByName,
      });

      // 2. Financial Entries
      if (tx.netAmount > 0) {
        entries.push({
          customerId: tx.customerId,
          customerName: customerName || tx.customerName,
          transactionId: tx.id,
          transactionNumber: tx.transactionNumber,
          entryType: LedgerEntryType.CASH,
          amount: tx.netAmount,
          unit: LedgerUnit.RUPEE,
          direction: LedgerDirection.OUT,
          status: LedgerStatus.DUE,
          description: `Atta Retail Sale Bill (${formatRupees(tx.netAmount)})`,
          date: tx.date,
          createdById: tx.createdById,
          createdByName: tx.createdByName,
        });
      }

      if (tx.paidAmount > 0) {
        entries.push({
          customerId: tx.customerId,
          customerName: customerName || tx.customerName,
          transactionId: tx.id,
          transactionNumber: tx.transactionNumber,
          entryType: LedgerEntryType.CASH,
          amount: tx.paidAmount,
          unit: LedgerUnit.RUPEE,
          direction: LedgerDirection.IN,
          status: LedgerStatus.PAID,
          description: `Cash Paid for Atta (${formatRupees(tx.paidAmount)})`,
          date: tx.date,
          createdById: tx.createdById,
          createdByName: tx.createdByName,
        });
      }

      return entries;
    },
  },

  // 8. CASH_PAYMENT
  [TransactionType.CASH_PAYMENT]: {
    type: TransactionType.CASH_PAYMENT,
    label: 'Cash Payment',
    shortLabel: 'Cash Payment',
    category: 'khata',
    description: 'Customer pays cash to clear or reduce outstanding khata dues',
    iconName: 'Receipt',
    colorTheme: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    },
    requiresCustomer: true,
    allowedRoles: [UserRole.OWNER, UserRole.ADMIN],
    fields: [
      { name: 'amount', label: 'Payment Amount', type: 'number', placeholder: 'e.g. 500', unit: '₹', min: 1, required: true },
      { name: 'notes', label: 'Payment Note', type: 'text', placeholder: 'Cash received at counter' },
    ],
    getDefaultItems: () => [
      {
        itemType: ItemType.CASH,
        direction: ItemDirection.IN,
        quantity: 1,
        unit: 'RUPEE',
        ratePerUnit: 500,
        totalAmount: 500,
        notes: 'Cash payment towards account dues',
      },
    ],
    calculate: (items) => {
      const item = items[0] || { totalAmount: 0 };
      const amt = roundCurrency(item.totalAmount || 0);
      return {
        grossAmount: amt,
        discountAmount: 0,
        netAmount: amt,
        paidAmount: amt,
        balanceDelta: -amt, // reduces customer dues
        settlementDirection: 'CUSTOMER_PAYS',
        settlementText: `Payment of ₹${amt} received from customer`,
        itemsSummary: `Cash Payment ₹${amt}`,
        detailedLines: [
          { label: 'Cash Payment Inflow', amount: amt, isHighlight: true, type: 'in' },
          { label: 'Khata Dues Reduced', subtext: `Dues decreased by ₹${amt}` },
        ],
      };
    },
    buildLedgerEntries: (tx, customerName) => {
      if (!tx.customerId) return [];
      return [
        {
          customerId: tx.customerId,
          customerName: customerName || tx.customerName,
          transactionId: tx.id,
          transactionNumber: tx.transactionNumber,
          entryType: LedgerEntryType.CASH,
          amount: tx.netAmount,
          unit: LedgerUnit.RUPEE,
          direction: LedgerDirection.IN,
          status: LedgerStatus.PAID,
          description: `Cash Payment Received (${formatRupees(tx.netAmount)})`,
          date: tx.date,
          createdById: tx.createdById,
          createdByName: tx.createdByName,
          notes: tx.notes,
        },
      ];
    },
  },

  // 9. CUSTOMER_CREDIT
  [TransactionType.CUSTOMER_CREDIT]: {
    type: TransactionType.CUSTOMER_CREDIT,
    label: 'Customer Credit',
    shortLabel: 'Credit Note',
    category: 'khata',
    description: 'Shop gives trade credit or credit offset to customer account',
    iconName: 'PlusCircle',
    colorTheme: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-800',
      border: 'border-indigo-200',
      badge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    },
    requiresCustomer: true,
    allowedRoles: [UserRole.OWNER, UserRole.ADMIN],
    fields: [
      { name: 'amount', label: 'Credit Amount', type: 'number', placeholder: 'e.g. 200', unit: '₹', min: 1, required: true },
      { name: 'notes', label: 'Reason for Credit', type: 'text', placeholder: 'e.g. Goodwill credit / advance' },
    ],
    getDefaultItems: () => [
      {
        itemType: ItemType.CASH,
        direction: ItemDirection.IN,
        quantity: 1,
        unit: 'RUPEE',
        ratePerUnit: 200,
        totalAmount: 200,
        notes: 'Credit added to account',
      },
    ],
    calculate: (items) => {
      const amt = roundCurrency(items[0]?.totalAmount || 0);
      return {
        grossAmount: amt,
        discountAmount: 0,
        netAmount: amt,
        paidAmount: 0,
        balanceDelta: -amt, // Shop owes customer
        settlementDirection: 'SHOP_PAYS',
        settlementText: `Credit of ₹${amt} issued to customer`,
        itemsSummary: `Credit ₹${amt}`,
        detailedLines: [{ label: 'Credit Issued', amount: amt, isHighlight: true }],
      };
    },
    buildLedgerEntries: (tx, customerName) => {
      if (!tx.customerId) return [];
      return [
        {
          customerId: tx.customerId,
          customerName: customerName || tx.customerName,
          transactionId: tx.id,
          transactionNumber: tx.transactionNumber,
          entryType: LedgerEntryType.CASH,
          amount: tx.netAmount,
          unit: LedgerUnit.RUPEE,
          direction: LedgerDirection.IN,
          status: LedgerStatus.CREDIT,
          description: `Customer Credit Issued: ₹${tx.netAmount}`,
          date: tx.date,
          createdById: tx.createdById,
          createdByName: tx.createdByName,
          notes: tx.notes,
        },
      ];
    },
  },

  // 10. CUSTOMER_DEBIT
  [TransactionType.CUSTOMER_DEBIT]: {
    type: TransactionType.CUSTOMER_DEBIT,
    label: 'Customer Debit',
    shortLabel: 'Debit Note',
    category: 'khata',
    description: 'Charge or fee billed directly to customer khata',
    iconName: 'MinusCircle',
    colorTheme: {
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-200',
      badge: 'bg-rose-100 text-rose-900 border-rose-300',
    },
    requiresCustomer: true,
    allowedRoles: [UserRole.OWNER, UserRole.ADMIN],
    fields: [
      { name: 'amount', label: 'Debit Amount', type: 'number', placeholder: 'e.g. 150', unit: '₹', min: 1, required: true },
      { name: 'notes', label: 'Reason for Debit', type: 'text', placeholder: 'e.g. Bag fee, manual adjustment' },
    ],
    getDefaultItems: () => [
      {
        itemType: ItemType.CASH,
        direction: ItemDirection.OUT,
        quantity: 1,
        unit: 'RUPEE',
        ratePerUnit: 150,
        totalAmount: 150,
        notes: 'Debit charge to customer khata',
      },
    ],
    calculate: (items) => {
      const amt = roundCurrency(items[0]?.totalAmount || 0);
      return {
        grossAmount: amt,
        discountAmount: 0,
        netAmount: amt,
        paidAmount: 0,
        balanceDelta: amt, // Customer owes shop
        settlementDirection: 'CUSTOMER_PAYS',
        settlementText: `Debit of ₹${amt} added to customer dues`,
        itemsSummary: `Debit ₹${amt}`,
        detailedLines: [{ label: 'Debit Charged', amount: amt, isHighlight: true }],
      };
    },
    buildLedgerEntries: (tx, customerName) => {
      if (!tx.customerId) return [];
      return [
        {
          customerId: tx.customerId,
          customerName: customerName || tx.customerName,
          transactionId: tx.id,
          transactionNumber: tx.transactionNumber,
          entryType: LedgerEntryType.CASH,
          amount: tx.netAmount,
          unit: LedgerUnit.RUPEE,
          direction: LedgerDirection.OUT,
          status: LedgerStatus.DUE,
          description: `Customer Debit Charged: ₹${tx.netAmount}`,
          date: tx.date,
          createdById: tx.createdById,
          createdByName: tx.createdByName,
          notes: tx.notes,
        },
      ];
    },
  },

  // 11. CORRECTION
  [TransactionType.CORRECTION]: {
    type: TransactionType.CORRECTION,
    label: 'Correction',
    shortLabel: 'Correction',
    category: 'adjustment',
    description: 'Non-destructive correction linked to an erroneous earlier transaction',
    iconName: 'ShieldAlert',
    colorTheme: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-300',
      badge: 'bg-amber-100 text-amber-900 border-amber-300',
    },
    requiresCustomer: true,
    allowedRoles: [UserRole.OWNER],
    fields: [
      { name: 'notes', label: 'Mandatory Correction Reason', type: 'text', placeholder: 'Explain reason for adjustment', required: true },
    ],
    getDefaultItems: () => [],
    calculate: (items) => ({
      grossAmount: items[0]?.totalAmount || 0,
      discountAmount: 0,
      netAmount: items[0]?.totalAmount || 0,
      paidAmount: 0,
      balanceDelta: 0,
      settlementDirection: 'SETTLED',
      settlementText: 'Adjustment entry preserving audit trail',
      itemsSummary: 'Non-destructive Correction',
      detailedLines: [{ label: 'Correction Entry', isHighlight: true }],
    }),
    buildLedgerEntries: () => [],
  },

  // 12. REVERSAL
  [TransactionType.REVERSAL]: {
    type: TransactionType.REVERSAL,
    label: 'Reversal',
    shortLabel: 'Reversal',
    category: 'adjustment',
    description: 'Compensating transaction that safely voids an erroneous transaction without deleting history',
    iconName: 'RotateCcw',
    colorTheme: {
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-300',
      badge: 'bg-rose-100 text-rose-900 border-rose-300',
    },
    requiresCustomer: true,
    allowedRoles: [UserRole.OWNER],
    fields: [
      { name: 'notes', label: 'Mandatory Reversal Reason', type: 'text', placeholder: 'Reason for complete reversal', required: true },
    ],
    getDefaultItems: () => [],
    calculate: () => ({
      grossAmount: 0,
      discountAmount: 0,
      netAmount: 0,
      paidAmount: 0,
      balanceDelta: 0,
      settlementDirection: 'SETTLED',
      settlementText: 'Compensating reversal transaction',
      itemsSummary: 'Transaction Reversal',
      detailedLines: [{ label: 'Reversal Entry', isHighlight: true }],
    }),
    buildLedgerEntries: () => [],
  },

  // 13. RICE_WHOLESALE_SALE
  [TransactionType.RICE_WHOLESALE_SALE]: {
    type: TransactionType.RICE_WHOLESALE_SALE,
    label: 'Rice Wholesale Sale',
    shortLabel: 'Wholesale Sale',
    category: 'business',
    description: 'Bulk dispatch of collected ration rice to commercial grain wholesalers',
    iconName: 'Truck',
    colorTheme: {
      bg: 'bg-sky-50',
      text: 'text-sky-900',
      border: 'border-sky-300',
      badge: 'bg-sky-100 text-sky-900 border-sky-300',
    },
    requiresCustomer: false, // Wholesaler, not retail customer
    allowedRoles: [UserRole.OWNER, UserRole.ADMIN],
    fields: [
      { name: 'quantity', label: 'Total Rice Quantity', type: 'number', placeholder: 'e.g. 1000', unit: 'kg', min: 10, required: true },
      { name: 'ratePerUnit', label: 'Wholesale Sale Rate', type: 'number', placeholder: 'e.g. 26', unit: '₹/kg', required: true },
    ],
    getDefaultItems: () => [
      {
        itemType: ItemType.RICE,
        direction: ItemDirection.OUT,
        grainType: GrainType.RATION_RICE,
        quantity: 1000,
        unit: GrainUnit.KG,
        ratePerUnit: 26,
        totalAmount: 26000,
        notes: 'Bulk rice dispatch to mandi',
      },
    ],
    calculate: (items) => {
      const item = items[0] || { quantity: 1000, ratePerUnit: 26, totalAmount: 26000 };
      const total = safeMultiply(item.quantity, item.ratePerUnit);
      return {
        grossAmount: total,
        discountAmount: 0,
        netAmount: total,
        paidAmount: 0,
        balanceDelta: 0,
        settlementDirection: 'SETTLED',
        settlementText: `Wholesale dispatch of ${formatKg(item.quantity)} @ ₹${item.ratePerUnit}/kg = ₹${total}`,
        itemsSummary: `${formatKg(item.quantity)} Rice Wholesale Sale`,
        detailedLines: [
          { label: 'Rice Dispatched', quantity: item.quantity, unit: 'kg', rate: item.ratePerUnit, amount: total, type: 'out' },
          { label: 'Wholesale Invoiced', amount: total, isHighlight: true },
        ],
      };
    },
    buildLedgerEntries: () => [],
  },

  // 14. EXPENSE
  [TransactionType.EXPENSE]: {
    type: TransactionType.EXPENSE,
    label: 'Expense',
    shortLabel: 'Shop Expense',
    category: 'business',
    description: 'Chakki operational expenses (Electricity, Stone Dressing, Diesel, Labor)',
    iconName: 'Receipt',
    colorTheme: {
      bg: 'bg-stone-50',
      text: 'text-stone-800',
      border: 'border-stone-300',
      badge: 'bg-stone-100 text-stone-900 border-stone-300',
    },
    requiresCustomer: false,
    allowedRoles: [UserRole.OWNER, UserRole.ADMIN],
    fields: [
      { name: 'amount', label: 'Expense Amount', type: 'number', placeholder: 'e.g. 1200', unit: '₹', min: 1, required: true },
      { name: 'notes', label: 'Expense Category / Paid To', type: 'text', placeholder: 'Electricity bill, stone maintenance, etc.', required: true },
    ],
    getDefaultItems: () => [
      {
        itemType: ItemType.EXPENSE,
        direction: ItemDirection.OUT,
        quantity: 1,
        unit: 'RUPEE',
        ratePerUnit: 500,
        totalAmount: 500,
        notes: 'Chakki operational expense',
      },
    ],
    calculate: (items) => {
      const amt = roundCurrency(items[0]?.totalAmount || 0);
      return {
        grossAmount: amt,
        discountAmount: 0,
        netAmount: amt,
        paidAmount: amt,
        balanceDelta: 0,
        settlementDirection: 'SETTLED',
        settlementText: `Expense of ₹${amt} paid from counter cash`,
        itemsSummary: `Expense ₹${amt}`,
        detailedLines: [{ label: 'Expense Cash Paid Out', amount: amt, isHighlight: true, type: 'out' }],
      };
    },
    buildLedgerEntries: () => [],
  },
};

/**
 * Helper to get definitions available to a specific user role
 */
export function getDefinitionsForRole(role: UserRole): TransactionDefinition[] {
  return Object.values(TRANSACTION_DEFINITIONS).filter((def) => def.allowedRoles.includes(role));
}
