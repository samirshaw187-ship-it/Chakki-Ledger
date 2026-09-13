import React, { useState, useMemo, useEffect } from 'react';
import {
  TransactionType,
  Customer,
  RateConfiguration,
  GrainType,
  AttaType,
  GrainUnit,
  ItemType,
  ItemDirection,
  UserRole,
  SettlementDirection,
  SettlementPaymentStatus,
} from '../types';
import { useAuth } from '../modules/auth/AuthContext';
import { dbRepository } from '../db/in-memory-db';
import {
  TRANSACTION_DEFINITIONS,
  TransactionDefinition,
  TransactionItemInput,
  getDefinitionsForRole,
} from '../modules/transactions/definitions';
import { TransactionService, CreateTransactionResult } from '../services/transaction.service';
import {
  roundCurrency,
  roundQuantity,
  safeMultiply,
  safeAdd,
  safeSubtract,
  formatRupees,
  formatKg,
} from '../utils/precision';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  ArrowLeft,
  Search,
  User,
  Scale,
  Wheat,
  ShoppingBag,
  ArrowLeftRight,
  Banknote,
  Coins,
  Receipt,
  PlusCircle,
  MinusCircle,
  ShieldAlert,
  RotateCcw,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Layers,
  Sparkles,
  Info,
  Calendar,
  Lock,
  Unlock,
  Check,
} from 'lucide-react';
import { WheatAttaExchangeService } from '../services/wheat-atta-exchange.service';
import { RiceAttaSettlementService, RiceAttaSettlementCalculation } from '../services/rice-atta-settlement.service';
import { GrainCashSettlementService, GrainCashSettlementCalculation } from '../services/grain-cash-settlement.service';
import { LedgerService } from '../services/ledger.service';

export type NewTxnStep = 'CUSTOMER' | 'TYPE' | 'DETAILS' | 'CONFIRM' | 'SUCCESS';

export interface MobileNewTransactionViewProps {
  onNavigate: (path: string) => void;
  initialCustomerId?: string;
  initialType?: TransactionType;
}

export const MobileNewTransactionView: React.FC<MobileNewTransactionViewProps> = ({
  onNavigate,
  initialCustomerId,
  initialType,
}) => {
  const { user, role } = useAuth();
  const isOwner = role === UserRole.OWNER;

  // Current active rates from system
  const rates: RateConfiguration = useMemo(() => dbRepository.getRates(), []);

  // Filter allowed transaction definitions for active user's role
  const availableDefinitions = useMemo(() => getDefinitionsForRole(role), [role]);

  // Workflow Step
  const [step, setStep] = useState<NewTxnStep>(() => {
    if (initialCustomerId && initialType) return 'DETAILS';
    if (initialCustomerId) return 'TYPE';
    return 'CUSTOMER';
  });

  // Selected Customer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(() => {
    if (initialCustomerId) {
      return dbRepository.getCustomerById(initialCustomerId);
    }
    return undefined;
  });

  // Customer search query
  const [customerSearch, setCustomerSearch] = useState('');

  // Selected Transaction Type
  const [selectedType, setSelectedType] = useState<TransactionType>(() => {
    return initialType || TransactionType.RICE_ATTA_SETTLEMENT;
  });

  // Active definition
  const currentDef: TransactionDefinition = useMemo(() => {
    return TRANSACTION_DEFINITIONS[selectedType] || TRANSACTION_DEFINITIONS[TransactionType.RICE_ATTA_SETTLEMENT];
  }, [selectedType]);

  // Category filter for transaction type selector
  const [typeCategoryFilter, setTypeCategoryFilter] = useState<'all' | 'milling' | 'trading' | 'khata' | 'business'>('all');

  // Dynamic Form Field Values
  // Dedicated state for Rice -> Atta Settlement workflow
  const [raRiceQty, setRaRiceQty] = useState<number>(15);
  const [raIsCustomRiceRate, setRaIsCustomRiceRate] = useState<boolean>(false);
  const [raCustomRiceRate, setRaCustomRiceRate] = useState<number>(rates.ricePurchaseRate || 21);
  const [raRiceOverrideReason, setRaRiceOverrideReason] = useState<string>('');

  const [raAttaType, setRaAttaType] = useState<AttaType>(AttaType.ROLL_ATTA);
  const [raAttaQty, setRaAttaQty] = useState<number>(5);
  const [raIsCustomAttaRate, setRaIsCustomAttaRate] = useState<boolean>(false);
  const [raCustomAttaRate, setRaCustomAttaRate] = useState<number>(rates.rollAttaSellingRate || 40);
  const [raAttaOverrideReason, setRaAttaOverrideReason] = useState<string>('');

  const [raPaymentOption, setRaPaymentOption] = useState<'PAID_NOW' | 'PENDING' | 'PARTIAL'>('PAID_NOW');
  const [raPartialAmount, setRaPartialAmount] = useState<number>(0);

  // Standard business rate lookups for Rice and Atta
  const raStandardRiceRate = useMemo(() => {
    return RiceAttaSettlementService.getDefaultRiceRate(rates);
  }, [rates]);

  const raStandardAttaRate = useMemo(() => {
    return RiceAttaSettlementService.getDefaultAttaRate(raAttaType, rates);
  }, [raAttaType, rates]);

  // Synchronize default rate when changing variety or rates
  useEffect(() => {
    if (!raIsCustomRiceRate) {
      setRaCustomRiceRate(raStandardRiceRate);
    }
  }, [raStandardRiceRate, raIsCustomRiceRate]);

  useEffect(() => {
    if (!raIsCustomAttaRate) {
      setRaCustomAttaRate(raStandardAttaRate);
    }
  }, [raStandardAttaRate, raIsCustomAttaRate]);

  // Centralized real-time calculation result for Rice -> Atta Settlement
  const raSettlementCalc: RiceAttaSettlementCalculation = useMemo(() => {
    try {
      return RiceAttaSettlementService.calculateRiceAttaSettlement({
        riceQuantity: raRiceQty,
        riceRate: raCustomRiceRate,
        isCustomRiceRate: raIsCustomRiceRate,
        riceOverrideReason: raRiceOverrideReason,
        attaType: raAttaType,
        attaQuantity: raAttaQty,
        attaRate: raCustomAttaRate,
        isCustomAttaRate: raIsCustomAttaRate,
        attaOverrideReason: raAttaOverrideReason,
        paymentOption: raPaymentOption,
        cashPaidAmount: raPartialAmount,
        rates,
        actorRole: role,
      });
    } catch {
      const riceRate = raIsCustomRiceRate && raCustomRiceRate > 0 ? raCustomRiceRate : raStandardRiceRate;
      const attaRate = raIsCustomAttaRate && raCustomAttaRate > 0 ? raCustomAttaRate : raStandardAttaRate;
      const rVal = safeMultiply(roundQuantity(raRiceQty || 0), roundCurrency(riceRate));
      const aVal = safeMultiply(roundQuantity(raAttaQty || 0), roundCurrency(attaRate));
      const delta = safeSubtract(aVal, rVal);
      const absDelta = Math.abs(delta);
      const dir = delta > 0 ? 'CUSTOMER_PAYS' : delta < 0 ? 'CUSTOMER_RECEIVES' : 'SETTLED';
      const pl = dir === 'CUSTOMER_PAYS'
        ? `CUSTOMER PAYS ${formatRupees(absDelta)}`
        : dir === 'CUSTOMER_RECEIVES'
        ? `CUSTOMER RECEIVES ${formatRupees(absDelta)}`
        : 'SETTLED EXACTLY';
      return {
        riceQuantity: raRiceQty,
        riceRate,
        standardRiceRate: raStandardRiceRate,
        isCustomRiceRate: raIsCustomRiceRate,
        riceOverrideReason: raRiceOverrideReason,
        riceValue: rVal,
        attaType: raAttaType,
        attaTypeName: raAttaType === AttaType.CHALI_ATTA ? 'Chali Atta' : 'Roll Atta',
        attaQuantity: raAttaQty,
        attaRate,
        standardAttaRate: raStandardAttaRate,
        isCustomAttaRate: raIsCustomAttaRate,
        attaOverrideReason: raAttaOverrideReason,
        attaValue: aVal,
        settlementRawDelta: delta,
        settlementAmount: absDelta,
        settlementDirection: dir as any,
        plainLanguageResult: pl,
        paymentStatus: (raPaymentOption === 'PAID_NOW' ? 'PAID' : 'PENDING') as any,
        effectivePaidAmount: raPaymentOption === 'PAID_NOW' ? absDelta : 0,
        customerBalanceDelta: raPaymentOption === 'PAID_NOW' ? 0 : (dir === 'CUSTOMER_RECEIVES' ? -absDelta : absDelta),
        riceSummary: `${raRiceQty} kg Rice @ ₹${riceRate}/kg`,
        attaSummary: `${raAttaQty} kg Atta @ ₹${attaRate}/kg`,
        explanationText: pl,
        summaryText: `${raRiceQty} kg Rice ⇄ ${raAttaQty} kg Atta`,
        detailedLines: [],
      };
    }
  }, [
    raRiceQty,
    raCustomRiceRate,
    raIsCustomRiceRate,
    raRiceOverrideReason,
    raAttaType,
    raAttaQty,
    raCustomAttaRate,
    raIsCustomAttaRate,
    raAttaOverrideReason,
    raPaymentOption,
    raPartialAmount,
    raStandardRiceRate,
    raStandardAttaRate,
    rates,
    role,
  ]);

  // Dedicated state for Rice -> Cash Settlement workflow
  const [rcQty, setRcQty] = useState<number>(15);
  const [rcIsCustomRate, setRcIsCustomRate] = useState<boolean>(false);
  const [rcCustomRate, setRcCustomRate] = useState<number>(rates.riceCashPurchaseRate || rates.ricePurchaseRate || 21);
  const [rcOverrideReason, setRcOverrideReason] = useState<string>('');
  const [rcPaymentOption, setRcPaymentOption] = useState<'PAID' | 'PENDING' | 'PARTIAL'>('PAID');
  const [rcPartialAmount, setRcPartialAmount] = useState<number>(0);

  const rcStandardRate = useMemo(() => {
    return GrainCashSettlementService.getDefaultRate(GrainType.RATION_RICE, rates);
  }, [rates]);

  useEffect(() => {
    if (!rcIsCustomRate) {
      setRcCustomRate(rcStandardRate);
    }
  }, [rcStandardRate, rcIsCustomRate]);

  const rcSettlementCalc: GrainCashSettlementCalculation = useMemo(() => {
    try {
      return GrainCashSettlementService.calculateGrainCashSettlement({
        grainType: GrainType.RATION_RICE,
        quantity: rcQty,
        rate: rcCustomRate,
        isCustomRate: rcIsCustomRate,
        overrideReason: rcOverrideReason,
        paymentOption: rcPaymentOption,
        amountPaid: rcPartialAmount,
        rates,
        actorRole: role,
      });
    } catch {
      const appliedRate = rcIsCustomRate && rcCustomRate > 0 ? rcCustomRate : rcStandardRate;
      const gVal = safeMultiply(roundQuantity(rcQty || 0), roundCurrency(appliedRate));
      const amtPaid = rcPaymentOption === 'PAID' ? gVal : rcPaymentOption === 'PARTIAL' ? roundCurrency(rcPartialAmount || 0) : 0;
      const rem = safeSubtract(gVal, amtPaid);
      return {
        transactionType: TransactionType.RICE_CASH_SETTLEMENT,
        grainType: GrainType.RATION_RICE,
        grainName: 'Ration Rice',
        quantity: roundQuantity(rcQty || 0),
        standardRate: rcStandardRate,
        rate: appliedRate,
        isCustomRate: rcIsCustomRate,
        overrideReason: rcOverrideReason,
        grossValue: gVal,
        settlementAmount: gVal,
        settlementDirection: 'CUSTOMER_RECEIVES',
        plainLanguageResult: `SHOP PAYS CUSTOMER ${formatRupees(gVal)}`,
        paymentStatus: rcPaymentOption === 'PAID' ? SettlementPaymentStatus.PAID : rcPaymentOption === 'PENDING' ? SettlementPaymentStatus.PENDING : SettlementPaymentStatus.PARTIAL,
        amountPaid: amtPaid,
        remainingAmount: rem,
        customerBalanceDelta: rem > 0 ? -rem : 0,
        summaryText: `${formatKg(rcQty)} Ration Rice @ ₹${appliedRate}/kg = ${formatRupees(gVal)}`,
        explanationText: `Ration Rice Value: ${formatRupees(gVal)} (Zero Atta Movement)`,
        detailedLines: [],
      };
    }
  }, [rcQty, rcCustomRate, rcIsCustomRate, rcOverrideReason, rcPaymentOption, rcPartialAmount, rcStandardRate, rates, role]);

  // Dedicated state for Wheat -> Cash Settlement workflow
  const [wcQty, setWcQty] = useState<number>(15);
  const [wcIsCustomRate, setWcIsCustomRate] = useState<boolean>(false);
  const [wcCustomRate, setWcCustomRate] = useState<number>(rates.wheatCashPurchaseRate || 24);
  const [wcOverrideReason, setWcOverrideReason] = useState<string>('');
  const [wcPaymentOption, setWcPaymentOption] = useState<'PAID' | 'PENDING' | 'PARTIAL'>('PAID');
  const [wcPartialAmount, setWcPartialAmount] = useState<number>(0);

  const wcStandardRate = useMemo(() => {
    return GrainCashSettlementService.getDefaultRate(GrainType.WHEAT, rates);
  }, [rates]);

  useEffect(() => {
    if (!wcIsCustomRate) {
      setWcCustomRate(wcStandardRate);
    }
  }, [wcStandardRate, wcIsCustomRate]);

  const wcSettlementCalc: GrainCashSettlementCalculation = useMemo(() => {
    try {
      return GrainCashSettlementService.calculateGrainCashSettlement({
        grainType: GrainType.WHEAT,
        quantity: wcQty,
        rate: wcCustomRate,
        isCustomRate: wcIsCustomRate,
        overrideReason: wcOverrideReason,
        paymentOption: wcPaymentOption,
        amountPaid: wcPartialAmount,
        rates,
        actorRole: role,
      });
    } catch {
      const appliedRate = wcIsCustomRate && wcCustomRate > 0 ? wcCustomRate : wcStandardRate;
      const gVal = safeMultiply(roundQuantity(wcQty || 0), roundCurrency(appliedRate));
      const amtPaid = wcPaymentOption === 'PAID' ? gVal : wcPaymentOption === 'PARTIAL' ? roundCurrency(wcPartialAmount || 0) : 0;
      const rem = safeSubtract(gVal, amtPaid);
      return {
        transactionType: TransactionType.WHEAT_CASH_SETTLEMENT,
        grainType: GrainType.WHEAT,
        grainName: 'Raw Wheat',
        quantity: roundQuantity(wcQty || 0),
        standardRate: wcStandardRate,
        rate: appliedRate,
        isCustomRate: wcIsCustomRate,
        overrideReason: wcOverrideReason,
        grossValue: gVal,
        settlementAmount: gVal,
        settlementDirection: 'CUSTOMER_RECEIVES',
        plainLanguageResult: `SHOP PAYS CUSTOMER ${formatRupees(gVal)}`,
        paymentStatus: wcPaymentOption === 'PAID' ? SettlementPaymentStatus.PAID : wcPaymentOption === 'PENDING' ? SettlementPaymentStatus.PENDING : SettlementPaymentStatus.PARTIAL,
        amountPaid: amtPaid,
        remainingAmount: rem,
        customerBalanceDelta: rem > 0 ? -rem : 0,
        summaryText: `${formatKg(wcQty)} Raw Wheat @ ₹${appliedRate}/kg = ${formatRupees(gVal)}`,
        explanationText: `Wheat Cash Value: ${formatRupees(gVal)} (Zero Atta Movement)`,
        detailedLines: [],
      };
    }
  }, [wcQty, wcCustomRate, wcIsCustomRate, wcOverrideReason, wcPaymentOption, wcPartialAmount, wcStandardRate, rates, role]);

  // For General Grain & Atta
  const [generalQty, setGeneralQty] = useState<number>(50);
  const [generalRate, setGeneralRate] = useState<number>(10);
  const [generalAttaType, setGeneralAttaType] = useState<AttaType>(AttaType.ROLL_ATTA);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // Dedicated state for Wheat -> Atta Exchange workflow
  const [weWheatQty, setWeWheatQty] = useState<number>(15);
  const [weAttaType, setWeAttaType] = useState<AttaType>(AttaType.ROLL_ATTA);
  const [weIsCustomRate, setWeIsCustomRate] = useState<boolean>(false);
  const [weCustomRate, setWeCustomRate] = useState<number>(rates.rollAttaExchangeRate || 10);
  const [weOverrideReason, setWeOverrideReason] = useState<string>('');
  const [wePaymentOption, setWePaymentOption] = useState<'FULL_CASH' | 'ADD_TO_DUE' | 'PARTIAL'>('FULL_CASH');
  const [wePartialAmount, setWePartialAmount] = useState<number>(0);
  const availableWheat = useMemo(
    () => selectedCustomer ? LedgerService.calculateCustomerBalances(selectedCustomer.id).wheatBalanceKg : 0,
    [selectedCustomer]
  );
  const wheatExchangeExceedsBalance = weWheatQty > availableWheat;

  // Standard business rate for currently selected atta type
  const weStandardRate = useMemo(() => {
    return WheatAttaExchangeService.getDefaultRate(weAttaType, rates);
  }, [weAttaType, rates]);

  // Synchronize default rate when changing atta variety if custom rate is not enabled
  useEffect(() => {
    if (!weIsCustomRate) {
      setWeCustomRate(weStandardRate);
    }
  }, [weAttaType, weStandardRate, weIsCustomRate]);

  // Centralized calculation result for Wheat -> Atta Exchange
  const weExchangeCalc = useMemo(() => {
    try {
      return WheatAttaExchangeService.calculate({
        wheatQuantity: weWheatQty,
        attaType: weAttaType,
        customRate: weCustomRate,
        isCustomRate: weIsCustomRate,
        overrideReason: weOverrideReason,
        rates,
        actorRole: role,
      });
    } catch {
      const appliedRate = weIsCustomRate && weCustomRate > 0 ? weCustomRate : weStandardRate;
      const ratio = rates.wheatToAttaConversionRatio || 1.0;
      const calcVal = safeMultiply(roundQuantity(weWheatQty || 0), roundCurrency(appliedRate));
      const attaOut = roundQuantity((weWheatQty || 0) * ratio);
      return {
        wheatQuantity: weWheatQty,
        attaType: weAttaType,
        attaTypeName: weAttaType === AttaType.CHALI_ATTA ? 'Chali Atta' : 'Roll Atta',
        standardRate: weStandardRate,
        appliedRate,
        isCustomRate: weIsCustomRate,
        overrideReason: weOverrideReason,
        conversionRatio: ratio,
        attaQuantityGiven: attaOut,
        calculatedExchangeValue: calcVal,
        explanationText: `${weWheatQty} kg Wheat × ₹${appliedRate}/kg = ₹${calcVal}`,
        summaryText: `${weWheatQty} kg Wheat → ${attaOut} kg ${weAttaType === AttaType.CHALI_ATTA ? 'Chali Atta' : 'Roll Atta'} @ ₹${appliedRate}/kg`,
        detailedLines: [],
      };
    }
  }, [weWheatQty, weAttaType, weCustomRate, weIsCustomRate, weOverrideReason, weStandardRate, rates, role]);

  // Determine actual cash received for Wheat -> Atta Exchange
  const wePaidAmount = useMemo(() => {
    if (wePaymentOption === 'FULL_CASH') {
      return weExchangeCalc.calculatedExchangeValue;
    }
    if (wePaymentOption === 'ADD_TO_DUE') {
      return 0;
    }
    return roundCurrency(wePartialAmount || 0);
  }, [wePaymentOption, weExchangeCalc.calculatedExchangeValue, wePartialAmount]);

  // Reversal / Correction reference
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [referenceTxnNumber, setReferenceTxnNumber] = useState<string>('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<CreateTransactionResult | null>(null);

  // Client idempotency key generated when entering confirm step
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => `idem-${Date.now()}`);

  // When selectedType changes, set defaults
  useEffect(() => {
    if (selectedType === TransactionType.RICE_ATTA_SETTLEMENT) {
      setRaRiceQty(15);
      setRaAttaQty(5);
      setRaAttaType(AttaType.ROLL_ATTA);
      setRaPaymentOption('PAID_NOW');
      setRaIsCustomRiceRate(false);
      setRaIsCustomAttaRate(false);
      setRaRiceOverrideReason('');
      setRaAttaOverrideReason('');
      setRaPartialAmount(0);
      setPaidAmount(0);
    } else if (selectedType === TransactionType.RICE_CASH_SETTLEMENT) {
      setRcQty(15);
      setRcIsCustomRate(false);
      setRcCustomRate(rates.riceCashPurchaseRate || rates.ricePurchaseRate || 21);
      setRcOverrideReason('');
      setRcPaymentOption('PAID');
      setRcPartialAmount(0);
      setPaidAmount(0);
    } else if (selectedType === TransactionType.WHEAT_CASH_SETTLEMENT) {
      setWcQty(15);
      setWcIsCustomRate(false);
      setWcCustomRate(rates.wheatCashPurchaseRate || 24);
      setWcOverrideReason('');
      setWcPaymentOption('PAID');
      setWcPartialAmount(0);
      setPaidAmount(0);
    } else if (selectedType === TransactionType.WHEAT_DEPOSIT) {
      setGeneralQty(50);
      setGeneralRate(0);
      setPaidAmount(0);
    } else if (selectedType === TransactionType.WHEAT_ATTA_EXCHANGE) {
      setGeneralQty(18);
      setGeneralRate(rates.rollAttaExchangeRate || 10);
      setGeneralAttaType(AttaType.ROLL_ATTA);
      setPaidAmount(180);
    } else if (selectedType === TransactionType.RICE_PURCHASE) {
      setGeneralQty(20);
      setGeneralRate(rates.ricePurchaseRate || 21);
      setPaidAmount(0);
    } else if (selectedType === TransactionType.ATTA_PURCHASE) {
      setGeneralQty(5);
      setGeneralRate(rates.rollAttaSellingRate || 40);
      setPaidAmount(200);
    } else if (selectedType === TransactionType.CASH_PAYMENT) {
      setGeneralRate(500);
      setPaidAmount(500);
    }
  }, [selectedType, rates]);

  // Filtered customers list
  const filteredCustomers = useMemo(() => {
    const all = dbRepository.getCustomers().filter((c) => c.isActive);
    if (!customerSearch.trim()) return all.slice(0, 20);
    const q = customerSearch.toLowerCase().trim();
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.customerCode && c.customerCode.toLowerCase().includes(q)) ||
        (c.villageOrArea && c.villageOrArea.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [customerSearch]);

  // Construct current items payload based on inputs
  const currentItems: TransactionItemInput[] = useMemo(() => {
    switch (selectedType) {
      case TransactionType.RICE_ATTA_SETTLEMENT: {
        return RiceAttaSettlementService.buildTransactionItems(raSettlementCalc, notes);
      }

      case TransactionType.WHEAT_DEPOSIT: {
        const safeQty = roundQuantity(generalQty || 0);
        return [
          {
            itemType: ItemType.WHEAT,
            direction: ItemDirection.IN,
            grainType: GrainType.WHEAT,
            quantity: safeQty,
            unit: GrainUnit.KG,
            ratePerUnit: 0,
            totalAmount: 0,
            notes: notes || 'Wheat deposited for future milling',
          },
        ];
      }

      case TransactionType.WHEAT_ATTA_EXCHANGE: {
        const safeWheatQty = roundQuantity(weWheatQty || 0);
        const safeAttaQty = roundQuantity(weExchangeCalc.attaQuantityGiven || safeWheatQty);
        const safeRate = roundCurrency(weExchangeCalc.appliedRate || 10);
        const safeTotal = weExchangeCalc.calculatedExchangeValue;

        return [
          {
            itemType: ItemType.WHEAT,
            direction: ItemDirection.IN,
            grainType: GrainType.WHEAT,
            quantity: safeWheatQty,
            unit: GrainUnit.KG,
            ratePerUnit: safeRate,
            totalAmount: 0,
            notes: notes ? `${notes} (Wheat received)` : 'Wheat received for atta exchange',
          },
          {
            itemType: ItemType.ATTA,
            direction: ItemDirection.OUT,
            grainType: weAttaType === AttaType.CHALI_ATTA ? GrainType.CHALI_ATTA : GrainType.ROLL_ATTA,
            attaType: weAttaType,
            quantity: safeAttaQty,
            unit: GrainUnit.KG,
            ratePerUnit: safeRate,
            totalAmount: safeTotal,
            notes: notes
              ? `${notes} (${weExchangeCalc.attaTypeName} delivered)`
              : `${weExchangeCalc.attaTypeName} delivered in exchange`,
          },
        ];
      }

      case TransactionType.RICE_PURCHASE: {
        const safeQty = roundQuantity(generalQty || 0);
        const safeRate = roundCurrency(generalRate || 21);
        return [
          {
            itemType: ItemType.RICE,
            direction: ItemDirection.IN,
            grainType: GrainType.RATION_RICE,
            quantity: safeQty,
            unit: GrainUnit.KG,
            ratePerUnit: safeRate,
            totalAmount: safeMultiply(safeQty, safeRate),
            notes: notes || 'Ration rice bought from customer',
          },
        ];
      }

      case TransactionType.RICE_CASH_SETTLEMENT: {
        const safeQty = roundQuantity(rcQty || 0);
        const safeRate = roundCurrency(rcSettlementCalc.rate || 21);
        return [
          {
            itemType: ItemType.RICE,
            direction: ItemDirection.IN,
            grainType: GrainType.RATION_RICE,
            quantity: safeQty,
            unit: GrainUnit.KG,
            ratePerUnit: safeRate,
            totalAmount: rcSettlementCalc.grossValue,
            notes: notes ? `${notes} (Rice cash purchase)` : 'Ration rice bought for cash',
          },
        ];
      }

      case TransactionType.WHEAT_CASH_SETTLEMENT: {
        const safeQty = roundQuantity(wcQty || 0);
        const safeRate = roundCurrency(wcSettlementCalc.rate || 24);
        return [
          {
            itemType: ItemType.WHEAT,
            direction: ItemDirection.IN,
            grainType: GrainType.WHEAT,
            quantity: safeQty,
            unit: GrainUnit.KG,
            ratePerUnit: safeRate,
            totalAmount: wcSettlementCalc.grossValue,
            notes: notes ? `${notes} (Wheat cash purchase)` : 'Raw wheat bought for cash',
          },
        ];
      }

      case TransactionType.ATTA_PURCHASE: {
        const safeQty = roundQuantity(generalQty || 0);
        const safeRate = roundCurrency(generalRate || 40);
        return [
          {
            itemType: ItemType.ATTA,
            direction: ItemDirection.OUT,
            grainType: GrainType.ROLL_ATTA,
            attaType: AttaType.ROLL_ATTA,
            quantity: safeQty,
            unit: GrainUnit.KG,
            ratePerUnit: safeRate,
            totalAmount: safeMultiply(safeQty, safeRate),
            notes: notes || 'Direct retail atta sale',
          },
        ];
      }

      case TransactionType.CASH_PAYMENT: {
        const amt = roundCurrency(paidAmount || generalRate || 0);
        return [
          {
            itemType: ItemType.CASH,
            direction: ItemDirection.IN,
            quantity: 1,
            unit: 'RUPEE',
            ratePerUnit: amt,
            totalAmount: amt,
            notes: notes || 'Khata cash payment',
          },
        ];
      }

      case TransactionType.CUSTOMER_CREDIT: {
        const amt = roundCurrency(generalRate || 0);
        return [
          {
            itemType: ItemType.CASH,
            direction: ItemDirection.IN,
            quantity: 1,
            unit: 'RUPEE',
            ratePerUnit: amt,
            totalAmount: amt,
            notes: notes || adjustmentReason || 'Account credit adjustment',
          },
        ];
      }

      case TransactionType.CUSTOMER_DEBIT: {
        const amt = roundCurrency(generalRate || 0);
        return [
          {
            itemType: ItemType.CASH,
            direction: ItemDirection.OUT,
            quantity: 1,
            unit: 'RUPEE',
            ratePerUnit: amt,
            totalAmount: amt,
            notes: notes || adjustmentReason || 'Account debit adjustment',
          },
        ];
      }

      default: {
        const amt = roundCurrency(generalRate || 0);
        return [
          {
            itemType: ItemType.EXPENSE,
            direction: ItemDirection.OUT,
            quantity: 1,
            unit: 'RUPEE',
            ratePerUnit: amt,
            totalAmount: amt,
            notes: notes || adjustmentReason,
          },
        ];
      }
    }
  }, [
    selectedType,
    raSettlementCalc,
    rcQty,
    rcSettlementCalc,
    wcQty,
    wcSettlementCalc,
    weWheatQty,
    weAttaType,
    weExchangeCalc,
    generalQty,
    generalRate,
    generalAttaType,
    paidAmount,
    notes,
    adjustmentReason,
  ]);

  // Determine effective paid amount based on workflow
  const effectivePaidAmount = useMemo(() => {
    if (selectedType === TransactionType.WHEAT_ATTA_EXCHANGE) {
      return wePaidAmount;
    }
    if (selectedType === TransactionType.RICE_ATTA_SETTLEMENT) {
      return raSettlementCalc.effectivePaidAmount;
    }
    if (selectedType === TransactionType.RICE_CASH_SETTLEMENT) {
      return rcSettlementCalc.amountPaid;
    }
    if (selectedType === TransactionType.WHEAT_CASH_SETTLEMENT) {
      return wcSettlementCalc.amountPaid;
    }
    return paidAmount;
  }, [selectedType, wePaidAmount, raSettlementCalc, rcSettlementCalc, wcSettlementCalc, paidAmount]);

  // Determine effective notes including audit details for overrides
  const effectiveNotes = useMemo(() => {
    if (selectedType === TransactionType.WHEAT_ATTA_EXCHANGE) {
      const customRateNote = weIsCustomRate
        ? `[Custom Rate Override: ₹${weExchangeCalc.appliedRate}/kg (Std: ₹${weExchangeCalc.standardRate}/kg). Reason: ${weOverrideReason}]`
        : '';
      return [notes, customRateNote].filter(Boolean).join(' ');
    }
    if (selectedType === TransactionType.RICE_ATTA_SETTLEMENT) {
      const auditNotes: string[] = [];
      if (raIsCustomRiceRate) {
        auditNotes.push(
          `[Custom Rice Rate: ₹${raSettlementCalc.riceRate}/kg (Std: ₹${raSettlementCalc.standardRiceRate}/kg). Reason: ${raRiceOverrideReason}]`
        );
      }
      if (raIsCustomAttaRate) {
        auditNotes.push(
          `[Custom Atta Rate: ₹${raSettlementCalc.attaRate}/kg (Std: ₹${raSettlementCalc.standardAttaRate}/kg). Reason: ${raAttaOverrideReason}]`
        );
      }
      return [notes, ...auditNotes].filter(Boolean).join(' ');
    }
    if (selectedType === TransactionType.RICE_CASH_SETTLEMENT) {
      const customRateNote = rcIsCustomRate
        ? `[Custom Rice Purchase Rate: ₹${rcSettlementCalc.rate}/kg (Std: ₹${rcSettlementCalc.standardRate}/kg). Reason: ${rcOverrideReason}]`
        : '';
      return [notes, customRateNote].filter(Boolean).join(' ');
    }
    if (selectedType === TransactionType.WHEAT_CASH_SETTLEMENT) {
      const customRateNote = wcIsCustomRate
        ? `[Custom Wheat Purchase Rate: ₹${wcSettlementCalc.rate}/kg (Std: ₹${wcSettlementCalc.standardRate}/kg). Reason: ${wcOverrideReason}]`
        : '';
      return [notes, customRateNote].filter(Boolean).join(' ');
    }
    return notes;
  }, [
    selectedType,
    notes,
    weIsCustomRate,
    weExchangeCalc,
    weOverrideReason,
    raIsCustomRiceRate,
    raIsCustomAttaRate,
    raSettlementCalc,
    raRiceOverrideReason,
    raAttaOverrideReason,
    rcIsCustomRate,
    rcSettlementCalc,
    rcOverrideReason,
    wcIsCustomRate,
    wcSettlementCalc,
    wcOverrideReason,
  ]);

  // Real-time calculated summary
  const calculatedSummary = useMemo(() => {
    if (selectedType === TransactionType.RICE_ATTA_SETTLEMENT) {
      return {
        grossAmount: safeAdd(raSettlementCalc.riceValue, raSettlementCalc.attaValue),
        discountAmount: 0,
        netAmount: raSettlementCalc.settlementAmount,
        paidAmount: raSettlementCalc.effectivePaidAmount,
        balanceDelta: raSettlementCalc.customerBalanceDelta,
        settlementDirection: raSettlementCalc.settlementDirection,
        settlementText: raSettlementCalc.plainLanguageResult,
        itemsSummary: raSettlementCalc.summaryText,
        detailedLines: raSettlementCalc.detailedLines,
      };
    }
    if (selectedType === TransactionType.RICE_CASH_SETTLEMENT) {
      return {
        grossAmount: rcSettlementCalc.grossValue,
        discountAmount: 0,
        netAmount: rcSettlementCalc.settlementAmount,
        paidAmount: rcSettlementCalc.amountPaid,
        balanceDelta: rcSettlementCalc.customerBalanceDelta,
        settlementDirection: rcSettlementCalc.settlementDirection,
        settlementText: rcSettlementCalc.remainingAmount > 0
          ? `${rcSettlementCalc.plainLanguageResult} (${formatRupees(rcSettlementCalc.amountPaid)} Paid, ${formatRupees(rcSettlementCalc.remainingAmount)} Khata Credit)`
          : `${rcSettlementCalc.plainLanguageResult} (Paid in Full)`,
        itemsSummary: rcSettlementCalc.summaryText,
        detailedLines: rcSettlementCalc.detailedLines,
      };
    }
    if (selectedType === TransactionType.WHEAT_CASH_SETTLEMENT) {
      return {
        grossAmount: wcSettlementCalc.grossValue,
        discountAmount: 0,
        netAmount: wcSettlementCalc.settlementAmount,
        paidAmount: wcSettlementCalc.amountPaid,
        balanceDelta: wcSettlementCalc.customerBalanceDelta,
        settlementDirection: wcSettlementCalc.settlementDirection,
        settlementText: wcSettlementCalc.remainingAmount > 0
          ? `${wcSettlementCalc.plainLanguageResult} (${formatRupees(wcSettlementCalc.amountPaid)} Paid, ${formatRupees(wcSettlementCalc.remainingAmount)} Khata Credit)`
          : `${wcSettlementCalc.plainLanguageResult} (Paid in Full)`,
        itemsSummary: wcSettlementCalc.summaryText,
        detailedLines: wcSettlementCalc.detailedLines,
      };
    }
    return currentDef.calculate(currentItems, effectivePaidAmount, effectiveNotes || adjustmentReason);
  }, [
    selectedType,
    raSettlementCalc,
    rcSettlementCalc,
    wcSettlementCalc,
    currentDef,
    currentItems,
    effectivePaidAmount,
    effectiveNotes,
    adjustmentReason,
  ]);

  // Handle final submission
  const handleConfirmAndSave = async () => {
    if (isSubmitting) return;

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const actor = {
        id: user?.id || 'usr-default',
        name: user?.name || 'Shop Counter Staff',
        role,
      };

      if (selectedType === TransactionType.RICE_ATTA_SETTLEMENT) {
        if (!selectedCustomer) {
          throw new Error('Please select a customer for Rice → Atta Settlement.');
        }

        const result = await RiceAttaSettlementService.createRiceAttaSettlement(
          {
            customerId: selectedCustomer.id,
            calculation: raSettlementCalc,
            paymentOption: raPaymentOption,
            cashPaidAmount: raPartialAmount,
            notes,
            idempotencyKey,
          },
          actor
        );

        setCreatedResult(result);
        setStep('SUCCESS');
        return;
      }

      if (selectedType === TransactionType.RICE_CASH_SETTLEMENT) {
        if (!selectedCustomer) {
          throw new Error('Please select a customer for Rice → Cash Settlement.');
        }

        const result = GrainCashSettlementService.executeGrainCashSettlement(
          selectedCustomer.id,
          rcSettlementCalc,
          actor,
          effectiveNotes,
          undefined,
          idempotencyKey
        );

        setCreatedResult(result);
        setStep('SUCCESS');
        return;
      }

      if (selectedType === TransactionType.WHEAT_CASH_SETTLEMENT) {
        if (!selectedCustomer) {
          throw new Error('Please select a customer for Wheat → Cash Settlement.');
        }

        const result = GrainCashSettlementService.executeGrainCashSettlement(
          selectedCustomer.id,
          wcSettlementCalc,
          actor,
          effectiveNotes,
          undefined,
          idempotencyKey
        );

        setCreatedResult(result);
        setStep('SUCCESS');
        return;
      }

      const finalNotes = selectedType === TransactionType.CORRECTION || selectedType === TransactionType.REVERSAL
        ? `${adjustmentReason}${referenceTxnNumber ? ` [Ref: ${referenceTxnNumber}]` : ''}`
        : effectiveNotes;

      const result = await TransactionService.createTransaction(
        {
          type: selectedType,
          customerId: selectedCustomer?.id,
          items: currentItems,
          paidAmount: calculatedSummary.paidAmount,
          notes: finalNotes,
          description: calculatedSummary.itemsSummary,
        },
        actor,
        idempotencyKey
      );

      setCreatedResult(result);
      setStep('SUCCESS');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to save transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Icon helper for transaction selector
  const renderDefIcon = (type: TransactionType) => {
    const iconClass = 'w-5 h-5 shrink-0';
    switch (type) {
      case TransactionType.WHEAT_DEPOSIT:
        return <Scale className={`${iconClass} text-emerald-700`} />;
      case TransactionType.WHEAT_ATTA_EXCHANGE:
        return <Wheat className={`${iconClass} text-amber-700`} />;
      case TransactionType.RICE_ATTA_SETTLEMENT:
        return <ArrowLeftRight className={`${iconClass} text-emerald-800`} />;
      case TransactionType.RICE_PURCHASE:
      case TransactionType.ATTA_PURCHASE:
        return <ShoppingBag className={`${iconClass} text-sky-700`} />;
      case TransactionType.RICE_CASH_SETTLEMENT:
        return <Banknote className={`${iconClass} text-teal-700`} />;
      case TransactionType.WHEAT_CASH_SETTLEMENT:
        return <Coins className={`${iconClass} text-amber-700`} />;
      case TransactionType.CASH_PAYMENT:
        return <Receipt className={`${iconClass} text-emerald-700`} />;
      case TransactionType.CUSTOMER_CREDIT:
        return <PlusCircle className={`${iconClass} text-indigo-700`} />;
      case TransactionType.CUSTOMER_DEBIT:
        return <MinusCircle className={`${iconClass} text-rose-700`} />;
      case TransactionType.CORRECTION:
        return <ShieldAlert className={`${iconClass} text-amber-700`} />;
      case TransactionType.REVERSAL:
        return <RotateCcw className={`${iconClass} text-rose-700`} />;
      case TransactionType.RICE_WHOLESALE_SALE:
        return <Truck className={`${iconClass} text-sky-700`} />;
      default:
        return <Layers className={`${iconClass} text-stone-700`} />;
    }
  };

  // Step Progress Indicator
  const renderStepHeader = () => {
    const steps: Array<{ key: NewTxnStep; label: string; num: number }> = [
      { key: 'CUSTOMER', label: 'Customer', num: 1 },
      { key: 'TYPE', label: 'Type', num: 2 },
      { key: 'DETAILS', label: 'Details', num: 3 },
      { key: 'CONFIRM', label: 'Review', num: 4 },
    ];

    if (step === 'SUCCESS') return null;

    const currentIdx = steps.findIndex((s) => s.key === step);

    return (
      <div className="bg-white rounded-xl border border-stone-200 p-3 shadow-2xs">
        <div className="flex items-center justify-between">
          {steps.map((s, idx) => {
            const isActive = s.key === step;
            const isCompleted = idx < currentIdx;
            return (
              <React.Fragment key={s.key}>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-emerald-800 text-white shadow-2xs'
                        : isCompleted
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-stone-100 text-stone-500 border border-stone-200'
                    }`}
                  >
                    {isCompleted ? '✓' : s.num}
                  </div>
                  <span
                    className={`text-xs font-semibold hidden sm:inline ${
                      isActive ? 'text-stone-900' : isCompleted ? 'text-emerald-900' : 'text-stone-500'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      idx < currentIdx ? 'bg-emerald-300' : 'bg-stone-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3.5 font-sans max-w-2xl mx-auto pb-8">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (step === 'SUCCESS') {
              onNavigate('/app/transactions');
            } else if (step === 'CONFIRM') {
              setStep('DETAILS');
            } else if (step === 'DETAILS') {
              setStep('TYPE');
            } else if (step === 'TYPE') {
              setStep('CUSTOMER');
            } else {
              onNavigate('/app/home');
            }
          }}
          className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>
            {step === 'CONFIRM'
              ? 'Edit Details'
              : step === 'DETAILS'
              ? 'Change Transaction Type'
              : step === 'TYPE'
              ? 'Change Customer'
              : 'Back to Counter'}
          </span>
        </button>

        {selectedCustomer && step !== 'CUSTOMER' && step !== 'SUCCESS' && (
          <button
            type="button"
            onClick={() => setStep('CUSTOMER')}
            className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
          >
            <User className="w-3 h-3" />
            <span>{selectedCustomer.name}</span>
            <span className="text-stone-400">·</span>
            <span className="underline">Change</span>
          </button>
        )}
      </div>

      {renderStepHeader()}

      {/* =========================================================================
          STEP 1: CUSTOMER SELECTION
         ========================================================================= */}
      {step === 'CUSTOMER' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs space-y-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                Select Customer
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Search by name, mobile number, or customer account code
              </p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search Rahim Sheikh, 98765, CUST-..."
                className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-700"
              />
            </div>

            {/* Walk-in or No Customer Option */}
            <div
              onClick={() => {
                setSelectedCustomer(undefined);
                setStep('TYPE');
              }}
              className="p-3 bg-stone-50 hover:bg-stone-100/80 rounded-xl border border-stone-200 flex items-center justify-between cursor-pointer transition-colors active:bg-stone-100"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-stone-200 text-stone-600 flex items-center justify-center font-bold text-xs">
                  W
                </div>
                <div>
                  <span className="text-xs font-bold text-stone-900 block">
                    Walk-in / Cash Retail Customer
                  </span>
                  <span className="text-[11px] text-stone-500">
                    No ledger account (direct cash sale or shop expense)
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400" />
            </div>

            {/* Customer Results List */}
            <div className="space-y-1.5 max-h-80 overflow-y-auto pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 px-1 block">
                Khata Accounts ({filteredCustomers.length})
              </span>
              {filteredCustomers.length === 0 ? (
                <div className="p-4 text-center text-xs text-stone-500">
                  No matching customer found.
                </div>
              ) : (
                filteredCustomers.map((cust) => (
                  <div
                    key={cust.id}
                    onClick={() => {
                      setSelectedCustomer(cust);
                      setStep('TYPE');
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      selectedCustomer?.id === cust.id
                        ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-500/20'
                        : 'bg-white hover:bg-stone-50/80 border-stone-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {cust.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                            {cust.name}
                          </span>
                          {cust.customerCode && (
                            <span className="text-[10px] font-mono text-stone-500 bg-stone-100 px-1 py-0.5 rounded">
                              #{cust.customerCode}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-stone-500">
                          {cust.phone && <span>+91 {cust.phone}</span>}
                          {cust.villageOrArea && <span>· {cust.villageOrArea}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {cust.currentDueAmount > 0 ? (
                        <span className="text-xs font-bold text-rose-800 font-mono block">
                          Due: {formatRupees(cust.currentDueAmount)}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-800 block">
                          Due: ₹0
                        </span>
                      )}
                      <span className="text-[10px] text-stone-500">
                        Wheat: {cust.wheatBalanceKg || 0} kg
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 2: TRANSACTION TYPE SELECTION
         ========================================================================= */}
      {step === 'TYPE' && (
        <div className="space-y-3">
          {/* Selected Customer Quick Banner */}
          <div className="bg-stone-100/90 rounded-xl p-3 border border-stone-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-800" />
              <div>
                <span className="text-xs font-bold text-stone-900 block">
                  {selectedCustomer ? selectedCustomer.name : 'Walk-in / Cash Retail'}
                </span>
                {selectedCustomer && (
                  <span className="text-[11px] text-stone-600">
                    Khata Balance: Due {formatRupees(selectedCustomer.currentDueAmount)} · Wheat: {selectedCustomer.wheatBalanceKg || 0} kg
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep('CUSTOMER')}
              className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
            >
              Change
            </button>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs space-y-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                Select Transaction Type
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Choose the operation to record at the chakki counter
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {(
                [
                  { id: 'all', label: 'All Operations' },
                  { id: 'milling', label: 'Milling & Atta' },
                  { id: 'trading', label: 'Rice & Wheat Trading' },
                  { id: 'khata', label: 'Khata & Cash' },
                  { id: 'business', label: 'Business / Shop' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setTypeCategoryFilter(cat.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    typeCategoryFilter === cat.id
                      ? 'bg-emerald-800 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Types Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {availableDefinitions
                .filter((def) => typeCategoryFilter === 'all' || def.category === typeCategoryFilter)
                .map((def) => {
                  const isSelected = selectedType === def.type;
                  return (
                    <div
                      key={def.type}
                      onClick={() => {
                        setSelectedType(def.type);
                        setStep('DETAILS');
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 text-left active:scale-[0.99] ${
                        isSelected
                          ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-600/20'
                          : 'bg-white hover:bg-stone-50/80 border-stone-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-stone-100 border border-stone-200">
                            {renderDefIcon(def.type)}
                          </div>
                          <div>
                            <span className="text-xs sm:text-sm font-bold text-stone-900 block leading-tight">
                              {def.label}
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                              {def.category}
                            </span>
                          </div>
                        </div>

                        {def.type === TransactionType.RICE_ATTA_SETTLEMENT && (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                            Common
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-stone-600 line-clamp-2">
                        {def.description}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 3: TRANSACTION DETAILS FORM (DYNAMIC FORM ENGINE)
         ========================================================================= */}
      {step === 'DETAILS' && (
        <div className="space-y-3">
          {/* Header Summary of Selection */}
          <div className="bg-white rounded-xl border border-stone-200 p-3.5 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                {renderDefIcon(selectedType)}
              </div>
              <div>
                <span className="text-sm font-bold text-stone-900 block">
                  {currentDef.label}
                </span>
                <span className="text-xs text-stone-600">
                  Customer: <strong>{selectedCustomer ? selectedCustomer.name : 'Walk-in / Cash'}</strong>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep('TYPE')}
              className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
            >
              Change Type
            </button>
          </div>

          {/* DYNAMIC FORM INPUTS */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700">
              Transaction Inputs
            </h3>

            {/* SPECIFIC CASE 1: RICE -> ATTA SETTLEMENT (The core test scenario!) */}
            {selectedType === TransactionType.RICE_ATTA_SETTLEMENT && (
              <div className="space-y-4">
                {/* STEP 2: RICE DETAILS */}
                <div className="p-4 bg-sky-50/70 rounded-xl border border-sky-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-950 uppercase tracking-wider">
                      Rice Details (Inflow)
                    </span>
                    <span className="text-xs font-mono font-bold text-sky-900 bg-sky-200/80 px-2 py-0.5 rounded border border-sky-300">
                      Standard Rate: ₹{raStandardRiceRate}/kg
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Quantity (kg) *
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={raRiceQty === 0 ? '' : raRiceQty}
                        onChange={(e) => setRaRiceQty(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                        placeholder="15"
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Purchase Rate (₹/kg)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        disabled={!raIsCustomRiceRate}
                        value={raIsCustomRiceRate ? (raCustomRiceRate === 0 ? '' : raCustomRiceRate) : raStandardRiceRate}
                        onChange={(e) => setRaCustomRiceRate(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                        placeholder="21"
                        className={`w-full px-3 py-2 border rounded-lg text-sm font-mono font-bold text-stone-900 focus:outline-none ${
                          raIsCustomRiceRate
                            ? 'bg-white border-amber-400 ring-1 ring-amber-300'
                            : 'bg-stone-100 border-stone-300 text-stone-600'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Calculated Rice Value */}
                  <div className="p-2.5 bg-white/90 rounded-lg border border-sky-200 flex items-center justify-between text-xs">
                    <span className="text-stone-600 font-mono">
                      Rice Value: {formatKg(raRiceQty)} × ₹{raSettlementCalc.riceRate}/kg
                    </span>
                    <span className="font-mono font-bold text-sky-900 text-sm">
                      {formatRupees(raSettlementCalc.riceValue)}
                    </span>
                  </div>

                  {/* Rate Override Section */}
                  <div className="pt-2 border-t border-sky-200/80 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={raIsCustomRiceRate}
                        disabled={!isOwner}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setRaIsCustomRiceRate(checked);
                          if (!checked) {
                            setRaCustomRiceRate(raStandardRiceRate);
                            setRaRiceOverrideReason('');
                          }
                        }}
                        className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4 disabled:opacity-50"
                      />
                      <span className="text-xs font-semibold text-stone-800">
                        Use custom rice rate {!isOwner && '(Owner only)'}
                      </span>
                    </label>

                    {raIsCustomRiceRate && (
                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-0.5">
                            Override Reason *
                          </label>
                          <input
                            type="text"
                            value={raRiceOverrideReason}
                            onChange={(e) => setRaRiceOverrideReason(e.target.value)}
                            placeholder="e.g. Higher quality ration rice lot or special customer rate"
                            className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* STEP 3: ATTA DETAILS */}
                <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                      Atta Purchase (Outflow)
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded border border-amber-300">
                      Standard: ₹{raStandardAttaRate}/kg
                    </span>
                  </div>

                  {/* Variety Selection */}
                  <div>
                    <label className="text-[11px] font-bold text-stone-700 block mb-1">
                      Variety Selection *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRaAttaType(AttaType.ROLL_ATTA);
                          if (!raIsCustomAttaRate) {
                            setRaCustomAttaRate(rates.rollAttaSellingRate || 40);
                          }
                        }}
                        className={`p-2 rounded-lg border text-left cursor-pointer transition-colors ${
                          raAttaType === AttaType.ROLL_ATTA
                            ? 'bg-amber-100/90 border-amber-500 text-amber-950 font-bold ring-1 ring-amber-400'
                            : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <div className="text-xs font-bold">Roll Atta (Fine)</div>
                        <div className="text-[11px] font-mono text-stone-500">
                          Standard: ₹{rates.rollAttaSellingRate || 40}/kg
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRaAttaType(AttaType.CHALI_ATTA);
                          if (!raIsCustomAttaRate) {
                            setRaCustomAttaRate(rates.chaliAttaSellingRate || 35);
                          }
                        }}
                        className={`p-2 rounded-lg border text-left cursor-pointer transition-colors ${
                          raAttaType === AttaType.CHALI_ATTA
                            ? 'bg-amber-100/90 border-amber-500 text-amber-950 font-bold ring-1 ring-amber-400'
                            : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <div className="text-xs font-bold">Chali Atta (Coarse)</div>
                        <div className="text-[11px] font-mono text-stone-500">
                          Standard: ₹{rates.chaliAttaSellingRate || 35}/kg
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Quantity (kg) *
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={raAttaQty === 0 ? '' : raAttaQty}
                        onChange={(e) => setRaAttaQty(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                        placeholder="5"
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Selling Rate (₹/kg)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        disabled={!raIsCustomAttaRate}
                        value={raIsCustomAttaRate ? (raCustomAttaRate === 0 ? '' : raCustomAttaRate) : raStandardAttaRate}
                        onChange={(e) => setRaCustomAttaRate(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                        placeholder="40"
                        className={`w-full px-3 py-2 border rounded-lg text-sm font-mono font-bold text-stone-900 focus:outline-none ${
                          raIsCustomAttaRate
                            ? 'bg-white border-amber-400 ring-1 ring-amber-300'
                            : 'bg-stone-100 border-stone-300 text-stone-600'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Calculated Atta Value */}
                  <div className="p-2.5 bg-white/90 rounded-lg border border-amber-200 flex items-center justify-between text-xs">
                    <span className="text-stone-600 font-mono">
                      Atta Value: {formatKg(raAttaQty)} × ₹{raSettlementCalc.attaRate}/kg
                    </span>
                    <span className="font-mono font-bold text-amber-950 text-sm">
                      {formatRupees(raSettlementCalc.attaValue)}
                    </span>
                  </div>

                  {/* Rate Override Section */}
                  <div className="pt-2 border-t border-amber-200/80 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={raIsCustomAttaRate}
                        disabled={!isOwner}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setRaIsCustomAttaRate(checked);
                          if (!checked) {
                            setRaCustomAttaRate(raStandardAttaRate);
                            setRaAttaOverrideReason('');
                          }
                        }}
                        className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 disabled:opacity-50"
                      />
                      <span className="text-xs font-semibold text-stone-800">
                        Use custom atta rate {!isOwner && '(Owner only)'}
                      </span>
                    </label>

                    {raIsCustomAttaRate && (
                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-0.5">
                            Override Reason *
                          </label>
                          <input
                            type="text"
                            value={raAttaOverrideReason}
                            onChange={(e) => setRaAttaOverrideReason(e.target.value)}
                            placeholder="e.g. Bulk discount or negotiated customer price"
                            className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* STEP 4: PROMINENT SETTLEMENT UI (Section 12) */}
                <div className="p-4 bg-white rounded-xl border-2 border-stone-300 shadow-sm space-y-3">
                  <div className="text-xs font-mono space-y-1.5 text-stone-600">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-stone-700">RICE CREDIT:</span>
                      <span className="font-bold text-sky-900 text-sm">{formatRupees(raSettlementCalc.riceValue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-stone-700">ATTA BILL:</span>
                      <span className="font-bold text-amber-950 text-sm">{formatRupees(raSettlementCalc.attaValue)}</span>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t-2 border-dashed border-stone-300 flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">
                      Settlement Outcome:
                    </span>
                    <span className={`text-base font-mono font-extrabold ${
                      raSettlementCalc.settlementDirection === 'CUSTOMER_RECEIVES'
                        ? 'text-emerald-700'
                        : raSettlementCalc.settlementDirection === 'CUSTOMER_PAYS'
                        ? 'text-rose-700'
                        : 'text-stone-800'
                    }`}>
                      {raSettlementCalc.plainLanguageResult}
                    </span>
                  </div>
                </div>

                {/* PAYMENT STATUS SELECTION (Section 22 & 23) */}
                <div className="p-3.5 bg-stone-100 rounded-xl border border-stone-200 space-y-2">
                  <span className="text-xs font-bold text-stone-800 uppercase tracking-wide block">
                    Cash Payment Collection / Payout
                  </span>

                  {raSettlementCalc.settlementDirection === 'CUSTOMER_RECEIVES' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRaPaymentOption('PAID_NOW')}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                          raPaymentOption === 'PAID_NOW'
                            ? 'bg-emerald-100 border-emerald-500 text-emerald-950 font-bold ring-1 ring-emerald-400'
                            : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <div className="text-xs font-bold">Cash Handed Over Now</div>
                        <div className="text-[10px] text-emerald-800">Shop pays ₹{raSettlementCalc.settlementAmount} (PAID)</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRaPaymentOption('PENDING')}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                          raPaymentOption === 'PENDING'
                            ? 'bg-sky-100 border-sky-500 text-sky-950 font-bold ring-1 ring-sky-400'
                            : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <div className="text-xs font-bold">Keep as Khata Credit</div>
                        <div className="text-[10px] text-sky-800">Customer collects later (PENDING)</div>
                      </button>
                    </div>
                  )}

                  {raSettlementCalc.settlementDirection === 'CUSTOMER_PAYS' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setRaPaymentOption('PAID_NOW')}
                          className={`p-2 rounded-lg border text-left cursor-pointer transition-colors ${
                            raPaymentOption === 'PAID_NOW'
                              ? 'bg-emerald-100 border-emerald-500 text-emerald-950 font-bold ring-1 ring-emerald-400'
                              : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          <div className="text-xs font-bold">Full Cash Paid</div>
                          <div className="text-[10px] text-emerald-800">₹{raSettlementCalc.settlementAmount} (PAID)</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRaPaymentOption('PENDING')}
                          className={`p-2 rounded-lg border text-left cursor-pointer transition-colors ${
                            raPaymentOption === 'PENDING'
                              ? 'bg-rose-100 border-rose-500 text-rose-950 font-bold ring-1 ring-rose-400'
                              : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          <div className="text-xs font-bold">Add to Due</div>
                          <div className="text-[10px] text-rose-800">Pay later (PENDING)</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRaPaymentOption('PARTIAL')}
                          className={`p-2 rounded-lg border text-left cursor-pointer transition-colors ${
                            raPaymentOption === 'PARTIAL'
                              ? 'bg-amber-100 border-amber-500 text-amber-950 font-bold ring-1 ring-amber-400'
                              : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          <div className="text-xs font-bold">Partial Cash</div>
                          <div className="text-[10px] text-amber-800">Split payment (PARTIAL)</div>
                        </button>
                      </div>

                      {raPaymentOption === 'PARTIAL' && (
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            Amount Paid in Cash Now (₹) *
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max={raSettlementCalc.settlementAmount}
                            value={raPartialAmount || ''}
                            onChange={(e) => setRaPartialAmount(parseFloat(e.target.value) || 0)}
                            placeholder="e.g. 50"
                            className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {raSettlementCalc.settlementDirection === 'SETTLED' && (
                    <div className="p-2.5 bg-white rounded-lg border border-stone-200 text-xs text-stone-700 font-medium">
                      ✓ Values match exactly. No cash exchange required.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SPECIFIC CASE: RICE -> CASH SETTLEMENT */}
            {selectedType === TransactionType.RICE_CASH_SETTLEMENT && (
              <div className="space-y-4">
                {/* Visual badge explaining zero atta & business purpose */}
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-start gap-2.5">
                  <Banknote className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-teal-950">
                    <span className="font-bold block">Ration Rice Cash Purchase</span>
                    <span className="text-[11px] text-teal-800">
                      Customer sells ration rice to the chakki for immediate cash or khata credit. No atta is given or milled.
                    </span>
                  </div>
                </div>

                {/* 1. Rice Quantity */}
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                      1. Ration Rice Weight (kg) *
                    </label>
                    <span className="text-[11px] font-mono text-stone-500">Inflow to Shop</span>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={rcQty || ''}
                      onChange={(e) => setRcQty(parseFloat(e.target.value) || 0)}
                      placeholder="e.g. 15"
                      className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-lg font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500 font-mono">
                      KG
                    </span>
                  </div>

                  {/* Quick select buttons */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-1 text-xs">
                    <span className="text-[10px] uppercase font-bold text-stone-600 shrink-0">Quick:</span>
                    {[5, 10, 15, 20, 25, 30, 50].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRcQty(preset)}
                        className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                          rcQty === preset
                            ? 'bg-teal-700 text-white'
                            : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        {preset} kg
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Purchase Rate & Override */}
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                      2. Purchase Rate (₹/kg)
                    </label>
                    <span className="text-[11px] font-mono text-stone-600">
                      Standard: ₹{rcStandardRate}/kg
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      disabled={!rcIsCustomRate}
                      value={rcIsCustomRate ? (rcCustomRate === 0 ? '' : rcCustomRate) : rcStandardRate}
                      onChange={(e) => setRcCustomRate(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      placeholder="21"
                      className={`w-full px-3 py-2.5 border rounded-xl text-base font-mono font-bold text-stone-900 focus:outline-none ${
                        rcIsCustomRate
                          ? 'bg-white border-amber-400 ring-2 ring-amber-300'
                          : 'bg-stone-100 border-stone-300 text-stone-600'
                      }`}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500 font-mono">
                      ₹/KG
                    </span>
                  </div>

                  {/* Owner Rate Override Toggle */}
                  <div className="pt-2 border-t border-stone-200 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rcIsCustomRate}
                        disabled={!isOwner}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setRcIsCustomRate(checked);
                          if (!checked) {
                            setRcCustomRate(rcStandardRate);
                            setRcOverrideReason('');
                          }
                        }}
                        className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 disabled:opacity-50"
                      />
                      <span className="text-xs font-semibold text-stone-800">
                        Custom Rate Override {!isOwner && '(Owner only)'}
                      </span>
                    </label>

                    {rcIsCustomRate && (
                      <div>
                        <label className="text-[11px] font-bold text-stone-700 block mb-1">
                          Mandatory Reason for Rate Override *
                        </label>
                        <input
                          type="text"
                          value={rcOverrideReason}
                          onChange={(e) => setRcOverrideReason(e.target.value)}
                          placeholder="e.g. Broken rice / special counter rate approved by owner"
                          className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Value Calculation Card */}
                <div className="p-3.5 bg-teal-50/70 rounded-xl border border-teal-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600 font-medium">Grain Value (Quantity × Rate):</span>
                    <span className="font-mono font-extrabold text-teal-950 text-base">
                      {formatRupees(rcSettlementCalc.settlementAmount)}
                    </span>
                  </div>
                  <div className="text-[11px] text-teal-800 flex items-center justify-between">
                    <span>{formatKg(rcQty)} × ₹{rcSettlementCalc.rate}/kg</span>
                    <span className="font-bold">Shop Pays Customer</span>
                  </div>
                </div>

                {/* 3. Payment Option */}
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
                  <label className="text-xs font-bold text-stone-800 uppercase tracking-wider block">
                    3. Counter Payment Settlement
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setRcPaymentOption('PAID')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        rcPaymentOption === 'PAID'
                          ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-950 ring-1 ring-emerald-400'
                          : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <span className="text-xs block">Full Cash Paid</span>
                      <span className="text-[11px] font-mono text-emerald-800">
                        {formatRupees(rcSettlementCalc.settlementAmount)} (Settled)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRcPaymentOption('PENDING')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        rcPaymentOption === 'PENDING'
                          ? 'bg-sky-50 border-sky-500 font-bold text-sky-950 ring-1 ring-sky-400'
                          : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <span className="text-xs block">Keep as Khata Credit</span>
                      <span className="text-[11px] font-mono text-sky-800">
                        Pay Later ({formatRupees(rcSettlementCalc.settlementAmount)})
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRcPaymentOption('PARTIAL');
                        if (!rcPartialAmount) {
                          setRcPartialAmount(Math.floor(rcSettlementCalc.settlementAmount / 2));
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        rcPaymentOption === 'PARTIAL'
                          ? 'bg-amber-50 border-amber-500 font-bold text-amber-950 ring-1 ring-amber-400'
                          : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <span className="text-xs block">Partial Cash Paid</span>
                      <span className="text-[11px] font-mono text-amber-800">
                        Split Handover
                      </span>
                    </button>
                  </div>

                  {rcPaymentOption === 'PARTIAL' && (
                    <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-2 mt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            Cash Handed Over Now (₹) *
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max={rcSettlementCalc.settlementAmount}
                            value={rcPartialAmount || ''}
                            onChange={(e) => setRcPartialAmount(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm font-mono font-bold text-stone-900"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            Remaining Khata Credit
                          </label>
                          <div className="px-3 py-2 bg-sky-50 rounded-lg text-sm font-mono font-bold text-sky-950 border border-sky-200">
                            {formatRupees(rcSettlementCalc.remainingAmount)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Remarks / Notes */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Notes / Bag Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Clean ration rice in white plastic bag"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>
            )}

            {/* SPECIFIC CASE: WHEAT -> CASH SETTLEMENT */}
            {selectedType === TransactionType.WHEAT_CASH_SETTLEMENT && (
              <div className="space-y-4">
                {/* Visual badge explaining zero atta & business purpose */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                  <Coins className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-950">
                    <span className="font-bold block">Wheat Cash Purchase (Independent Rate)</span>
                    <span className="text-[11px] text-amber-800">
                      Customer sells raw wheat to the chakki for cash. This is a direct grain purchase at shop rate (₹{wcStandardRate}/kg) — separate from the ₹8 or ₹10 milling exchange fees. No atta is given or milled.
                    </span>
                  </div>
                </div>

                {/* 1. Wheat Quantity */}
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                      1. Wheat Weight Brought by Customer (kg) *
                    </label>
                    <span className="text-[11px] font-mono text-stone-500">Inflow to Shop</span>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={wcQty || ''}
                      onChange={(e) => setWcQty(parseFloat(e.target.value) || 0)}
                      placeholder="e.g. 15"
                      className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-lg font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500 font-mono">
                      KG
                    </span>
                  </div>

                  {/* Quick select buttons */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-1 text-xs">
                    <span className="text-[10px] uppercase font-bold text-stone-600 shrink-0">Quick:</span>
                    {[5, 10, 15, 20, 25, 30, 50].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setWcQty(preset)}
                        className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                          wcQty === preset
                            ? 'bg-amber-800 text-white'
                            : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        {preset} kg
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Purchase Rate & Override */}
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                      2. Wheat Purchase Rate (₹/kg)
                    </label>
                    <span className="text-[11px] font-mono text-stone-600">
                      Standard: ₹{wcStandardRate}/kg
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      disabled={!wcIsCustomRate}
                      value={wcIsCustomRate ? (wcCustomRate === 0 ? '' : wcCustomRate) : wcStandardRate}
                      onChange={(e) => setWcCustomRate(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      placeholder="24"
                      className={`w-full px-3 py-2.5 border rounded-xl text-base font-mono font-bold text-stone-900 focus:outline-none ${
                        wcIsCustomRate
                          ? 'bg-white border-amber-400 ring-2 ring-amber-300'
                          : 'bg-stone-100 border-stone-300 text-stone-600'
                      }`}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500 font-mono">
                      ₹/KG
                    </span>
                  </div>

                  {/* Owner Rate Override Toggle */}
                  <div className="pt-2 border-t border-stone-200 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={wcIsCustomRate}
                        disabled={!isOwner}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setWcIsCustomRate(checked);
                          if (!checked) {
                            setWcCustomRate(wcStandardRate);
                            setWcOverrideReason('');
                          }
                        }}
                        className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 disabled:opacity-50"
                      />
                      <span className="text-xs font-semibold text-stone-800">
                        Custom Rate Override {!isOwner && '(Owner only)'}
                      </span>
                    </label>

                    {wcIsCustomRate && (
                      <div>
                        <label className="text-[11px] font-bold text-stone-700 block mb-1">
                          Mandatory Reason for Rate Override *
                        </label>
                        <input
                          type="text"
                          value={wcOverrideReason}
                          onChange={(e) => setWcOverrideReason(e.target.value)}
                          placeholder="e.g. High moisture wheat / special counter rate approved by owner"
                          className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Value Calculation Card */}
                <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600 font-medium">Grain Value (Quantity × Rate):</span>
                    <span className="font-mono font-extrabold text-amber-950 text-base">
                      {formatRupees(wcSettlementCalc.settlementAmount)}
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-800 flex items-center justify-between">
                    <span>{formatKg(wcQty)} × ₹{wcSettlementCalc.rate}/kg</span>
                    <span className="font-bold">Shop Pays Customer</span>
                  </div>
                </div>

                {/* 3. Payment Option */}
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
                  <label className="text-xs font-bold text-stone-800 uppercase tracking-wider block">
                    3. Counter Payment Settlement
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setWcPaymentOption('PAID')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        wcPaymentOption === 'PAID'
                          ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-950 ring-1 ring-emerald-400'
                          : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <span className="text-xs block">Full Cash Paid</span>
                      <span className="text-[11px] font-mono text-emerald-800">
                        {formatRupees(wcSettlementCalc.settlementAmount)} (Settled)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWcPaymentOption('PENDING')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        wcPaymentOption === 'PENDING'
                          ? 'bg-sky-50 border-sky-500 font-bold text-sky-950 ring-1 ring-sky-400'
                          : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <span className="text-xs block">Keep as Khata Credit</span>
                      <span className="text-[11px] font-mono text-sky-800">
                        Pay Later ({formatRupees(wcSettlementCalc.settlementAmount)})
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setWcPaymentOption('PARTIAL');
                        if (!wcPartialAmount) {
                          setWcPartialAmount(Math.floor(wcSettlementCalc.settlementAmount / 2));
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        wcPaymentOption === 'PARTIAL'
                          ? 'bg-amber-50 border-amber-500 font-bold text-amber-950 ring-1 ring-amber-400'
                          : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <span className="text-xs block">Partial Cash Paid</span>
                      <span className="text-[11px] font-mono text-amber-800">
                        Split Handover
                      </span>
                    </button>
                  </div>

                  {wcPaymentOption === 'PARTIAL' && (
                    <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-2 mt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            Cash Handed Over Now (₹) *
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max={wcSettlementCalc.settlementAmount}
                            value={wcPartialAmount || ''}
                            onChange={(e) => setWcPartialAmount(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm font-mono font-bold text-stone-900"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            Remaining Khata Credit
                          </label>
                          <div className="px-3 py-2 bg-sky-50 rounded-lg text-sm font-mono font-bold text-sky-950 border border-sky-200">
                            {formatRupees(wcSettlementCalc.remainingAmount)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Remarks / Notes */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Notes / Bag Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Dry farm wheat in gunny bag"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>
              </div>
            )}

            {/* SPECIFIC CASE 2: WHEAT DEPOSIT */}
            {selectedType === TransactionType.WHEAT_DEPOSIT && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Wheat Deposit Weight (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={generalQty || ''}
                    onChange={(e) => setGeneralQty(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 50"
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-base font-mono font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Bags Marks / Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. 1 bag marked RS, dry clean wheat"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>
            )}

            {/* SPECIFIC CASE 3: WHEAT -> ATTA EXCHANGE (Core workflow) */}
            {selectedType === TransactionType.WHEAT_ATTA_EXCHANGE && (
              <div className="space-y-4">
                {/* 1. Atta Variety Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                      1. Select Atta Variety
                    </label>
                    <span className="text-[11px] text-stone-500 font-medium">
                      Configured shop rates
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Roll Atta */}
                    <button
                      type="button"
                      onClick={() => {
                        setWeAttaType(AttaType.ROLL_ATTA);
                        if (!weIsCustomRate) {
                          setWeCustomRate(rates.rollAttaExchangeRate || 10);
                        }
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all relative ${
                        weAttaType === AttaType.ROLL_ATTA
                          ? 'bg-amber-50 border-amber-400 font-bold text-amber-950 ring-2 ring-amber-400/30'
                          : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      {weAttaType === AttaType.ROLL_ATTA && (
                        <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                      <span className="text-xs sm:text-sm font-bold block">Roll Atta</span>
                      <span className="text-[11px] text-stone-500 block">Fine / Commercial Flour</span>
                      <div className="mt-2 flex items-center gap-1">
                        <span className="text-xs font-mono font-bold text-amber-950 bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
                          ₹{rates.rollAttaExchangeRate || 10}/kg
                        </span>
                      </div>
                    </button>

                    {/* Chali Atta */}
                    <button
                      type="button"
                      onClick={() => {
                        setWeAttaType(AttaType.CHALI_ATTA);
                        if (!weIsCustomRate) {
                          setWeCustomRate(rates.chaliAttaExchangeRate || 8);
                        }
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all relative ${
                        weAttaType === AttaType.CHALI_ATTA
                          ? 'bg-amber-50 border-amber-400 font-bold text-amber-950 ring-2 ring-amber-400/30'
                          : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      {weAttaType === AttaType.CHALI_ATTA && (
                        <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                      <span className="text-xs sm:text-sm font-bold block">Chali Atta</span>
                      <span className="text-[11px] text-stone-500 block">Coarse / Bran-Intact</span>
                      <div className="mt-2 flex items-center gap-1">
                        <span className="text-xs font-mono font-bold text-amber-950 bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
                          ₹{rates.chaliAttaExchangeRate || 8}/kg
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. Wheat Quantity Input with Quick Add Buttons */}
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
                  <div className="p-3 bg-amber-100/70 rounded-xl border border-amber-300">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-amber-900 block">Current Wheat Balance</span>
                    <span className="text-xl font-mono font-bold text-amber-950">{formatKg(availableWheat)}</span>
                    <span className="text-[11px] text-amber-900 block mt-0.5">Maximum available for this exchange</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                      2. Wheat Quantity Brought In (kg) *
                    </label>
                    <span className="text-[11px] text-stone-500 font-medium">
                      Customer grain inflow
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={weWheatQty || ''}
                      onChange={(e) => setWeWheatQty(parseFloat(e.target.value) || 0)}
                      max={availableWheat}
                      placeholder="e.g. 15"
                      className={`w-full pl-3 pr-12 py-2.5 bg-white border rounded-xl text-base sm:text-lg font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 ${wheatExchangeExceedsBalance ? 'border-red-400' : 'border-stone-300'}`}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                      kg
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500">Maximum: {formatKg(availableWheat)}</p>
                  {wheatExchangeExceedsBalance && (
                    <p className="text-xs font-semibold text-red-700" role="alert">
                      Customer has only {formatKg(availableWheat)} wheat available.
                    </p>
                  )}

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] uppercase font-bold text-stone-400 mr-0.5">Presets:</span>
                    {[5, 10, 15, 20, 25, 50].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setWeWheatQty(preset)}
                        className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
                          weWheatQty === preset
                            ? 'bg-amber-700 text-white shadow-2xs'
                            : 'bg-white hover:bg-stone-200 text-stone-700 border border-stone-300'
                        }`}
                      >
                        {preset} kg
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Output Atta Delivery & Live Calculation Box */}
                <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-300 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1">
                      <Wheat className="w-3.5 h-3.5 text-amber-700" />
                      Milled Atta Output & Exchange Value
                    </span>
                    <span className="text-[10px] font-mono text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                      Yield: {rates.wheatToAttaConversionRatio || 1.0}x
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-2.5 bg-white rounded-lg border border-amber-200">
                      <span className="text-[10px] text-stone-500 uppercase font-bold block">Atta Delivered</span>
                      <span className="text-sm sm:text-base font-mono font-bold text-stone-900">
                        {formatKg(weExchangeCalc.attaQuantityGiven)}
                      </span>
                      <span className="text-[10px] text-amber-800 font-medium block truncate">
                        {weExchangeCalc.attaTypeName}
                      </span>
                    </div>

                    <div className="p-2.5 bg-white rounded-lg border border-amber-200">
                      <span className="text-[10px] text-stone-500 uppercase font-bold block">Exchange Value</span>
                      <span className="text-sm sm:text-base font-mono font-bold text-amber-950">
                        {formatRupees(weExchangeCalc.calculatedExchangeValue)}
                      </span>
                      <span className="text-[10px] text-stone-500 font-mono block">
                        @ ₹{weExchangeCalc.appliedRate}/kg
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-stone-600 font-mono bg-white/70 p-2 rounded-lg border border-amber-100">
                    Formula: {weWheatQty || 0} kg Wheat × ₹{weExchangeCalc.appliedRate}/kg = {formatRupees(weExchangeCalc.calculatedExchangeValue)}
                  </div>
                </div>

                {/* 4. Rate Override Section (Accessible to Owner) */}
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {role === 'OWNER' ? (
                        <Unlock className="w-3.5 h-3.5 text-amber-700" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-stone-400" />
                      )}
                      <span className="text-xs font-bold text-stone-800">
                        Exchange Rate Override
                      </span>
                    </div>

                    {role === 'OWNER' ? (
                      <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={weIsCustomRate}
                          onChange={(e) => {
                            setWeIsCustomRate(e.target.checked);
                            if (!e.target.checked) {
                              setWeCustomRate(weStandardRate);
                              setWeOverrideReason('');
                            }
                          }}
                          className="rounded text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                        />
                        <span className="text-[11px] font-semibold">Override Rate</span>
                      </label>
                    ) : (
                      <span className="text-[10px] text-stone-500 italic">
                        Owner access required
                      </span>
                    )}
                  </div>

                  {weIsCustomRate && role === 'OWNER' && (
                    <div className="pt-2 border-t border-stone-200 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            Custom Rate (₹/kg) *
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            value={weCustomRate || ''}
                            onChange={(e) => setWeCustomRate(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            Configured Std Rate
                          </label>
                          <div className="px-3 py-1.5 bg-stone-100 rounded-lg text-xs font-mono text-stone-500 border border-stone-200">
                            ₹{weStandardRate}/kg
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-stone-700 block mb-1">
                          Mandatory Reason for Rate Override *
                        </label>
                        <input
                          type="text"
                          value={weOverrideReason}
                          onChange={(e) => setWeOverrideReason(e.target.value)}
                          placeholder="e.g. Bulk discount approved by Owner"
                          className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Payment & Settlement Options */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-700 block uppercase tracking-wider">
                    3. Payment Collection & Khata Settlement
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setWePaymentOption('FULL_CASH')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        wePaymentOption === 'FULL_CASH'
                          ? 'bg-emerald-50 border-emerald-400 font-bold text-emerald-950 ring-1 ring-emerald-400'
                          : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <span className="text-xs block">Full Cash Paid</span>
                      <span className="text-[11px] font-mono text-emerald-800">
                        {formatRupees(weExchangeCalc.calculatedExchangeValue)} (Settled)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWePaymentOption('ADD_TO_DUE')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        wePaymentOption === 'ADD_TO_DUE'
                          ? 'bg-rose-50 border-rose-400 font-bold text-rose-950 ring-1 ring-rose-400'
                          : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <span className="text-xs block">Add to Khata Due</span>
                      <span className="text-[11px] font-mono text-rose-800">
                        ₹0 paid (Due: {formatRupees(weExchangeCalc.calculatedExchangeValue)})
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setWePaymentOption('PARTIAL');
                        if (!wePartialAmount) {
                          setWePartialAmount(Math.floor(weExchangeCalc.calculatedExchangeValue / 2));
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        wePaymentOption === 'PARTIAL'
                          ? 'bg-amber-50 border-amber-400 font-bold text-amber-950 ring-1 ring-amber-400'
                          : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <span className="text-xs block">Partial Payment</span>
                      <span className="text-[11px] font-mono text-amber-800">
                        Custom Cash Paid
                      </span>
                    </button>
                  </div>

                  {wePaymentOption === 'PARTIAL' && (
                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            Cash Received (₹) *
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max={weExchangeCalc.calculatedExchangeValue}
                            value={wePartialAmount || ''}
                            onChange={(e) => setWePartialAmount(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm font-mono font-bold text-stone-900"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            Remaining Due to Khata
                          </label>
                          <div className="px-3 py-2 bg-white rounded-lg text-sm font-mono font-bold text-rose-800 border border-stone-200">
                            {formatRupees(Math.max(0, weExchangeCalc.calculatedExchangeValue - (wePartialAmount || 0)))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. Remarks / Notes */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Notes / Bag Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Customer brought plastic sack, clean wheat"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}

            {/* SPECIFIC CASE 4: CASH PAYMENT */}
            {selectedType === TransactionType.CASH_PAYMENT && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Cash Payment Received (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={paidAmount || generalRate || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setPaidAmount(val);
                      setGeneralRate(val);
                    }}
                    placeholder="500"
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-lg font-mono font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Payment Note
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Cash received at counter"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs text-stone-900"
                  />
                </div>
              </div>
            )}

            {/* SPECIFIC CASE 5: GENERIC SINGLE QUANTITY/RATE (Atta Purchase, Rice Purchase, etc.) */}
            {selectedType !== TransactionType.RICE_ATTA_SETTLEMENT &&
              selectedType !== TransactionType.RICE_CASH_SETTLEMENT &&
              selectedType !== TransactionType.WHEAT_CASH_SETTLEMENT &&
              selectedType !== TransactionType.WHEAT_DEPOSIT &&
              selectedType !== TransactionType.WHEAT_ATTA_EXCHANGE &&
              selectedType !== TransactionType.CASH_PAYMENT &&
              selectedType !== TransactionType.CORRECTION &&
              selectedType !== TransactionType.REVERSAL && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Quantity / Units
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={generalQty || ''}
                        onChange={(e) => setGeneralQty(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm font-mono font-bold text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Rate / Amount (₹)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={generalRate || ''}
                        onChange={(e) => setGeneralRate(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm font-mono font-bold text-stone-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional notes or remarks"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs text-stone-900"
                    />
                  </div>
                </div>
              )}

            {/* SPECIFIC CASE 6: CORRECTION / REVERSAL */}
            {(selectedType === TransactionType.CORRECTION || selectedType === TransactionType.REVERSAL) && (
              <div className="space-y-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <div>
                  <label className="text-xs font-bold text-amber-950 block mb-1">
                    Original Transaction Number / Reference *
                  </label>
                  <input
                    type="text"
                    value={referenceTxnNumber}
                    onChange={(e) => setReferenceTxnNumber(e.target.value)}
                    placeholder="e.g. TXN-20260912-00001"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-amber-950 block mb-1">
                    Mandatory Reason (Audit Log Required) *
                  </label>
                  <textarea
                    rows={2}
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    placeholder="Explain error or reason for adjustment..."
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* REAL-TIME CALCULATION SUMMARY CARD */}
          <div className="bg-stone-900 text-white rounded-xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Live Calculation Breakdown
              </span>
              <span className="text-[11px] text-stone-400 font-mono">
                Safe Decimal Math
              </span>
            </div>

            {/* Itemized lines */}
            <div className="space-y-1.5 text-xs text-stone-300 divide-y divide-stone-800">
              {calculatedSummary.detailedLines.map((line, idx) => (
                <div key={idx} className="flex items-center justify-between pt-1.5 first:pt-0">
                  <div>
                    <span className="text-stone-200 font-medium block">{line.label}</span>
                    {line.subtext && <span className="text-[10px] text-stone-400">{line.subtext}</span>}
                  </div>
                  {line.amount !== undefined && (
                    <span
                      className={`font-mono font-bold ${
                        line.isHighlight ? 'text-emerald-400 text-sm' : 'text-stone-100'
                      }`}
                    >
                      {formatRupees(line.amount)}
                    </span>
                  )}
                  {line.quantity !== undefined && line.amount === undefined && (
                    <span className="font-mono font-bold text-stone-100">
                      {line.quantity} {line.unit || 'kg'}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Final Settlement Result */}
            <div className="pt-2 border-t border-stone-800 flex items-center justify-between">
              <span className="text-xs text-stone-400">Final Outcome:</span>
              <span className="text-sm sm:text-base font-bold text-emerald-400">
                {calculatedSummary.settlementText}
              </span>
            </div>
          </div>

          {/* Action to Review Step */}
          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setIdempotencyKey(`idem-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`);
                setStep('CONFIRM');
              }}
              className="w-full"
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Review & Confirm
            </Button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 4: CONFIRMATION & REVIEW SCREEN (DRAFT VERIFICATION)
         ========================================================================= */}
      {step === 'CONFIRM' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 shadow-2xs space-y-4">
            <div>
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Draft Review
              </span>
              <h2 className="text-lg font-bold text-stone-900 pt-1">
                Confirm Transaction
              </h2>
              <p className="text-xs text-stone-500">
                Please verify customer, items, and financial settlement before saving.
              </p>
            </div>

            {/* Customer & Type Card */}
            <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Customer</span>
                <span className="font-bold text-stone-900">
                  {selectedCustomer ? selectedCustomer.name : 'Walk-in / Cash Retail'}
                </span>
              </div>
              {selectedCustomer?.customerCode && (
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Account Code</span>
                  <span className="font-mono text-stone-700">#{selectedCustomer.customerCode}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Transaction Type</span>
                <span className="font-semibold text-emerald-800">{currentDef.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Date</span>
                <span className="font-mono text-stone-700">{new Date().toLocaleDateString('en-IN')}</span>
              </div>
            </div>

            {/* Specialized Wheat -> Atta Exchange Review Box */}
            {selectedType === TransactionType.WHEAT_ATTA_EXCHANGE && (
              <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-300 space-y-2 text-xs">
                <div className="flex items-center justify-between text-amber-950">
                  <span className="font-bold flex items-center gap-1.5">
                    <Wheat className="w-4 h-4 text-amber-700" />
                    Wheat → Atta Exchange Verification
                  </span>
                  <span className="font-mono font-bold bg-amber-200/90 px-2 py-0.5 rounded text-amber-950 text-[11px] border border-amber-300">
                    Rate: ₹{weExchangeCalc.appliedRate}/kg {weIsCustomRate ? '(Override)' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-stone-700 pt-1">
                  <div className="p-2 bg-white rounded-lg border border-amber-200">
                    <span className="text-stone-500 block text-[10px] uppercase font-bold">Wheat Received</span>
                    <span className="font-mono font-bold text-stone-900">{formatKg(weWheatQty)}</span>
                    <span className="text-[10px] text-emerald-800 font-medium block">Grain Inflow</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-amber-200">
                    <span className="text-stone-500 block text-[10px] uppercase font-bold">Atta Delivered</span>
                    <span className="font-mono font-bold text-stone-900">{formatKg(weExchangeCalc.attaQuantityGiven)}</span>
                    <span className="text-[10px] text-amber-800 font-medium block">{weExchangeCalc.attaTypeName}</span>
                  </div>
                </div>
                {weIsCustomRate && (
                  <div className="p-2 bg-amber-100/70 rounded-lg border border-amber-300 text-[11px] text-amber-950">
                    <span className="font-bold">Rate Override Reason:</span> {weOverrideReason || 'Not provided'}
                  </div>
                )}
              </div>
            )}

            {/* Specialized Rice -> Atta Settlement Review Box */}
            {selectedType === TransactionType.RICE_ATTA_SETTLEMENT && (
              <div className="p-4 bg-sky-50/80 rounded-xl border border-sky-300 space-y-3 text-xs">
                <div className="flex items-center justify-between text-sky-950">
                  <span className="font-bold flex items-center gap-1.5">
                    <ArrowLeftRight className="w-4 h-4 text-sky-700" />
                    Rice → Atta Settlement Summary
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                    raSettlementCalc.paymentStatus === 'PAID'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : raSettlementCalc.paymentStatus === 'PARTIAL'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-rose-100 text-rose-900 border-rose-300'
                  }`}>
                    Payment: {raSettlementCalc.paymentStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-stone-700 pt-1">
                  <div className="p-2.5 bg-white rounded-lg border border-sky-200">
                    <span className="text-stone-500 block text-[10px] uppercase font-bold">Ration Rice</span>
                    <span className="font-mono font-bold text-stone-900 text-sm">
                      {formatKg(raRiceQty)} @ ₹{raSettlementCalc.riceRate}/kg
                    </span>
                    <span className="text-xs font-bold font-mono text-sky-900 block pt-0.5">
                      Credit: {formatRupees(raSettlementCalc.riceValue)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-amber-200">
                    <span className="text-stone-500 block text-[10px] uppercase font-bold">{raSettlementCalc.attaTypeName}</span>
                    <span className="font-mono font-bold text-stone-900 text-sm">
                      {formatKg(raAttaQty)} @ ₹{raSettlementCalc.attaRate}/kg
                    </span>
                    <span className="text-xs font-bold font-mono text-amber-950 block pt-0.5">
                      Bill: {formatRupees(raSettlementCalc.attaValue)}
                    </span>
                  </div>
                </div>

                {/* Plain-language settlement outcome */}
                <div className="p-2.5 bg-white rounded-lg border border-sky-300 flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-stone-600 text-[10px]">
                    Final Settlement:
                  </span>
                  <span className={`font-mono font-extrabold text-sm ${
                    raSettlementCalc.settlementDirection === 'CUSTOMER_RECEIVES'
                      ? 'text-emerald-700'
                      : raSettlementCalc.settlementDirection === 'CUSTOMER_PAYS'
                      ? 'text-rose-700'
                      : 'text-stone-800'
                  }`}>
                    {raSettlementCalc.plainLanguageResult}
                  </span>
                </div>

                {(raIsCustomRiceRate || raIsCustomAttaRate) && (
                  <div className="p-2 bg-amber-50 rounded-lg border border-amber-300 text-[11px] text-amber-950 space-y-1">
                    {raIsCustomRiceRate && (
                      <div><span className="font-bold">Rice Override:</span> {raRiceOverrideReason || 'Not provided'}</div>
                    )}
                    {raIsCustomAttaRate && (
                      <div><span className="font-bold">Atta Override:</span> {raAttaOverrideReason || 'Not provided'}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Specialized Rice -> Cash Settlement Review Box */}
            {selectedType === TransactionType.RICE_CASH_SETTLEMENT && (
              <div className="p-4 bg-teal-50/80 rounded-xl border border-teal-300 space-y-3 text-xs">
                <div className="flex items-center justify-between text-teal-950">
                  <span className="font-bold flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-teal-700" />
                    Rice → Cash Settlement Summary
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                      rcSettlementCalc.paymentStatus === 'PAID'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : rcSettlementCalc.paymentStatus === 'PARTIAL'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-sky-100 text-sky-900 border-sky-300'
                    }`}
                  >
                    Payment: {rcSettlementCalc.paymentStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-stone-700 pt-1">
                  <div className="p-2.5 bg-white rounded-lg border border-teal-200">
                    <span className="text-stone-500 block text-[10px] uppercase font-bold">Ration Rice Inflow</span>
                    <span className="font-mono font-bold text-stone-900 text-sm">
                      {formatKg(rcQty)} @ ₹{rcSettlementCalc.rate}/kg
                    </span>
                    <span className="text-xs font-bold font-mono text-teal-900 block pt-0.5">
                      Value: {formatRupees(rcSettlementCalc.settlementAmount)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-teal-200">
                    <span className="text-stone-500 block text-[10px] uppercase font-bold">Cash Settlement</span>
                    <span className="font-mono font-bold text-emerald-800 text-sm">
                      {formatRupees(rcSettlementCalc.amountPaid)} Paid
                    </span>
                    <span className="text-xs font-bold font-mono text-sky-900 block pt-0.5">
                      {rcSettlementCalc.remainingAmount > 0
                        ? `${formatRupees(rcSettlementCalc.remainingAmount)} Khata Credit`
                        : 'Paid in Full'}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-teal-300 flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-stone-600 text-[10px]">
                    Settlement Status:
                  </span>
                  <span className="font-mono font-extrabold text-sm text-teal-950">
                    {rcSettlementCalc.plainLanguageResult}
                  </span>
                </div>

                {rcIsCustomRate && (
                  <div className="p-2 bg-amber-50 rounded-lg border border-amber-300 text-[11px] text-amber-950">
                    <span className="font-bold">Rate Override Reason:</span> {rcOverrideReason || 'Not provided'}
                  </div>
                )}
              </div>
            )}

            {/* Specialized Wheat -> Cash Settlement Review Box */}
            {selectedType === TransactionType.WHEAT_CASH_SETTLEMENT && (
              <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-300 space-y-3 text-xs">
                <div className="flex items-center justify-between text-amber-950">
                  <span className="font-bold flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-700" />
                    Wheat → Cash Settlement Summary
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                      wcSettlementCalc.paymentStatus === 'PAID'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : wcSettlementCalc.paymentStatus === 'PARTIAL'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-sky-100 text-sky-900 border-sky-300'
                    }`}
                  >
                    Payment: {wcSettlementCalc.paymentStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-stone-700 pt-1">
                  <div className="p-2.5 bg-white rounded-lg border border-amber-200">
                    <span className="text-stone-500 block text-[10px] uppercase font-bold">Raw Wheat Inflow</span>
                    <span className="font-mono font-bold text-stone-900 text-sm">
                      {formatKg(wcQty)} @ ₹{wcSettlementCalc.rate}/kg
                    </span>
                    <span className="text-xs font-bold font-mono text-amber-950 block pt-0.5">
                      Value: {formatRupees(wcSettlementCalc.settlementAmount)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-amber-200">
                    <span className="text-stone-500 block text-[10px] uppercase font-bold">Cash Settlement</span>
                    <span className="font-mono font-bold text-emerald-800 text-sm">
                      {formatRupees(wcSettlementCalc.amountPaid)} Paid
                    </span>
                    <span className="text-xs font-bold font-mono text-sky-900 block pt-0.5">
                      {wcSettlementCalc.remainingAmount > 0
                        ? `${formatRupees(wcSettlementCalc.remainingAmount)} Khata Credit`
                        : 'Paid in Full'}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-amber-300 flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-stone-600 text-[10px]">
                    Settlement Status:
                  </span>
                  <span className="font-mono font-extrabold text-sm text-amber-950">
                    {wcSettlementCalc.plainLanguageResult}
                  </span>
                </div>

                {wcIsCustomRate && (
                  <div className="p-2 bg-amber-50 rounded-lg border border-amber-300 text-[11px] text-amber-950">
                    <span className="font-bold">Rate Override Reason:</span> {wcOverrideReason || 'Not provided'}
                  </div>
                )}
              </div>
            )}

            {/* Line Items Table */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
                Line Items
              </span>
              <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100 text-xs">
                {currentItems.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between bg-white">
                    <div>
                      <span className="font-bold text-stone-900 block">
                        {item.quantity} {item.unit} {item.grainType ? String(item.grainType).replace(/_/g, ' ') : item.itemType}
                      </span>
                      {item.ratePerUnit > 0 && (
                        <span className="text-[11px] text-stone-500">
                          Rate: ₹{item.ratePerUnit}/{item.unit === GrainUnit.KG ? 'kg' : 'unit'}
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-stone-900">
                      {item.totalAmount > 0 ? formatRupees(item.totalAmount) : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Settlement Summary Box */}
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-emerald-900">
                <span className="font-bold">Settlement Outcome</span>
                <span className="font-bold text-sm font-mono text-emerald-950">
                  {calculatedSummary.settlementText}
                </span>
              </div>
              {calculatedSummary.balanceDelta !== 0 && (
                <div className="text-[11px] text-emerald-800 pt-1 border-t border-emerald-200">
                  {calculatedSummary.balanceDelta > 0
                    ? `Account balance will increase dues by ${formatRupees(calculatedSummary.balanceDelta)}.`
                    : `Shop will credit/pay out ${formatRupees(Math.abs(calculatedSummary.balanceDelta))}.`}
                </div>
              )}
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Submission Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <Button
                variant="outline"
                size="lg"
                disabled={isSubmitting}
                onClick={() => setStep('DETAILS')}
                className="w-full sm:w-1/3"
              >
                Back / Edit
              </Button>
              <Button
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                disabled={isSubmitting}
                onClick={handleConfirmAndSave}
                className="w-full sm:w-2/3"
              >
                {isSubmitting ? 'Saving Atomically...' : 'Confirm & Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 5: SUCCESS RESULT SCREEN
         ========================================================================= */}
      {step === 'SUCCESS' && createdResult && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-200 shadow-2xs">
              <CheckCircle2 className="w-10 h-10 stroke-[2.2]" />
            </div>

            <div className="space-y-1 max-w-sm mx-auto">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Confirmed & Ledger Updated
              </span>
              <h2 className="text-xl font-bold text-stone-900 pt-1">
                Transaction Saved
              </h2>
              <p className="text-xs sm:text-sm text-stone-600">
                The transaction and linked ledger entries were saved atomically.
              </p>
            </div>

            {/* Transaction Number Banner */}
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-center space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Official Transaction Number
              </span>
              <div className="text-lg sm:text-xl font-mono font-bold text-stone-900 tracking-wider">
                {createdResult.transaction.transactionNumber}
              </div>
              <p className="text-xs font-semibold text-emerald-800">
                {createdResult.summaryText}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex flex-col sm:flex-row gap-2.5 justify-center">
              <Button
                variant="primary"
                size="md"
                onClick={() => onNavigate(`/app/transactions/${createdResult.transaction.id}`)}
                className="w-full sm:w-auto"
              >
                View Transaction
              </Button>

              {createdResult.transaction.customerId && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => onNavigate(`/app/customers/${createdResult.transaction.customerId}`)}
                  className="w-full sm:w-auto"
                >
                  View Customer Account
                </Button>
              )}

              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setStep('CUSTOMER');
                  setSelectedCustomer(undefined);
                  setNotes('');
                  setAdjustmentReason('');
                  setReferenceTxnNumber('');
                  setCreatedResult(null);
                  setIdempotencyKey(`idem-${Date.now()}`);
                }}
                className="w-full sm:w-auto"
              >
                New Transaction
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
