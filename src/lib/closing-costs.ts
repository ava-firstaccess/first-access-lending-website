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

export const POINTS_AND_FEES_STATE_CAPS: Partial<Record<string, number>> = {
  FL: 4,
  MD: 4,
};

const STATE_FEE_GROUPS: readonly StateFeeGroup[] = [
  { name: 'FL, MD', states: ['FL', 'MD'] },
  { name: 'NJ, PA', states: ['NJ', 'PA'] },
  { name: 'KY', states: ['KY'] },
  { name: 'OH', states: ['OH'] },
];

const DEFAULT_STATE_FEE_GROUP = 'All Others';

const ORIGINATION_FEE_SCHEDULE: Record<ClosingCostProgram, Record<string, readonly FeeScheduleTier[]>> = {
  HELOC: {
    'All Others': [
      { minLoanAmount: 0, maxLoanAmount: 24999, feePct: 5 },
      { minLoanAmount: 25000, maxLoanAmount: 49999, feePct: 5 },
      { minLoanAmount: 50000, maxLoanAmount: 74999, feePct: 5 },
      { minLoanAmount: 75000, maxLoanAmount: 99999, feePct: 5 },
      { minLoanAmount: 100000, maxLoanAmount: 124999, feePct: 4.5 },
      { minLoanAmount: 125000, maxLoanAmount: 149999, feePct: 3.5 },
      { minLoanAmount: 150000, maxLoanAmount: 174999, feePct: 2.75 },
      { minLoanAmount: 175000, maxLoanAmount: 199999, feePct: 2.25 },
      { minLoanAmount: 200000, maxLoanAmount: 224999, feePct: 1.75 },
      { minLoanAmount: 225000, maxLoanAmount: 249999, feePct: 1.5 },
      { minLoanAmount: 250000, maxLoanAmount: 274999, feePct: 1.25 },
      { minLoanAmount: 275000, maxLoanAmount: 299999, feePct: 1 },
      { minLoanAmount: 300000, maxLoanAmount: 324999, feePct: 1 },
      { minLoanAmount: 325000, maxLoanAmount: 349999, feePct: 1 },
      { minLoanAmount: 350000, maxLoanAmount: null, feePct: 1 },
    ],
    'FL, MD': [
      { minLoanAmount: 0, maxLoanAmount: 24999, feePct: 4 },
      { minLoanAmount: 25000, maxLoanAmount: 49999, feePct: 4 },
      { minLoanAmount: 50000, maxLoanAmount: 74999, feePct: 4 },
      { minLoanAmount: 75000, maxLoanAmount: 99999, feePct: 4 },
      { minLoanAmount: 100000, maxLoanAmount: 124999, feePct: 4 },
      { minLoanAmount: 125000, maxLoanAmount: 149999, feePct: 3.5 },
      { minLoanAmount: 150000, maxLoanAmount: 174999, feePct: 2.75 },
      { minLoanAmount: 175000, maxLoanAmount: 199999, feePct: 2.25 },
      { minLoanAmount: 200000, maxLoanAmount: 224999, feePct: 1.75 },
      { minLoanAmount: 225000, maxLoanAmount: 249999, feePct: 1.5 },
      { minLoanAmount: 250000, maxLoanAmount: 274999, feePct: 1.25 },
      { minLoanAmount: 275000, maxLoanAmount: 299999, feePct: 1 },
      { minLoanAmount: 300000, maxLoanAmount: 324999, feePct: 1 },
      { minLoanAmount: 325000, maxLoanAmount: 349999, feePct: 1 },
      { minLoanAmount: 350000, maxLoanAmount: null, feePct: 1 },
    ],
    'NJ, PA': [
      { minLoanAmount: 0, maxLoanAmount: 24999, feePct: 3 },
      { minLoanAmount: 25000, maxLoanAmount: 49999, feePct: 3 },
      { minLoanAmount: 50000, maxLoanAmount: 74999, feePct: 3 },
      { minLoanAmount: 75000, maxLoanAmount: 99999, feePct: 3 },
      { minLoanAmount: 100000, maxLoanAmount: 124999, feePct: 3 },
      { minLoanAmount: 125000, maxLoanAmount: 149999, feePct: 3 },
      { minLoanAmount: 150000, maxLoanAmount: 174999, feePct: 2.75 },
      { minLoanAmount: 175000, maxLoanAmount: 199999, feePct: 2.25 },
      { minLoanAmount: 200000, maxLoanAmount: 224999, feePct: 1.75 },
      { minLoanAmount: 225000, maxLoanAmount: 249999, feePct: 1.5 },
      { minLoanAmount: 250000, maxLoanAmount: 274999, feePct: 1.25 },
      { minLoanAmount: 275000, maxLoanAmount: 299999, feePct: 1 },
      { minLoanAmount: 300000, maxLoanAmount: 324999, feePct: 1 },
      { minLoanAmount: 325000, maxLoanAmount: 349999, feePct: 1 },
      { minLoanAmount: 350000, maxLoanAmount: null, feePct: 1 },
    ],
    KY: [
      { minLoanAmount: 0, maxLoanAmount: 24999, feePct: 2.5 },
      { minLoanAmount: 25000, maxLoanAmount: 49999, feePct: 2.5 },
      { minLoanAmount: 50000, maxLoanAmount: 74999, feePct: 2.5 },
      { minLoanAmount: 75000, maxLoanAmount: 99999, feePct: 2.5 },
      { minLoanAmount: 100000, maxLoanAmount: 124999, feePct: 2.5 },
      { minLoanAmount: 125000, maxLoanAmount: 149999, feePct: 2.5 },
      { minLoanAmount: 150000, maxLoanAmount: 174999, feePct: 2.5 },
      { minLoanAmount: 175000, maxLoanAmount: 199999, feePct: 2.25 },
      { minLoanAmount: 200000, maxLoanAmount: 224999, feePct: 1.75 },
      { minLoanAmount: 225000, maxLoanAmount: 249999, feePct: 1.5 },
      { minLoanAmount: 250000, maxLoanAmount: 274999, feePct: 1.25 },
      { minLoanAmount: 275000, maxLoanAmount: 299999, feePct: 1 },
      { minLoanAmount: 300000, maxLoanAmount: 324999, feePct: 1 },
      { minLoanAmount: 325000, maxLoanAmount: 349999, feePct: 1 },
      { minLoanAmount: 350000, maxLoanAmount: null, feePct: 1 },
    ],
    OH: [
      { minLoanAmount: 0, maxLoanAmount: 24999, feePct: 2 },
      { minLoanAmount: 25000, maxLoanAmount: 49999, feePct: 2 },
      { minLoanAmount: 50000, maxLoanAmount: 74999, feePct: 2 },
      { minLoanAmount: 75000, maxLoanAmount: 99999, feePct: 2 },
      { minLoanAmount: 100000, maxLoanAmount: 124999, feePct: 2 },
      { minLoanAmount: 125000, maxLoanAmount: 149999, feePct: 2 },
      { minLoanAmount: 150000, maxLoanAmount: 174999, feePct: 2 },
      { minLoanAmount: 175000, maxLoanAmount: 199999, feePct: 2 },
      { minLoanAmount: 200000, maxLoanAmount: 224999, feePct: 1.75 },
      { minLoanAmount: 225000, maxLoanAmount: 249999, feePct: 1.5 },
      { minLoanAmount: 250000, maxLoanAmount: 274999, feePct: 1.25 },
      { minLoanAmount: 275000, maxLoanAmount: 299999, feePct: 1 },
      { minLoanAmount: 300000, maxLoanAmount: 324999, feePct: 1 },
      { minLoanAmount: 325000, maxLoanAmount: 349999, feePct: 1 },
      { minLoanAmount: 350000, maxLoanAmount: null, feePct: 1 },
    ],
  },
  CES: {
    'All Others': [
      { minLoanAmount: 0, maxLoanAmount: 74599, feePct: 5 },
      { minLoanAmount: 74600, maxLoanAmount: 124331, flatFeeAmount: 3750 },
      { minLoanAmount: 124331, maxLoanAmount: 149331, feePct: 3 },
      { minLoanAmount: 150000, maxLoanAmount: 174999, feePct: 2.75 },
      { minLoanAmount: 175000, maxLoanAmount: 199999, feePct: 2.25 },
      { minLoanAmount: 200000, maxLoanAmount: 224999, feePct: 1.75 },
      { minLoanAmount: 225000, maxLoanAmount: 249999, feePct: 1.5 },
      { minLoanAmount: 250000, maxLoanAmount: 274999, feePct: 1.25 },
      { minLoanAmount: 275000, maxLoanAmount: 299999, feePct: 1 },
      { minLoanAmount: 300000, maxLoanAmount: 324999, feePct: 1 },
      { minLoanAmount: 325000, maxLoanAmount: 349999, feePct: 1 },
      { minLoanAmount: 350000, maxLoanAmount: null, feePct: 1 },
    ],
    'FL, MD': [
      { minLoanAmount: 0, maxLoanAmount: 74599, feePct: 4 },
      { minLoanAmount: 74600, maxLoanAmount: 124331, flatFeeAmount: 3750 },
      { minLoanAmount: 124331, maxLoanAmount: 149331, feePct: 3 },
      { minLoanAmount: 150000, maxLoanAmount: 174999, feePct: 2.75 },
      { minLoanAmount: 175000, maxLoanAmount: 199999, feePct: 2.25 },
      { minLoanAmount: 200000, maxLoanAmount: 224999, feePct: 1.75 },
      { minLoanAmount: 225000, maxLoanAmount: 249999, feePct: 1.5 },
      { minLoanAmount: 250000, maxLoanAmount: 274999, feePct: 1.25 },
      { minLoanAmount: 275000, maxLoanAmount: 299999, feePct: 1 },
      { minLoanAmount: 300000, maxLoanAmount: 324999, feePct: 1 },
      { minLoanAmount: 325000, maxLoanAmount: 349999, feePct: 1 },
      { minLoanAmount: 350000, maxLoanAmount: null, feePct: 1 },
    ],
    'NJ, PA': [
      { minLoanAmount: 0, maxLoanAmount: 124331, feePct: 3 },
      { minLoanAmount: 124331, maxLoanAmount: 149331, feePct: 3 },
      { minLoanAmount: 150000, maxLoanAmount: 174999, feePct: 2.75 },
      { minLoanAmount: 175000, maxLoanAmount: 199999, feePct: 2.25 },
      { minLoanAmount: 200000, maxLoanAmount: 224999, feePct: 1.75 },
      { minLoanAmount: 225000, maxLoanAmount: 249999, feePct: 1.5 },
      { minLoanAmount: 250000, maxLoanAmount: 274999, feePct: 1.25 },
      { minLoanAmount: 275000, maxLoanAmount: 299999, feePct: 1 },
      { minLoanAmount: 300000, maxLoanAmount: 324999, feePct: 1 },
      { minLoanAmount: 325000, maxLoanAmount: 349999, feePct: 1 },
      { minLoanAmount: 350000, maxLoanAmount: null, feePct: 1 },
    ],
    KY: [
      { minLoanAmount: 0, maxLoanAmount: 149331, feePct: 2.5 },
      { minLoanAmount: 150000, maxLoanAmount: 174999, feePct: 2.5 },
      { minLoanAmount: 175000, maxLoanAmount: 199999, feePct: 2.25 },
      { minLoanAmount: 200000, maxLoanAmount: 224999, feePct: 1.75 },
      { minLoanAmount: 225000, maxLoanAmount: 249999, feePct: 1.5 },
      { minLoanAmount: 250000, maxLoanAmount: 274999, feePct: 1.25 },
      { minLoanAmount: 275000, maxLoanAmount: 299999, feePct: 1 },
      { minLoanAmount: 300000, maxLoanAmount: 324999, feePct: 1 },
      { minLoanAmount: 325000, maxLoanAmount: 349999, feePct: 1 },
      { minLoanAmount: 350000, maxLoanAmount: null, feePct: 1 },
    ],
    OH: [
      { minLoanAmount: 0, maxLoanAmount: 174999, feePct: 2 },
      { minLoanAmount: 175000, maxLoanAmount: 199999, feePct: 2 },
      { minLoanAmount: 200000, maxLoanAmount: 224999, feePct: 1.75 },
      { minLoanAmount: 225000, maxLoanAmount: 249999, feePct: 1.5 },
      { minLoanAmount: 250000, maxLoanAmount: 274999, feePct: 1.25 },
      { minLoanAmount: 275000, maxLoanAmount: 299999, feePct: 1 },
      { minLoanAmount: 300000, maxLoanAmount: 324999, feePct: 1 },
      { minLoanAmount: 325000, maxLoanAmount: 349999, feePct: 1 },
      { minLoanAmount: 350000, maxLoanAmount: null, feePct: 1 },
    ],
  },
};

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

function getPointsAndFeesCapPct(program: ClosingCostProgram | null, state: string | null): number | null {
  const stateCapPct = state ? POINTS_AND_FEES_STATE_CAPS[state] ?? null : null;
  if (program === 'CES') return stateCapPct === null ? 3 : Math.min(3, stateCapPct);
  if (program === 'HELOC') return stateCapPct;
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

  const capPct = getPointsAndFeesCapPct(normalizedProgram, normalizedState);
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
