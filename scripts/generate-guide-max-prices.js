const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const RATE_DIR = path.resolve(ROOT, '../first-access-lending/getaccess/ratesheets');
const OUT = path.join(ROOT, 'src/lib/rates/guide-max-prices.json');

function readCell(workbookPath, sheetName, cell) {
  const wb = XLSX.readFile(workbookPath, { cellFormula: false, cellNF: false, cellText: false });
  const ws = wb.Sheets[sheetName];
  return ws?.[cell]?.v ?? null;
}

const data = {
  source: 'Scraped from investor ratesheet workbooks',
  generatedAt: new Date().toISOString(),
  investors: {
    NewRez: {
      default: Number(readCell(path.join(RATE_DIR, 'latest_newrez.xls'), 'Home Equity', 'O121')),
      sheet: 'Home Equity',
      cell: 'O121',
    },
    OSB: {
      secondLiens: {
        maxPrice30Year: Number(readCell(path.join(RATE_DIR, 'latest_osb.xlsm'), '2nd Liens', 'E78')),
        maxPriceShorterTerm: Number(readCell(path.join(RATE_DIR, 'latest_osb.xlsm'), '2nd Liens', 'E79')),
        sheet: '2nd Liens',
        cells: { maxPrice30Year: 'E78', maxPriceShorterTerm: 'E79' },
      },
      heloc: {
        maxPrice30Year: Number(readCell(path.join(RATE_DIR, 'latest_osb.xlsm'), 'HELOC', 'U30')),
        maxPriceShorterTerm: Number(readCell(path.join(RATE_DIR, 'latest_osb.xlsm'), 'HELOC', 'U31')),
        sheet: 'HELOC',
        cells: { maxPrice30Year: 'U30', maxPriceShorterTerm: 'U31' },
      },
    },
    Vista: {
      ownerOccupied: Number(readCell(path.join(RATE_DIR, 'latest_vista.xlsx'), 'Price', 'H41')),
      nonOwnerOccupied: {
        noPrepayHard: 105,
        prepay3to5YearHard: 105.5,
      },
      sheet: 'Price',
      cell: 'H41',
    },
    Verus: {
      CES: {
        primaryAndSecondHomes: Number(readCell(path.join(RATE_DIR, 'latest_verus.xlsx'), 'CES', 'L105')),
        investor: {
          noPenalty: Number(readCell(path.join(RATE_DIR, 'latest_verus.xlsx'), 'CES', 'M98')),
          prepay12Months: Number(readCell(path.join(RATE_DIR, 'latest_verus.xlsx'), 'CES', 'M99')),
          prepay24Months: Number(readCell(path.join(RATE_DIR, 'latest_verus.xlsx'), 'CES', 'M100')),
          prepay36Months: Number(readCell(path.join(RATE_DIR, 'latest_verus.xlsx'), 'CES', 'M101')),
          prepay48Months: Number(readCell(path.join(RATE_DIR, 'latest_verus.xlsx'), 'CES', 'M102')),
          prepay60Months: Number(readCell(path.join(RATE_DIR, 'latest_verus.xlsx'), 'CES', 'M103')),
        },
        sheet: 'CES',
      },
      HELOC: {
        default: Number(readCell(path.join(RATE_DIR, 'latest_verus.xlsx'), 'HELOC', 'B56')),
        sheet: 'HELOC',
        cell: 'B56',
      },
    },
    Deephaven: {
      equityAdvantage: {
        default: Number(readCell(path.join(RATE_DIR, 'latest_deephaven.xlsx'), 'Equity Advantage', 'H47')),
        over500k: Number(readCell(path.join(RATE_DIR, 'latest_deephaven.xlsx'), 'Equity Advantage', 'H48')),
        sheet: 'Equity Advantage',
      },
      equityAdvantageElite: {
        default: Number(readCell(path.join(RATE_DIR, 'latest_deephaven.xlsx'), 'Equity Advantage Elite', 'H40')),
        sheet: 'Equity Advantage Elite',
        cell: 'H40',
      },
    },
    'Arc Home': {
      allElse: {
        '10 Year Maturity': 106.5,
        '15 Year Maturity': 106.5,
        '20 Year Maturity': 106.5,
        '30 Year Maturity': 106.5,
      },
      withCondition: {
        '10 Year Maturity': 107.5,
        '15 Year Maturity': 107.5,
        '20 Year Maturity': 107.5,
        '30 Year Maturity': 107.5,
      },
      sheet: 'Corr - Del Non-Agency',
    },
    Button: {
      over500k: {
        CES: Number(readCell(path.join(RATE_DIR, 'latest_button.xlsx'), 'Fully Delegated', 'J5')),
        HELOC: Number(readCell(path.join(RATE_DIR, 'latest_button.xlsx'), 'Fully Delegated', 'J6')),
      },
      sheet: 'Fully Delegated',
      cells: { CES: 'J5', HELOC: 'J6' },
      note: 'Workbook exposes over-$500k max price labels; current stage-1 default cap for Button remains 105 outside that special case.',
    },
  },
};

fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify(data, null, 2));
