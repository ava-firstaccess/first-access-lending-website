export type HouseCanaryOrderProduct = 'property_explorer' | 'agile_insights';

export type HouseCanaryBillingCycle = {
  cycleStart: string;
  cycleEnd: string;
  label: string;
};

export type HouseCanaryCycleUsage = {
  propertyExplorerOrders: number;
  agileInsightsOrders: number;
};

export type HouseCanaryOrderAllocation = {
  cycle: HouseCanaryBillingCycle;
  selectedProduct: HouseCanaryOrderProduct;
  productSequenceNumber: number;
  overallSequenceNumber: number;
  isFreeTier: boolean;
  freePropertyExplorerRemaining: number;
  freeAgileInsightsRemaining: number;
};

const FREE_PROPERTY_EXPLORER_PER_CYCLE = 40;
const FREE_AGILE_INSIGHTS_PER_CYCLE = 40;

const KNOWN_BILLING_CYCLES: HouseCanaryBillingCycle[] = [
  {
    cycleStart: '2026-02-26',
    cycleEnd: '2026-03-26',
    label: '2026-02-26 to 2026-03-26',
  },
  {
    cycleStart: '2026-03-27',
    cycleEnd: '2026-04-26',
    label: '2026-03-27 to 2026-04-26',
  },
  {
    cycleStart: '2026-04-27',
    cycleEnd: '2026-05-27',
    label: '2026-04-27 to 2026-05-27',
  },
];

function parseUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function containsDate(cycle: HouseCanaryBillingCycle, target: Date): boolean {
  const start = parseUtcDate(cycle.cycleStart).getTime();
  const end = parseUtcDate(cycle.cycleEnd).getTime();
  const value = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())).getTime();
  return value >= start && value <= end;
}

function buildCycle(startDate: Date): HouseCanaryBillingCycle {
  const endDate = addUtcMonths(startDate, 1);
  const cycleStart = formatUtcDate(startDate);
  const cycleEnd = formatUtcDate(endDate);
  return {
    cycleStart,
    cycleEnd,
    label: `${cycleStart} to ${cycleEnd}`,
  };
}

export function getHouseCanaryBillingCycle(targetDate: Date = new Date()): HouseCanaryBillingCycle {
  const normalizedTarget = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));

  for (const cycle of KNOWN_BILLING_CYCLES) {
    if (containsDate(cycle, normalizedTarget)) return cycle;
  }

  const latestKnownCycle = KNOWN_BILLING_CYCLES[KNOWN_BILLING_CYCLES.length - 1];
  let cursorStart = addUtcDays(parseUtcDate(latestKnownCycle.cycleEnd), 1);
  let cursorCycle = buildCycle(cursorStart);

  while (normalizedTarget.getTime() > parseUtcDate(cursorCycle.cycleEnd).getTime()) {
    cursorStart = addUtcDays(parseUtcDate(cursorCycle.cycleEnd), 1);
    cursorCycle = buildCycle(cursorStart);
  }

  return cursorCycle;
}

export function chooseHouseCanaryOrderProduct(
  usage: HouseCanaryCycleUsage,
  targetDate: Date = new Date(),
): HouseCanaryOrderAllocation {
  const cycle = getHouseCanaryBillingCycle(targetDate);
  const propertyExplorerOrders = Math.max(0, Math.floor(usage.propertyExplorerOrders || 0));
  const agileInsightsOrders = Math.max(0, Math.floor(usage.agileInsightsOrders || 0));

  if (propertyExplorerOrders < FREE_PROPERTY_EXPLORER_PER_CYCLE) {
    return {
      cycle,
      selectedProduct: 'property_explorer',
      productSequenceNumber: propertyExplorerOrders + 1,
      overallSequenceNumber: propertyExplorerOrders + agileInsightsOrders + 1,
      isFreeTier: true,
      freePropertyExplorerRemaining: FREE_PROPERTY_EXPLORER_PER_CYCLE - (propertyExplorerOrders + 1),
      freeAgileInsightsRemaining: Math.max(0, FREE_AGILE_INSIGHTS_PER_CYCLE - agileInsightsOrders),
    };
  }

  const nextAgileSequence = agileInsightsOrders + 1;
  return {
    cycle,
    selectedProduct: 'agile_insights',
    productSequenceNumber: nextAgileSequence,
    overallSequenceNumber: propertyExplorerOrders + agileInsightsOrders + 1,
    isFreeTier: nextAgileSequence <= FREE_AGILE_INSIGHTS_PER_CYCLE,
    freePropertyExplorerRemaining: 0,
    freeAgileInsightsRemaining: Math.max(0, FREE_AGILE_INSIGHTS_PER_CYCLE - nextAgileSequence),
  };
}
