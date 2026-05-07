import type { Stage1PricingEngine } from '@/lib/stage1-pricing/types';
import type { RatesheetDateInfo } from './ratesheet-metadata';

export const RATESHEET_DATE_FALLBACKS: Partial<Record<Stage1PricingEngine, RatesheetDateInfo>> = {
  Button: {
    label: 'Last collected',
    value: 'May 7, 2026, 9:00 AM',
    collectedAt: 'May 7, 2026, 9:00 AM',
    sourceWorkbook: '/Users/ava/Documents/GitHub/first-access-lending/getaccess/ratesheets/latest_button.xlsx',
    source: 'file-mtime',
  },
  'Arc Home': {
    label: 'Last collected',
    value: 'May 7, 2026, 9:00 AM',
    collectedAt: 'May 7, 2026, 9:00 AM',
    sourceWorkbook: '/Users/ava/Documents/GitHub/first-access-lending/getaccess/ratesheets/latest_arc_home.xlsx',
    source: 'file-mtime',
  },
  Vista: {
    label: 'Workbook modified',
    value: 'May 6, 2026, 7:36 AM',
    collectedAt: 'May 7, 2026, 9:00 AM',
    sourceWorkbook: '/Users/ava/Documents/GitHub/first-access-lending/getaccess/ratesheets/latest_vista.xlsx',
    source: 'workbook-props',
  },
  OSB: {
    label: 'Last collected',
    value: 'May 7, 2026, 9:00 AM',
    collectedAt: 'May 7, 2026, 9:00 AM',
    sourceWorkbook: '/Users/ava/Documents/GitHub/first-access-lending/getaccess/ratesheets/latest_osb.xlsm',
    source: 'file-mtime',
  },
  NewRez: {
    label: 'Last collected',
    value: 'May 7, 2026, 9:00 AM',
    collectedAt: 'May 7, 2026, 9:00 AM',
    sourceWorkbook: '/Users/ava/Documents/GitHub/first-access-lending/getaccess/ratesheets/latest_newrez.xls',
    source: 'file-mtime',
  },
  Verus: {
    label: 'Last collected',
    value: 'May 7, 2026, 9:00 AM',
    collectedAt: 'May 7, 2026, 9:00 AM',
    sourceWorkbook: '/Users/ava/Documents/GitHub/first-access-lending/getaccess/ratesheets/latest_verus.xlsx',
    source: 'file-mtime',
  },
  Deephaven: {
    label: 'Last collected',
    value: 'May 7, 2026, 9:00 AM',
    collectedAt: 'May 7, 2026, 9:00 AM',
    sourceWorkbook: '/Users/ava/Documents/GitHub/first-access-lending/getaccess/ratesheets/latest_deephaven.xlsx',
    source: 'file-mtime',
  },
};
