#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = '/Users/ava/Documents/GitHub/first-access-lending';
const RATE_DIR = path.join(ROOT, 'src', 'lib', 'rates');
const TIME_ZONE = 'America/Los_Angeles';
const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function assertOk(result, label) {
  if (result.status !== 0) {
    throw new Error(`${label} failed with code ${result.status}\n${result.stdout || ''}${result.stderr || ''}`.trim());
  }
}

function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assertOk(result, `${command} ${args.join(' ')}`);
  return result;
}

function normalize(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    if (['N/A', 'NA', '#N/A', '-'].includes(text.toUpperCase())) return null;
    return text;
  }
  return value;
}

function price(value) {
  const normalized = normalize(value);
  if (normalized === null) return null;
  if (typeof normalized === 'number') return Math.round(normalized * 1000) / 1000;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 1000) / 1000 : null;
}

function rawCell(rows, row, col) {
  return rows[row - 1]?.[col - 1];
}

function cell(rows, row, col) {
  return normalize(rawCell(rows, row, col));
}

function parseRows(rows, startRow, endRow, labelCol, firstValueCol, lastValueCol) {
  const out = [];
  for (let row = startRow; row <= endRow; row += 1) {
    const label = cell(rows, row, labelCol);
    if (label === null) continue;
    out.push({
      label: String(label),
      values: Array.from({ length: lastValueCol - firstValueCol + 1 }, (_, index) => price(rawCell(rows, row, firstValueCol + index))),
    });
  }
  return out;
}

function rateValue(value) {
  const normalized = normalize(value);
  if (normalized === null) return null;
  if (typeof normalized === 'number') return Math.round(normalized * 1000000) / 1000000;
  const parsed = Number(String(normalized).replace('%', ''));
  if (!Number.isFinite(parsed)) return null;
  return String(normalized).includes('%') ? Math.round((parsed / 100) * 1000000) / 1000000 : Math.round(parsed * 1000000) / 1000000;
}

function parsePricingBlock(rows, startRow, endRow, rateCol, firstPriceCol, columns) {
  const data = [];
  for (let row = startRow; row <= endRow; row += 1) {
    const noteRate = rateValue(rawCell(rows, row, rateCol));
    if (noteRate === null) continue;
    const prices = {};
    columns.forEach((columnName, index) => {
      prices[columnName] = price(rawCell(rows, row, firstPriceCol + index));
    });
    data.push({ noteRate, prices });
  }
  return data;
}

function writeJson(filename, data) {
  const outPath = path.join(RATE_DIR, filename);
  fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return outPath;
}

function asDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return null;
}

function formatDateOnly(value) {
  return dateFormatter.format(value);
}

function formatDateTime(value) {
  return dateTimeFormatter.format(value);
}

function infoFromDate(dateValue, timeValue) {
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

function metadataFromWorkbookProps(workbookPath) {
  const workbook = XLSX.readFile(workbookPath, { bookProps: true, cellDates: true });
  const modifiedDate = asDate(workbook.Props?.ModifiedDate);
  if (modifiedDate) {
    return { label: 'Workbook modified', value: formatDateTime(modifiedDate), source: 'workbook-props' };
  }
  return { label: 'Last collected', value: null, source: 'unknown' };
}

function rowsFromSheet(workbookPath, sheetName) {
  const workbook = XLSX.readFile(workbookPath, { raw: true, cellDates: true });
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, blankrows: true });
}

function readCell(rows, row, col) {
  return rows[row - 1]?.[col - 1];
}

function metadataForRatesheet(filename, workbookPath) {
  if (filename === 'button-ratesheet.json') {
    const rows = rowsFromSheet(workbookPath, 'Pricing');
    return infoFromDate(readCell(rows, 7, 2));
  }
  if (filename === 'arc-home-ratesheet.json') {
    const rows = rowsFromSheet(workbookPath, 'Corr - Del Non-Agency');
    return infoFromDate(readCell(rows, 6, 13));
  }
  if (filename === 'vista-ratesheet.json') return metadataFromWorkbookProps(workbookPath);
  if (filename === 'osb-ratesheet.json') {
    const rows = rowsFromSheet(workbookPath, 'Expanded Prime Plus');
    return infoFromDate(readCell(rows, 2, 25), readCell(rows, 3, 25));
  }
  if (filename === 'newrez-ratesheet.json') {
    const rows = rowsFromSheet(workbookPath, 'Home Equity');
    return infoFromDate(readCell(rows, 3, 13), readCell(rows, 3, 15));
  }
  if (filename === 'verus-ratesheet.json') {
    const rows = rowsFromSheet(workbookPath, 'CES');
    const timeDate = asDate(readCell(rows, 4, 10));
    const timeText = timeDate ? timeDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TIME_ZONE }) : undefined;
    return infoFromDate(readCell(rows, 3, 10), timeText);
  }
  if (filename === 'deephaven-ratesheet.json') {
    const rows = rowsFromSheet(workbookPath, 'Equity Advantage');
    return infoFromDate(readCell(rows, 4, 15));
  }
  return { label: 'Last collected', value: null, source: 'unknown' };
}

function attachRatesheetMetadata(filename) {
  const outPath = path.join(RATE_DIR, filename);
  const data = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  const workbookPath = data.sourceWorkbook;
  const stats = fs.existsSync(workbookPath) ? fs.statSync(workbookPath) : null;
  const extracted = metadataForRatesheet(filename, workbookPath);
  data.ratesheetMeta = {
    label: extracted.label,
    value: extracted.value,
    collectedAt: stats ? formatDateTime(stats.mtime) : null,
    sourceWorkbook: workbookPath,
    source: extracted.source,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function generateNewRez() {
  const workbookPath = path.join(SOURCE_ROOT, 'getaccess', 'ratesheets', 'latest_newrez.xls');
  const workbook = XLSX.readFile(workbookPath, { raw: true, cellDates: true });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Home Equity'], { header: 1, raw: true, blankrows: true });
  const columns = ['BE15', 'BE30', 'BE45', 'BE60', 'BE75', 'BE90'];

  return writeJson('newrez-ratesheet.json', {
    sourceWorkbook: workbookPath,
    sheet: 'Home Equity',
    pricing: {
      '30 Year Fixed': {
        columns,
        rows: parsePricingBlock(rows, 20, 60, 1, 2, columns),
      },
      '20 Year Fixed': {
        columns,
        rows: parsePricingBlock(rows, 20, 60, 9, 10, columns),
      },
      '15 Year Fixed': {
        columns,
        rows: parsePricingBlock(rows, 65, 105, 1, 2, columns),
      },
    },
    cltv30: {
      cltvBuckets: Array.from({ length: 9 }, (_, index) => String(cell(rows, 109, 5 + index))),
      rows: parseRows(rows, 110, 116, 3, 5, 13),
    },
    cltv1520: {
      cltvBuckets: Array.from({ length: 9 }, (_, index) => String(cell(rows, 118, 5 + index))),
      rows: parseRows(rows, 119, 125, 3, 5, 13),
    },
    additional: {
      cltvBuckets: Array.from({ length: 9 }, (_, index) => String(cell(rows, 127, 5 + index))),
      rows: parseRows(rows, 128, 133, 3, 5, 13),
    },
    loanAmount: {
      cltvBuckets: Array.from({ length: 9 }, (_, index) => String(cell(rows, 135, 5 + index))),
      rows: parseRows(rows, 136, 139, 3, 5, 13),
    },
    guideMaxPrice: {
      default: price(rawCell(rows, 121, 15)),
    },
  });
}

function parseMatrixRows(rows, rowStart, rowEnd, labelCol, valueStartCol, valueEndCol) {
  const out = [];
  for (let row = rowStart; row <= rowEnd; row += 1) {
    const label = cell(rows, row, labelCol);
    if (label === null) continue;
    out.push({
      label: String(label),
      values: Array.from({ length: valueEndCol - valueStartCol + 1 }, (_, index) => price(rawCell(rows, row, valueStartCol + index))),
    });
  }
  return out;
}

function parseDeephavenProgram(rows, sheetLabel, expandedPrime = false) {
  const pricing = [];
  for (let row = 6; row <= rows.length; row += 1) {
    const rate = price(rawCell(rows, row, 2));
    if (rate === null) continue;
    const fifteen = price(rawCell(rows, row, 3));
    const thirty = price(rawCell(rows, row, 4));
    if (fifteen === null && thirty === null) continue;
    pricing.push({
      rate,
      prices: {
        '15Y Fixed': fifteen,
        '30Y Fixed': thirty,
      },
    });
  }

  const cltvBuckets = Array.from({ length: 8 }, (_, index) => price(rawCell(rows, 5, 10 + index)));

  return {
    sheet: sheetLabel,
    minPrice: price(rawCell(rows, expandedPrime ? 42 : 35, 8)),
    maxPriceTiers: expandedPrime
      ? [
          { upToLoanAmount: 500000, maxPrice: price(rawCell(rows, 40, 8)) },
          { upToLoanAmount: 999999999, maxPrice: price(rawCell(rows, 41, 8)) },
        ]
      : [
          { upToLoanAmount: 999999999, maxPrice: price(rawCell(rows, 34, 8)) },
        ],
    pricing,
    products: ['15Y Fixed', '30Y Fixed'],
    cltvBuckets,
    creditAdjustments: parseMatrixRows(rows, 6, expandedPrime ? 12 : 11, 8, 10, 17),
    documentationAdjustments: expandedPrime
      ? {
          bankStatement: parseMatrixRows(rows, 13, 14, 8, 10, 17),
          pnlOnly: parseMatrixRows(rows, 15, 16, 8, 10, 17),
        }
      : {
          bankStatement: [],
          pnlOnly: [],
        },
    adjustments: {
      term: parseMatrixRows(rows, expandedPrime ? 22 : 18, expandedPrime ? 24 : 20, 8, 10, 17),
      occupancy: parseMatrixRows(rows, expandedPrime ? 25 : 21, expandedPrime ? 26 : 22, 8, 10, 17),
      loanAmount: parseMatrixRows(rows, expandedPrime ? 27 : 23, expandedPrime ? 29 : 25, 8, 10, 17),
      propertyType: parseMatrixRows(rows, expandedPrime ? 31 : 27, expandedPrime ? 33 : 28, 8, 10, 17),
      dti: parseMatrixRows(rows, expandedPrime ? 34 : 29, expandedPrime ? 35 : 29, 8, 10, 17),
      state: parseMatrixRows(rows, expandedPrime ? 38 : 31, expandedPrime ? 38 : 31, 8, 10, 17),
    },
  };
}

function generateDeephaven() {
  const workbookPath = path.join(SOURCE_ROOT, 'getaccess', 'ratesheets', 'latest_deephaven.xlsx');
  const workbook = XLSX.readFile(workbookPath, { raw: true, cellDates: true });
  const expanded = XLSX.utils.sheet_to_json(workbook.Sheets['Equity Advantage'], { header: 1, raw: true, blankrows: false });
  const nonPrime = XLSX.utils.sheet_to_json(workbook.Sheets['Equity Advantage Elite'], { header: 1, raw: true, blankrows: false });

  return writeJson('deephaven-ratesheet.json', {
    sourceWorkbook: workbookPath,
    programs: {
      'Expanded Prime': parseDeephavenProgram(expanded, 'Equity Advantage', true),
      'Non-Prime': parseDeephavenProgram(nonPrime, 'Equity Advantage Elite', false),
    },
  });
}

function parseVerusPricing(rows, startRow, endRow, rateCol, firstPriceCol, products) {
  const out = [];
  for (let row = startRow; row <= endRow; row += 1) {
    const rate = price(rawCell(rows, row, rateCol));
    if (rate === null) continue;
    const prices = {};
    products.forEach((product, index) => {
      prices[product] = price(rawCell(rows, row, firstPriceCol + index));
    });
    out.push({ rate, prices });
  }
  return out;
}

function parseVerusMatrix(rows, rowStart, rowEnd, labelCol, valueStartCol, valueEndCol) {
  const parsed = parseMatrixRows(rows, rowStart, rowEnd, labelCol, valueStartCol, valueEndCol);
  return {
    rows: parsed.map(row => row.label),
    columns: Array.from({ length: valueEndCol - valueStartCol + 1 }, (_, index) => String(cell(rows, rowStart - 1, valueStartCol + index) ?? '')),
    values: parsed.map(row => row.values.map(value => value ?? 'NA')),
  };
}

function parseVerusLockAdjustments(rows, rowStart, rowEnd, labelCol, valueCol) {
  const out = {};
  for (let row = rowStart; row <= rowEnd; row += 1) {
    const label = String(cell(rows, row, labelCol) ?? '').trim();
    const match = label.match(/(\d+)/);
    if (!match) continue;
    out[match[1]] = price(rawCell(rows, row, valueCol)) ?? 0;
  }
  return out;
}

function generateVerus() {
  const workbookPath = path.join(SOURCE_ROOT, 'getaccess', 'ratesheets', 'latest_verus.xlsx');
  const workbook = XLSX.readFile(workbookPath, { raw: true, cellDates: true });
  const cesRows = XLSX.utils.sheet_to_json(workbook.Sheets.CES, { header: 1, raw: true, blankrows: true });
  const helocRows = XLSX.utils.sheet_to_json(workbook.Sheets.HELOC, { header: 1, raw: true, blankrows: true });
  const cesProducts = ['10 YR FIX', '15 YR FIX', '20 YR FIX', '25 YR FIX', '30 YR FIX'];
  const helocProducts = ['15 YR', '20 YR', '25 YR', '30 YR'];

  return writeJson('verus-ratesheet.json', {
    sourceWorkbook: workbookPath,
    programs: {
      CES: {
        sheet: 'CES',
        minPrice: price(rawCell(cesRows, 55, 2)),
        maxPrice: price(rawCell(cesRows, 56, 2)),
        pricing: {
          standard: parseVerusPricing(cesRows, 7, 54, 1, 2, cesProducts),
          alt: parseVerusPricing(cesRows, 7, 54, 8, 9, cesProducts),
        },
        products: cesProducts,
        adjustments: {
          docStandard2Year: parseVerusMatrix(cesRows, 59, 65, 3, 4, 11),
          docAlt: parseVerusMatrix(cesRows, 67, 73, 3, 4, 11),
          dti: parseVerusMatrix(cesRows, 80, 82, 2, 4, 12),
          loanAmount: parseVerusMatrix(cesRows, 83, 88, 2, 4, 12),
          occupancy: parseVerusMatrix(cesRows, 89, 90, 2, 4, 12),
          propertyType: parseVerusMatrix(cesRows, 91, 92, 2, 4, 12),
          state: parseVerusMatrix(cesRows, 93, 93, 2, 4, 12),
          lockAdjustments: parseVerusLockAdjustments(cesRows, 98, 100, 2, 4),
        },
      },
      HELOC: {
        sheet: 'HELOC',
        primeRate: price(rawCell(helocRows, 5, 10)),
        pricing: parseVerusPricing(helocRows, 7, 54, 1, 2, helocProducts).map(row => ({ margin: row.rate, prices: row.prices })),
        products: helocProducts,
        drawPeriodsYears: [2, 3, 5],
        adjustments: {
          docStandard2Year: parseVerusMatrix(helocRows, 59, 64, 3, 4, 11),
          docAlt: parseVerusMatrix(helocRows, 66, 71, 3, 4, 11),
          drawTerm: parseVerusMatrix(helocRows, 75, 77, 2, 4, 12),
          dti: parseVerusMatrix(helocRows, 78, 80, 2, 4, 12),
          loanAmount: parseVerusMatrix(helocRows, 81, 84, 2, 4, 12),
          occupancy: parseVerusMatrix(helocRows, 85, 86, 2, 4, 12),
          propertyType: parseVerusMatrix(helocRows, 87, 88, 2, 4, 12),
          state: parseVerusMatrix(helocRows, 89, 89, 2, 4, 12),
          lockAdjustments: parseVerusLockAdjustments(helocRows, 92, 94, 2, 4),
        },
      },
    },
  });
}

function generateArcHome() {
  const workbookPath = path.join(SOURCE_ROOT, 'getaccess', 'ratesheets', 'latest_arc_home.xlsx');
  const workbook = XLSX.readFile(workbookPath, { raw: true, cellDates: true });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Corr - Del Non-Agency'], { header: 1, raw: true, blankrows: true });
  const lockColumns = ['15 Day', '30 Day', '45 Day', '60 Day', '75 Day', '90 Day'];

  const noteRates = parsePricingBlock(rows, 1071, 1088, 1, 2, lockColumns);

  return writeJson('arc-home-ratesheet.json', {
    sourceWorkbook: workbookPath,
    sheet: 'Corr - Del Non-Agency',
    section: 'All Arc Closed End Second Lien - Base Pricing',
    title: 'Correspondent Delegated Non-Agency Rates',
    priceCode: String(rawCell(rows, 1126, 13) ?? '').replace(/^Price Code:\s*/i, ''),
    program: 'Arc Home',
    products: ['10 Year Maturity', '15 Year Maturity', '20 Year Maturity', '30 Year Maturity'],
    lockPeriods: lockColumns.map(label => Number.parseInt(label, 10)),
    pricing: { rows: noteRates },
    adjustments: {
      term: parseRows(rows, 1131, 1134, 13, 14, 14).map(row => ({ label: String(row.label), value: price(row.values[0]) })),
      cltvBuckets: Array.from({ length: 6 }, (_, index) => String(rawCell(rows, 1132, 5 + index) ?? '')),
      fico: parseRows(rows, 1133, 1139, 2, 5, 10),
      loanAmount: parseRows(rows, 1142, 1147, 2, 5, 10),
      occupancy: parseRows(rows, 1150, 1152, 2, 5, 10),
      dti: parseRows(rows, 1155, 1155, 2, 5, 10),
      propertyType: parseRows(rows, 1158, 1161, 2, 5, 10),
      maxPrice: {
        conditionLabel: String(rawCell(rows, 1137, 13) ?? ''),
        rows: [
          { term: '10 Year Maturity', withCondition: price(rawCell(rows, 1139, 13)), allElse: price(rawCell(rows, 1139, 14)) },
          { term: '15 Year Maturity', withCondition: price(rawCell(rows, 1140, 13)), allElse: price(rawCell(rows, 1140, 14)) },
          { term: '20 Year Maturity', withCondition: price(rawCell(rows, 1141, 13)), allElse: price(rawCell(rows, 1141, 14)) },
          { term: '30 Year Maturity', withCondition: price(rawCell(rows, 1142, 13)), allElse: price(rawCell(rows, 1142, 14)) },
        ],
      },
    },
  });
}

function main() {
  run('python3', ['scripts/generate-button-ratesheet-data.py']);
  run('python3', ['scripts/generate-osb-ratesheet-data.py']);
  run('python3', ['scripts/generate-vista-ratesheet-data.py']);
  const outputs = [generateNewRez(), generateDeephaven(), generateVerus(), generateArcHome()];
  [
    'button-ratesheet.json',
    'osb-ratesheet.json',
    'vista-ratesheet.json',
    'newrez-ratesheet.json',
    'deephaven-ratesheet.json',
    'verus-ratesheet.json',
    'arc-home-ratesheet.json',
  ].forEach(attachRatesheetMetadata);
  console.log(JSON.stringify({ updated: outputs }, null, 2));
}

main();
