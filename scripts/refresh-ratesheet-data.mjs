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

function parsePricingBlock(rows, startRow, endRow, rateCol, firstPriceCol, columns) {
  const data = [];
  for (let row = startRow; row <= endRow; row += 1) {
    const noteRate = price(rawCell(rows, row, rateCol));
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

function generateNewRez() {
  const workbookPath = path.join(SOURCE_ROOT, 'getaccess', 'ratesheets', 'latest_newrez.xls');
  const workbook = XLSX.readFile(workbookPath, { raw: true, cellDates: true });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Home Equity'], { header: 1, raw: true, blankrows: false });
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
          bankStatement: parseMatrixRows(rows, 20, 21, 8, 10, 17),
          pnlOnly: parseMatrixRows(rows, 22, 23, 8, 10, 17),
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

function generateVerus() {
  const workbookPath = path.join(SOURCE_ROOT, 'getaccess', 'ratesheets', 'latest_verus.xlsx');
  const workbook = XLSX.readFile(workbookPath, { raw: true, cellDates: true });
  const cesRows = XLSX.utils.sheet_to_json(workbook.Sheets.CES, { header: 1, raw: true, blankrows: false });
  const helocRows = XLSX.utils.sheet_to_json(workbook.Sheets.HELOC, { header: 1, raw: true, blankrows: false });
  const cesProducts = ['10 YR FIX', '15 YR FIX', '20 YR FIX', '25 YR FIX', '30 YR FIX'];
  const helocProducts = ['15 YR', '20 YR', '25 YR', '30 YR'];

  return writeJson('verus-ratesheet.json', {
    sourceWorkbook: workbookPath,
    programs: {
      CES: {
        sheet: 'CES',
        minPrice: price(rawCell(cesRows, 54, 2)),
        maxPrice: price(rawCell(cesRows, 55, 2)),
        pricing: {
          standard: parseVerusPricing(cesRows, 7, 53, 1, 2, cesProducts),
          alt: parseVerusPricing(cesRows, 7, 53, 8, 9, cesProducts),
        },
        products: cesProducts,
      },
      HELOC: {
        sheet: 'HELOC',
        primeRate: price(rawCell(helocRows, 4, 10)),
        pricing: parseVerusPricing(helocRows, 7, 53, 1, 2, helocProducts).map(row => ({ margin: row.rate, prices: row.prices })),
        products: helocProducts,
        drawPeriodsYears: [2, 3, 5],
      },
    },
  });
}

function main() {
  run('python3', ['scripts/generate-button-ratesheet-data.py']);
  run('python3', ['scripts/generate-osb-ratesheet-data.py']);
  run('python3', ['scripts/generate-vista-ratesheet-data.py']);
  const outputs = [generateNewRez(), generateDeephaven(), generateVerus()];
  console.log(JSON.stringify({ updated: outputs }, null, 2));
}

main();
