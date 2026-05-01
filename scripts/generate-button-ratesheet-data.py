from __future__ import annotations

import json
from pathlib import Path
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path('/Users/ava/Documents/GitHub/first-access-lending')
WORKBOOK = SOURCE_ROOT / 'getaccess' / 'ratesheets' / 'latest_button.xlsx'
OUT = ROOT / 'src' / 'lib' / 'rates' / 'button-ratesheet.json'


def row_values(ws, row: int, cols=range(1, 14)):
    values = []
    for c in cols:
        v = ws.cell(row, c).value
        if v is not None:
            values.append(v)
    return values


def matrix(ws, row_start: int, row_end: int, col_start: int = 7, col_end: int = 13):
    return [
        [ws.cell(r, c).value for c in range(col_start, col_end + 1)]
        for r in range(row_start, row_end + 1)
    ]


def main() -> None:
    wb = load_workbook(WORKBOOK, data_only=False)
    ws = wb['Fully Delegated']

    note_rates = []
    for r in range(13, 53):
        rate = ws.cell(r, 1).value
        if rate is None:
            continue
        note_rates.append({
            'noteRate': rate,
            'prices': {
                'fullDoc': {
                    'HELOC': ws.cell(r, 2).value,
                    'CES': ws.cell(r, 3).value,
                },
                'altDoc': {
                    'HELOC': ws.cell(r, 4).value,
                    'CES': ws.cell(r, 5).value,
                },
            },
        })

    data = {
        'sourceWorkbook': str(WORKBOOK),
        'sheet': 'Fully Delegated',
        'guideMaxPrice': {
            'default': ws.cell(5, 7).value,
            'over500k': {
                'CES': ws.cell(5, 10).value,
                'HELOC': ws.cell(6, 10).value,
            },
        },
        'noteRates': note_rates,
        'tables': {
            'cltv': {
                'rows': [ws.cell(r, 6).value for r in range(13, 22)],
                'columns': [ws.cell(12, c).value for c in range(7, 14)],
                'fullDoc': matrix(ws, 13, 21),
                'altDoc': matrix(ws, 26, 34),
            },
            'fico': {
                'fullDoc': {
                    'rows': [ws.cell(r, 6).value for r in range(13, 22)],
                    'columns': [ws.cell(22, c).value for c in range(7, 14)],
                    'values': matrix(ws, 13, 21),
                },
                'altDoc': {
                    'rows': [ws.cell(r, 6).value for r in range(26, 35)],
                    'columns': [ws.cell(25, c).value for c in range(7, 14)],
                    'values': matrix(ws, 26, 34),
                },
            },
            'cashOut': {
                'rows': [ws.cell(r, 6).value for r in range(37, 40)],
                'columns': [ws.cell(36, c).value for c in range(7, 14)],
                'values': matrix(ws, 37, 39),
            },
            'dti': {
                'rows': [ws.cell(r, 6).value for r in range(38, 41)],
                'columns': [ws.cell(12, c).value for c in range(7, 14)],
                'values': matrix(ws, 38, 40),
            },
            'draw': {
                'heloc': {
                    'rows': [ws.cell(r, 6).value for r in range(44, 45)],
                    'columns': [ws.cell(12, c).value for c in range(7, 14)],
                    'values': matrix(ws, 44, 44),
                },
                'nonHeloc': {
                    'rows': [ws.cell(r, 6).value for r in range(45, 48)],
                    'columns': [ws.cell(12, c).value for c in range(7, 14)],
                    'values': matrix(ws, 45, 47),
                },
            },
            'maturity': {
                'rows': [ws.cell(r, 6).value for r in range(48, 52)],
                'columns': [ws.cell(12, c).value for c in range(7, 14)],
                'values': matrix(ws, 48, 51),
            },
            'balance': {
                'rows': [ws.cell(r, 6).value for r in range(52, 59)],
                'columns': [ws.cell(51, c).value for c in range(7, 14)],
                'values': matrix(ws, 52, 58),
            },
            'borrowerCount': {
                'rows': [ws.cell(r, 1).value for r in range(59, 61)],
                'columns': [ws.cell(59, c).value for c in range(7, 14)],
                'values': matrix(ws, 59, 60),
            },
            'selfEmployed': {
                'rows': [ws.cell(r, 1).value for r in range(59, 61)],
                'columns': [ws.cell(59, c).value for c in range(7, 14)],
                'values': matrix(ws, 59, 60),
            },
            'occupancy': {
                'rows': [ws.cell(r, 6).value for r in range(61, 64)],
                'columns': [ws.cell(60, c).value for c in range(7, 14)],
                'values': matrix(ws, 61, 63),
            },
            'unitCount': {
                'rows': [ws.cell(r, 6).value for r in range(61, 64)],
                'columns': [ws.cell(60, c).value for c in range(7, 14)],
                'values': matrix(ws, 61, 63),
            },
            'bankStatements': {
                'rows': [ws.cell(r, 1).value for r in range(64, 66)],
                'columns': [ws.cell(63, c).value for c in range(2, 4)],
                'values': [[ws.cell(r, c).value for c in range(2, 4)] for r in range(64, 66)],
            },
        },
    }

    OUT.write_text(json.dumps(data, indent=2), encoding='utf-8')
    print(f'Wrote {OUT}')


if __name__ == '__main__':
    main()
