const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const RATEBOOK_ROOT = path.resolve(ROOT, '../first-access-lending/getaccess/ratesheets');
const JSON_ROOT = path.join(ROOT, 'src', 'lib', 'rates');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(JSON_ROOT, name), 'utf8'));
}

function writeJson(name, data) {
  fs.writeFileSync(path.join(JSON_ROOT, name), JSON.stringify(data, null, 2) + '\n');
}

function cellValue(workbookPath, sheetName, cell) {
  const wb = XLSX.readFile(workbookPath, { cellFormula: false, cellNF: false, cellText: false });
  const ws = wb.Sheets[sheetName];
  return ws?.[cell]?.v ?? null;
}

function numberOrNull(value) {
  return typeof value === 'number' ? Number(value) : null;
}

const button = readJson('button-ratesheet.json');
button.guideMaxPrice = {
  default: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_button.xlsx'), 'Fully Delegated', 'G5')),
  over500k: {
    CES: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_button.xlsx'), 'Fully Delegated', 'J5')),
    HELOC: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_button.xlsx'), 'Fully Delegated', 'J6')),
  },
};
writeJson('button-ratesheet.json', button);

const newrez = readJson('newrez-ratesheet.json');
newrez.guideMaxPrice = {
  default: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_newrez.xls'), 'Home Equity', 'O121')),
  byCltvBucket: {
    '>85%': numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_newrez.xls'), 'Home Equity', 'O121')),
  },
};
writeJson('newrez-ratesheet.json', newrez);

const osb = readJson('osb-ratesheet.json');
osb.programs.secondLiens.guideMaxPrice = {
  maxPrice30Year: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_osb.xlsm'), '2nd Liens', 'E78')),
  maxPriceShorterTerm: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_osb.xlsm'), '2nd Liens', 'E79')),
};
osb.programs.heloc.guideMaxPrice = {
  maxPrice30Year: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_osb.xlsm'), 'HELOC', 'U30')),
  maxPriceShorterTerm: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_osb.xlsm'), 'HELOC', 'U31')),
};
writeJson('osb-ratesheet.json', osb);

const vista = readJson('vista-ratesheet.json');
vista.programs.secondOO.sections.pricing30Day.guideMaxPrice = {
  default: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_vista.xlsx'), 'Price', 'H41')),
};
vista.programs.secondNOO.sections.pricing30Day.guideMaxPrice = {
  'No Prepay - Hard': 105,
  '1yr Prepay - Hard': 105,
  '2yr Prepay - Hard': 105,
  '3yr Prepay - Hard': 105.5,
  '4yr Prepay - Hard': 105.5,
  '5yr Prepay - Hard': 105.5,
};
writeJson('vista-ratesheet.json', vista);

const verus = readJson('verus-ratesheet.json');
verus.programs.CES.guideMaxPrice = {
  primarySecondHomes: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_verus.xlsx'), 'CES', 'L105')),
  investor: {
    noPenalty: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_verus.xlsx'), 'CES', 'M98')),
    prepay12Months: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_verus.xlsx'), 'CES', 'M99')),
    prepay24Months: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_verus.xlsx'), 'CES', 'M100')),
    prepay36Months: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_verus.xlsx'), 'CES', 'M101')),
    prepay48Months: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_verus.xlsx'), 'CES', 'M102')),
    prepay60Months: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_verus.xlsx'), 'CES', 'M103')),
  },
};
verus.programs.HELOC.guideMaxPrice = {
  default: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_verus.xlsx'), 'HELOC', 'B56')),
};
writeJson('verus-ratesheet.json', verus);

const deephaven = readJson('deephaven-ratesheet.json');
deephaven.programs['Expanded Prime'].guideMaxPrice = {
  default: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_deephaven.xlsx'), 'Equity Advantage', 'H47')),
  over500k: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_deephaven.xlsx'), 'Equity Advantage', 'H48')),
};
deephaven.programs['Non-Prime'].guideMaxPrice = {
  default: numberOrNull(cellValue(path.join(RATEBOOK_ROOT, 'latest_deephaven.xlsx'), 'Equity Advantage Elite', 'H40')),
};
writeJson('deephaven-ratesheet.json', deephaven);

const arc = readJson('arc-home-ratesheet.json');
arc.guideMaxPrice = {
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
  assumption: 'withCondition ignored for stage-1 because first lien rate is unknown',
};
writeJson('arc-home-ratesheet.json', arc);

console.log('Synced guide max price fields into investor ratesheet JSON files.');
