import type { InvestorName } from '@/lib/rates/investor-confidence-rules';
import type { ArcHomeProduct, BestExDocType, BestExDrawPeriodYears, BestExLockPeriodDays, BestExProduct, BestExTermYears, ButtonDocType, DeephavenDocType, DeephavenLockPeriodDays, DeephavenProduct, NewRezProduct, OsbProduct, SharedDocType, VerusDocType, VerusDrawPeriodYears, VerusProduct, VistaDocType, VistaProduct } from './types';

export const BEST_EX_WINDOW = {
  floor: 0.375,
  ceiling: 0.125,
} as const;

export const BEST_EX_LOCK_PADDING_DAYS = 30;

export { POINTS_AND_FEES_STATE_CAPS } from '../closing-costs';

export const STAGE1_INVESTOR_OVERLAYS = {
  NewRez: {
    maxLoanAmount: 500_000,
    maxUnitCount: 1,
    maxCltv: 0.9,
  },
  OSB: {
    heloc: {
      maxLoanAmount: 500_000,
      maxDti: 50,
    },
  },
} as const;

const BEST_EX_DOC_TYPE_MAP = {
  Button: {
    HELOC: {
      'Full Doc': 'Full Doc',
    },
    CES: {
      'Full Doc': 'Full Doc',
      '12 Month Bank Statement': '12 Month Bank Statement',
      '24 Month Bank Statement': '24 Month Bank Statement',
      'Bank Statement': '24 Month Bank Statement',
      'Asset Depletion': 'Asset Depletion',
    },
  },
  Vista: {
    default: {
      'Full Doc': 'Full Doc',
      '12 Month Bank Statement': 'Bank Statement',
      '24 Month Bank Statement': 'Bank Statement',
      'Bank Statement': 'Bank Statement',
      '1099': '1099',
      'Asset Depletion': 'Asset Depletion',
      'P&L Only': 'P&L Only',
      'WVOE': 'WVOE',
    },
  },
  Verus: {
    HELOC: {
      'Full Doc': 'Standard',
      '12 Month Bank Statement': 'Alt Doc',
      '24 Month Bank Statement': 'Alt Doc',
      'Bank Statement': 'Alt Doc',
    },
    CES: {
      'Full Doc': 'Standard',
      '12 Month Bank Statement': 'Alt Doc',
      '24 Month Bank Statement': 'Alt Doc',
      'Bank Statement': 'Alt Doc',
      '1099': 'Alt Doc',
      'P&L Only': 'Alt Doc',
      'WVOE': 'Alt Doc',
    },
  },
  OSB: {
    default: {
      'Full Doc': 'Full Doc',
    },
  },
  Deephaven: {
    default: {
      'Full Doc': 'Full Doc',
      '12 Month Bank Statement': 'Bank Statement',
      '24 Month Bank Statement': 'Bank Statement',
      'Bank Statement': 'Bank Statement',
      'P&L Only': 'P&L Only',
    },
  },
} as const;

const BEST_EX_CES_TERM_PRODUCTS = {
  'Arc Home': {
    10: '10 Year Maturity',
    15: '15 Year Maturity',
    20: '20 Year Maturity',
    30: '30 Year Maturity',
  },
  Vista: {
    10: '10yr Fixed',
    15: '15yr Fixed',
    20: '20yr Fixed',
    30: '30yr Fixed',
  },
  NewRez: {
    15: '15 Year Fixed',
    20: '20 Year Fixed',
    30: '30 Year Fixed',
  },
  OSB: {
    10: 'Fixed 10',
    15: 'Fixed 15',
    20: 'Fixed 20',
    30: 'Fixed 30',
  },
  Verus: {
    10: '10 YR FIX',
    15: '15 YR FIX',
    20: '20 YR FIX',
    25: '25 YR FIX',
    30: '30 YR FIX',
  },
  Deephaven: {
    15: '15Y Fixed',
    20: '20Y Fixed',
    30: '30Y Fixed',
  },
} as const;

export const BEST_EX_HELOC_PRODUCTS = {
  OSB: {
    program: 'HELOC',
    product: '30 Year Maturity',
  },
  Verus: {
    program: 'HELOC',
    product: '30 YR',
    allowedDrawPeriods: [3, 5],
  },
} as const;

export const BEST_EX_LOCK_PERIODS = {
  OSB: [45, 60],
  Verus: [45, 60],
  Deephaven: [45, 60],
} as const;

export const BEST_EX_RATE_SEARCH_PRESETS = {
  standard: { min: 3, max: 20, step: 0.125 },
  osbHeloc: { min: 0.5, max: 8, step: 0.125 },
  arcHome: { min: 7.25, max: 9.375, step: 0.125 },
} as const;

export const BEST_EX_INVESTOR_RULE_NAME_MAP: Record<string, InvestorName> = {
  OSB: 'Onslow',
  'Arc Home': 'Arc',
  Deephaven: 'DeepHaven',
  Button: 'Button',
  Vista: 'Vista',
  NewRez: 'NewRez',
  Verus: 'Verus',
};

export function getBestExActualLockPeriodDays(lockPeriodDays: BestExLockPeriodDays): number {
  return lockPeriodDays + BEST_EX_LOCK_PADDING_DAYS;
}

export function getBestExButtonDocType(docType: BestExDocType, product: BestExProduct): ButtonDocType | null {
  return BEST_EX_DOC_TYPE_MAP.Button[product][docType as keyof typeof BEST_EX_DOC_TYPE_MAP.Button[typeof product]] ?? null;
}

export function getBestExVistaDocType(docType: BestExDocType): VistaDocType {
  return BEST_EX_DOC_TYPE_MAP.Vista.default[docType as keyof typeof BEST_EX_DOC_TYPE_MAP.Vista.default] ?? 'Full Doc';
}

export function getBestExVerusDocType(docType: BestExDocType, product: BestExProduct): VerusDocType | null {
  return BEST_EX_DOC_TYPE_MAP.Verus[product][docType as keyof typeof BEST_EX_DOC_TYPE_MAP.Verus[typeof product]] ?? null;
}

export function getBestExOsbDocType(docType: BestExDocType): SharedDocType | null {
  return BEST_EX_DOC_TYPE_MAP.OSB.default[docType as keyof typeof BEST_EX_DOC_TYPE_MAP.OSB.default] ?? null;
}

export function getBestExDeephavenDocType(docType: BestExDocType): DeephavenDocType | null {
  return BEST_EX_DOC_TYPE_MAP.Deephaven.default[docType as keyof typeof BEST_EX_DOC_TYPE_MAP.Deephaven.default] ?? null;
}

export function getBestExInvestorRuleName(investorLabel: string): InvestorName | null {
  return BEST_EX_INVESTOR_RULE_NAME_MAP[investorLabel] ?? null;
}

export function getBestExCesProduct(investor: 'Arc Home', termYears: BestExTermYears): ArcHomeProduct | null;
export function getBestExCesProduct(investor: 'Vista', termYears: BestExTermYears): VistaProduct | null;
export function getBestExCesProduct(investor: 'NewRez', termYears: BestExTermYears): NewRezProduct | null;
export function getBestExCesProduct(investor: 'OSB', termYears: BestExTermYears): OsbProduct | null;
export function getBestExCesProduct(investor: 'Verus', termYears: BestExTermYears): VerusProduct | null;
export function getBestExCesProduct(investor: 'Deephaven', termYears: BestExTermYears): DeephavenProduct | null;
export function getBestExCesProduct(investor: 'Arc Home' | 'Vista' | 'NewRez' | 'OSB' | 'Verus' | 'Deephaven', termYears: BestExTermYears): ArcHomeProduct | VistaProduct | NewRezProduct | OsbProduct | VerusProduct | DeephavenProduct | null {
  return BEST_EX_CES_TERM_PRODUCTS[investor][termYears as keyof typeof BEST_EX_CES_TERM_PRODUCTS[typeof investor]] ?? null;
}

export function getBestExHelocVerusDrawPeriodAllowed(drawPeriodYears: BestExDrawPeriodYears): drawPeriodYears is Exclude<VerusDrawPeriodYears, 2> {
  return BEST_EX_HELOC_PRODUCTS.Verus.allowedDrawPeriods.includes(drawPeriodYears as 3 | 5);
}

export function isAllowedBestExLockPeriod(investor: keyof typeof BEST_EX_LOCK_PERIODS, actualLockPeriodDays: number): boolean {
  return BEST_EX_LOCK_PERIODS[investor].includes(actualLockPeriodDays as 45 | 60);
}

export function getBestExNewRezLockPeriod(actualLockPeriodDays: number): 15 | 30 | 45 | 60 {
  return (actualLockPeriodDays - BEST_EX_LOCK_PADDING_DAYS) as 15 | 30 | 45 | 60;
}

export function getBestExDeephavenLockPeriod(actualLockPeriodDays: number): DeephavenLockPeriodDays | null {
  if (actualLockPeriodDays === 45) return 15;
  if (actualLockPeriodDays === 60) return 30;
  return null;
}
