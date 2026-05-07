import type { Stage1PricingEngine } from '@/lib/stage1-pricing/types';
import buttonRatesheet from './button-ratesheet.json';
import arcHomeRatesheet from './arc-home-ratesheet.json';
import vistaRatesheet from './vista-ratesheet.json';
import osbRatesheet from './osb-ratesheet.json';
import newrezRatesheet from './newrez-ratesheet.json';
import verusRatesheet from './verus-ratesheet.json';
import deephavenRatesheet from './deephaven-ratesheet.json';

export type RatesheetDateInfo = {
  label: 'Pricing date' | 'Workbook modified' | 'Last collected';
  value: string | null;
  collectedAt: string | null;
  sourceWorkbook: string;
  source: 'sheet' | 'workbook-props' | 'file-mtime' | 'unknown';
};

type RatesheetJson = {
  ratesheetMeta?: {
    label?: string | null;
    value?: string | null;
    collectedAt?: string | null;
    sourceWorkbook?: string | null;
    source?: string | null;
  } | null;
};

const RATESHEETS: Record<Stage1PricingEngine, RatesheetJson> = {
  Button: buttonRatesheet as unknown as RatesheetJson,
  'Arc Home': arcHomeRatesheet as unknown as RatesheetJson,
  Vista: vistaRatesheet as unknown as RatesheetJson,
  OSB: osbRatesheet as unknown as RatesheetJson,
  NewRez: newrezRatesheet as unknown as RatesheetJson,
  Verus: verusRatesheet as unknown as RatesheetJson,
  Deephaven: deephavenRatesheet as unknown as RatesheetJson,
};

let cache: Partial<Record<Stage1PricingEngine, RatesheetDateInfo>> | null = null;

export function getStage1RatesheetDateMap(): Partial<Record<Stage1PricingEngine, RatesheetDateInfo>> {
  if (cache) return cache;
  const next: Partial<Record<Stage1PricingEngine, RatesheetDateInfo>> = {};
  for (const engine of Object.keys(RATESHEETS) as Stage1PricingEngine[]) {
    const info = RATESHEETS[engine]?.ratesheetMeta;
    if (info && info.label && info.sourceWorkbook && info.source) {
      next[engine] = {
        label: info.label as RatesheetDateInfo['label'],
        value: info.value ?? null,
        collectedAt: info.collectedAt ?? null,
        sourceWorkbook: info.sourceWorkbook,
        source: info.source as RatesheetDateInfo['source'],
      };
    }
  }
  cache = next;
  return next;
}
