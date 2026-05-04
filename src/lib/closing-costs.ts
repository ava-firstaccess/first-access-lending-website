import closingCostsConfig from './closing-costs-config.json';

type ClosingCostProgram = 'HELOC' | 'CES';

type FeeScheduleTier = {
  minLoanAmount: number;
  maxLoanAmount: number | null;
  feePct?: number;
  flatFeeAmount?: number;
};

type StateFeeGroup = {
  name: string;
  states: readonly string[];
};

type FeeComputation = {
  state: string | null;
  program: ClosingCostProgram | null;
  stateGroupName: string | null;
  loanAmount: number;
  originationFeeAmount: number;
  originationFeePct: number;
  capPct: number | null;
  maxDiscountPointsPct: number | null;
  totalUpfrontCostPct: number;
  isOverLimit: boolean;
  remainingCapacityPct: number | null;
};

type ClosingCostsConfig = {
  stateCaps: Record<string, number>;
  stateFeeGroups: StateFeeGroup[];
  defaultStateFeeGroup: string;
  originationFeeSchedule: Record<ClosingCostProgram, Record<string, FeeScheduleTier[]>>;
};

const CONFIG = closingCostsConfig as ClosingCostsConfig;

export const POINTS_AND_FEES_STATE_CAPS: Partial<Record<string, number>> = CONFIG.stateCaps;
const STATE_FEE_GROUPS: readonly StateFeeGroup[] = CONFIG.stateFeeGroups;
const DEFAULT_STATE_FEE_GROUP = CONFIG.defaultStateFeeGroup;
const ORIGINATION_FEE_SCHEDULE: Record<ClosingCostProgram, Record<string, readonly FeeScheduleTier[]>> = CONFIG.originationFeeSchedule;

function normalizeState(state: string | undefined): string | null {
  const normalized = String(state || '').trim().toUpperCase();
  return normalized || null;
}

export function getClosingCostProgram(program: string | undefined, product: string | undefined): ClosingCostProgram | null {
  const combined = `${program || ''} ${product || ''}`.toUpperCase();
  if (combined.includes('HELOC') || combined.includes('HELPC')) return 'HELOC';
  if (combined.includes('ARC HOME') || combined.includes('CES') || combined.includes('2ND') || combined.includes('FIX') || combined.includes('SECOND') || combined.includes('MATURITY') || combined.includes('EQUITY ADVANTAGE')) return 'CES';
  return null;
}

export function getClosingCostStateGroup(state: string | undefined): StateFeeGroup {
  const normalizedState = normalizeState(state);
  return STATE_FEE_GROUPS.find(group => normalizedState !== null && group.states.includes(normalizedState)) ?? { name: DEFAULT_STATE_FEE_GROUP, states: [] };
}

function getCesQmCapPct(loanAmount: number): number {
  if (loanAmount >= 137958) return 3;
  if (loanAmount >= 82775) return Number(((4139 / loanAmount) * 100).toFixed(3));
  if (loanAmount >= 27592) return 5;
  return 8;
}

function getFlMdCesCapPct(loanAmount: number): number {
  if (loanAmount >= 136667) return 3;
  if (loanAmount >= 102500) return Number(((4100 / loanAmount) * 100).toFixed(3));
  return 4;
}

function getPointsAndFeesCapPct(program: ClosingCostProgram | null, state: string | null, loanAmount: number): number | null {
  const stateCapPct = state ? POINTS_AND_FEES_STATE_CAPS[state] ?? null : null;
  if (program === 'CES') {
    if (state === 'FL' || state === 'MD') return getFlMdCesCapPct(loanAmount);
    return getCesQmCapPct(loanAmount);
  }
  if (program === 'HELOC') return stateCapPct ?? 5;
  return null;
}

function getScheduleFor(state: string | undefined, program: ClosingCostProgram): readonly FeeScheduleTier[] {
  const group = getClosingCostStateGroup(state);
  return ORIGINATION_FEE_SCHEDULE[program][group.name] ?? ORIGINATION_FEE_SCHEDULE[program][DEFAULT_STATE_FEE_GROUP];
}

function findFeeTier(tiers: readonly FeeScheduleTier[], loanAmount: number): FeeScheduleTier | null {
  if (!(loanAmount > 0)) return null;
  const exactMatch = tiers.find(tier => loanAmount >= tier.minLoanAmount && (tier.maxLoanAmount === null || loanAmount <= tier.maxLoanAmount));
  if (exactMatch) return exactMatch;
  const lowerBoundFallback = tiers
    .filter(tier => loanAmount >= tier.minLoanAmount)
    .sort((a, b) => b.minLoanAmount - a.minLoanAmount)[0];
  return lowerBoundFallback ?? null;
}

export function getOriginationFeeDetails({
  propertyState,
  program,
  product,
  loanAmount,
}: {
  propertyState?: string;
  program?: string;
  product?: string;
  loanAmount: number;
}): FeeComputation {
  const normalizedState = normalizeState(propertyState);
  const normalizedProgram = getClosingCostProgram(program, product);
  const safeLoanAmount = Number.isFinite(loanAmount) ? Math.max(0, loanAmount) : 0;
  const stateGroup = normalizedProgram ? getClosingCostStateGroup(normalizedState ?? undefined) : null;
  const tiers = normalizedProgram ? getScheduleFor(normalizedState ?? undefined, normalizedProgram) : [];
  const tier = normalizedProgram ? findFeeTier(tiers, safeLoanAmount) : null;

  let originationFeeAmount = 0;
  let originationFeePct = 0;
  if (tier && safeLoanAmount > 0) {
    if (typeof tier.flatFeeAmount === 'number') {
      originationFeeAmount = tier.flatFeeAmount;
      originationFeePct = Number(((tier.flatFeeAmount / safeLoanAmount) * 100).toFixed(3));
    } else if (typeof tier.feePct === 'number') {
      originationFeePct = tier.feePct;
      originationFeeAmount = Math.round(safeLoanAmount * (tier.feePct / 100));
    }
  }

  const capPct = getPointsAndFeesCapPct(normalizedProgram, normalizedState, safeLoanAmount);
  const maxDiscountPointsPct = capPct === null ? null : Number(Math.max(0, capPct - originationFeePct).toFixed(3));

  return {
    state: normalizedState,
    program: normalizedProgram,
    stateGroupName: stateGroup?.name ?? null,
    loanAmount: safeLoanAmount,
    originationFeeAmount,
    originationFeePct,
    capPct,
    maxDiscountPointsPct,
    totalUpfrontCostPct: originationFeePct,
    isOverLimit: false,
    remainingCapacityPct: capPct === null ? null : Number(Math.max(0, capPct - originationFeePct).toFixed(3)),
  };
}

export function getPointsAndFeesStatus({
  propertyState,
  program,
  product,
  loanAmount,
  discountPointsPct,
}: {
  propertyState?: string;
  program?: string;
  product?: string;
  loanAmount: number;
  discountPointsPct: number;
}) {
  const fee = getOriginationFeeDetails({ propertyState, program, product, loanAmount });
  const appliedDiscountPointsPct = Number.isFinite(discountPointsPct) ? Math.max(0, discountPointsPct) : 0;
  const totalUpfrontCostPct = Number((fee.originationFeePct + appliedDiscountPointsPct).toFixed(3));
  const isOverLimit = fee.capPct !== null && totalUpfrontCostPct > fee.capPct + 0.0001;
  const remainingCapacityPct = fee.capPct === null ? null : Number(Math.max(0, fee.capPct - totalUpfrontCostPct).toFixed(3));

  return {
    ...fee,
    totalUpfrontCostPct,
    isOverLimit,
    remainingCapacityPct,
  };
}
