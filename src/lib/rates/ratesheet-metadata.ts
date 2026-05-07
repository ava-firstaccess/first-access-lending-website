import fs from 'fs';
import * as XLSX from 'xlsx';
import type { Stage1PricingEngine } from '@/lib/stage1-pricing/types';
import buttonRatesheet from './button-ratesheet.json';
import arcHomeRatesheet from './arc-home-ratesheet.json';
import vistaRatesheet from './vista-ratesheet.json';
import osbRatesheet from './osb-ratesheet.json';
import newrezRatesheet from './newrez-ratesheet.json';
import verusRatesheet from './verus-ratesheet.json';
import deephavenRatesheet from './deephaven-ratesheet.json';
import { RATESHEET_DATE_FALLBACKS } from './ratesheet-date-fallbacks';

export type RatesheetDateInfo = {
  label: 'Pricing date' | 'Workbook modified' | 'Last collected';
  value: string | null;
  collectedAt: string | null;
  sourceWorkbook: string;
  source: 'sheet' | 'workbook-props' | 'file-mtime' | 'unknown';
};

type RatesheetConfig = {
  sourceWorkbook: string;
  extract: () => Omit<RatesheetDateInfo, 'collectedAt' | 'sourceWorkbook'>;
};

const TIME_ZONE = 'America/Los_Angeles';
const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
let cache: Partial<Record<Stage1PricingEngine, RatesheetDateInfo>> | null = null;

function asDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return null;
}

function formatDateOnly(value: Date) {
  return dateFormatter.format(value);
}

function formatDateTime(value: Date) {
  return dateTimeFormatter.format(value);
}

function readRows(workbookPath: string, sheetName: string) {
  const workbook = XLSX.readFile(workbookPath, { raw: true, cellDates: true, bookProps: true });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, blankrows: true }) as unknown[][];
  return { workbook, rows };
}

function cell(rows: unknown[][], row: number, col: number) {
  return rows[row - 1]?.[col - 1];
}

function infoFromDate(dateValue: unknown, timeValue?: unknown): Omit<RatesheetDateInfo, 'collectedAt' | 'sourceWorkbook'> {
  const date = asDate(dateValue);
  const time = typeof timeValue === 'string' && timeValue.trim() ? timeValue.trim() : null;
  if (date) {
    return {
      label: 'Pricing date',
      value: time ? `${formatDateOnly(date)} ${time}` : formatDateTime(date),
      source: 'sheet',
    };
  }
  return { label: 'Last collected', value: null, source: 'unknown' };
}

function fallbackInfo(workbookPath: string): Omit<RatesheetDateInfo, 'collectedAt' | 'sourceWorkbook'> {
  const workbook = XLSX.readFile(workbookPath, { bookProps: true, cellDates: true });
  const modifiedDate = asDate(workbook.Props?.ModifiedDate);
  if (modifiedDate) {
    return { label: 'Workbook modified', value: formatDateTime(modifiedDate), source: 'workbook-props' };
  }
  return { label: 'Last collected', value: null, source: 'unknown' };
}

const CONFIG: Record<Stage1PricingEngine, RatesheetConfig> = {
  Button: {
    sourceWorkbook: buttonRatesheet.sourceWorkbook,
    extract: () => {
      const { rows } = readRows(buttonRatesheet.sourceWorkbook, 'Pricing');
      return infoFromDate(cell(rows, 7, 2));
    },
  },
  'Arc Home': {
    sourceWorkbook: arcHomeRatesheet.sourceWorkbook,
    extract: () => {
      const { rows } = readRows(arcHomeRatesheet.sourceWorkbook, 'Corr - Del Non-Agency');
      return infoFromDate(cell(rows, 6, 13));
    },
  },
  Vista: {
    sourceWorkbook: vistaRatesheet.sourceWorkbook,
    extract: () => fallbackInfo(vistaRatesheet.sourceWorkbook),
  },
  OSB: {
    sourceWorkbook: osbRatesheet.sourceWorkbook,
    extract: () => {
      const { rows } = readRows(osbRatesheet.sourceWorkbook, 'Expanded Prime Plus');
      return infoFromDate(cell(rows, 2, 25), cell(rows, 3, 25));
    },
  },
  NewRez: {
    sourceWorkbook: newrezRatesheet.sourceWorkbook,
    extract: () => {
      const { rows } = readRows(newrezRatesheet.sourceWorkbook, 'Home Equity');
      return infoFromDate(cell(rows, 3, 13), cell(rows, 3, 15));
    },
  },
  Verus: {
    sourceWorkbook: verusRatesheet.sourceWorkbook,
    extract: () => {
      const { rows } = readRows(verusRatesheet.sourceWorkbook, 'CES');
      const timeDate = asDate(cell(rows, 4, 10));
      const timeText = timeDate ? timeDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TIME_ZONE }) : undefined;
      return infoFromDate(cell(rows, 3, 10), timeText);
    },
  },
  Deephaven: {
    sourceWorkbook: deephavenRatesheet.sourceWorkbook,
    extract: () => {
      const { rows } = readRows(deephavenRatesheet.sourceWorkbook, 'Equity Advantage');
      return infoFromDate(cell(rows, 4, 15));
    },
  },
};

export function getStage1RatesheetDateMap(): Partial<Record<Stage1PricingEngine, RatesheetDateInfo>> {
  if (cache) return cache;
  const next: Partial<Record<Stage1PricingEngine, RatesheetDateInfo>> = {};
  for (const engine of Object.keys(CONFIG) as Stage1PricingEngine[]) {
    const config = CONFIG[engine];
    const stats = fs.existsSync(config.sourceWorkbook) ? fs.statSync(config.sourceWorkbook) : null;
    if (!stats && RATESHEET_DATE_FALLBACKS[engine]) {
      next[engine] = RATESHEET_DATE_FALLBACKS[engine];
      continue;
    }
    try {
      const extracted = config.extract();
      next[engine] = {
        ...extracted,
        sourceWorkbook: config.sourceWorkbook,
        collectedAt: stats ? formatDateTime(stats.mtime) : null,
      };
      if (!next[engine]?.value && stats) {
        next[engine] = {
          label: 'Last collected',
          value: formatDateTime(stats.mtime),
          collectedAt: formatDateTime(stats.mtime),
          sourceWorkbook: config.sourceWorkbook,
          source: 'file-mtime',
        };
      }
    } catch {
      next[engine] = RATESHEET_DATE_FALLBACKS[engine] ?? {
        label: 'Last collected',
        value: stats ? formatDateTime(stats.mtime) : null,
        collectedAt: stats ? formatDateTime(stats.mtime) : null,
        sourceWorkbook: config.sourceWorkbook,
        source: stats ? 'file-mtime' : 'unknown',
      };
    }
  }
  cache = next;
  return next;
}
