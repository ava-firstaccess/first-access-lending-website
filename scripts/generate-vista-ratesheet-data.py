#!/usr/bin/env python3
import json
from pathlib import Path
from openpyxl import load_workbook

REPO_ROOT = Path(__file__).resolve().parent.parent
WORKBOOK_PATH = Path('/Users/ava/Documents/GitHub/first-access-lending/getaccess/ratesheets/latest_vista.xlsx')
OUTPUT_PATH = REPO_ROOT / 'src' / 'lib' / 'rates' / 'vista-ratesheet.json'

PROGRAMS = {
    'secondOO': {
        'key': 'PT',
        'inputCode': 'PR',
        'inputName': 'Second OO',
        'pricingRows': (65, 113),
        'basePriceColumn': 6,
        'maxPriceRows': {'default': 130},
        'minPriceRows': {'default': 138},
        'cltv': {
            'headerRow': 65,
            'startRow': 66,
            'endRow': 95,
            'columns': (20, 27),
            'docGroups': {
                'fullDoc': [(66, 75), (76, 85), (86, 95)],
            },
        },
        'adjustmentRows': {
            'bankStatement': (96, 98),
            'term': (99, 104),
            'amortization': (105, 106),
            'loanAmount': (107, 127),
            'dti': (128, 132),
            'dscr': (133, 133),
            'purpose': (134, 136),
            'occupancy': (137, 138),
            'valuation': (139, 140),
            'state': (141, 144),
            'propertyType': (145, 159),
            'citizenship': (160, 163),
            'employment': (164, 168),
            'firstTimeBuyer': (169, 174),
            'housingHistory': (175, 180),
            'creditEvents': (181, 187),
            'payment': (188, 189),
            'servicing': (190, 191),
            'prepay': (192, 192),
            'lockTerm': (193, 195),
            'lockType': (196, 197),
        },
    },
    'secondNOO': {
        'key': 'IT',
        'inputCode': 'IR',
        'inputName': 'Second NOO',
        'pricingRows': (210, 260),
        'basePriceColumn': 6,
        'maxPriceRows': {
            'No Prepay - Hard': 285,
            '1yr Prepay - Hard': 286,
            '2yr Prepay - Hard': 289,
            '3yr Prepay - Hard': 290,
            '4yr Prepay - Hard': 291,
            '5yr Prepay - Hard': 292,
        },
        'minPriceRows': {'default': 428},
        'cltv': {
            'headerRow': 210,
            'startRow': 211,
            'endRow': 250,
            'columns': (20, 27),
            'docGroups': {
                'fullDoc': [(211, 220), (221, 230), (231, 240), (241, 250)],
            },
        },
        'adjustmentRows': {
            'bankStatement': (251, 253),
            'term': (254, 259),
            'amortization': (260, 261),
            'loanAmount': (262, 282),
            'dti': (283, 287),
            'dscr': (288, 294),
            'purpose': (295, 297),
            'occupancy': (298, 298),
            'valuation': (299, 300),
            'state': (301, 304),
            'propertyType': (305, 319),
            'citizenship': (320, 323),
            'employment': (324, 328),
            'firstTimeBuyer': (329, 334),
            'housingHistory': (335, 340),
            'creditEvents': (341, 347),
            'payment': (348, 349),
            'servicing': (350, 351),
            'prepay': (352, 372),
            'lockTerm': (373, 375),
            'lockType': (376, 377),
        },
    },
}


def normalize_value(value):
    if value is None or value == '':
        return None
    if isinstance(value, str):
        text = value.strip()
        if text in {'#N/A', 'na', 'n/a'}:
            return None
        return text
    return value


def price(value):
    value = normalize_value(value)
    if value is None:
        return None
    return round(float(value), 3)


def parse_pricing_table(ws, start_row, end_row, base_col):
    rows = []
    for r in range(start_row, end_row + 1):
        note_rate = normalize_value(ws.cell(r, 4).value)
        base_price = price(ws.cell(r, base_col).value)
        if isinstance(note_rate, (int, float)) and base_price is not None:
            rows.append({
                'noteRate': round(float(note_rate), 3),
                'basePrice': base_price,
            })
    return rows


def parse_bucket_labels(ws, header_row, start_col, end_col):
    return [str(normalize_value(ws.cell(header_row, c).value)) for c in range(start_col, end_col + 1)]


def parse_credit_scores(ws, start_row, end_row):
    scores = []
    for r in range(start_row, end_row + 1):
        label = normalize_value(ws.cell(r, 14).value)
        if label is not None:
            scores.append(str(label))
    return scores


def parse_cltv_groups(ws, spec):
    labels = parse_bucket_labels(ws, spec['headerRow'], spec['columns'][0], spec['columns'][1])
    groups = {}
    for group_name, ranges in spec['docGroups'].items():
        rows = []
        for start_row, end_row in ranges:
            for r in range(start_row, end_row + 1):
                score_label = str(normalize_value(ws.cell(r, 14).value))
                values = [price(ws.cell(r, c).value) for c in range(spec['columns'][0], spec['columns'][1] + 1)]
                rows.append({'creditScore': score_label, 'values': values})
        groups[group_name] = {
            'cltvBuckets': labels,
            'rows': rows,
        }
    return groups


def parse_adjustment_rows(ws, start_row, end_row):
    items = []
    for r in range(start_row, end_row + 1):
        label = normalize_value(ws.cell(r, 14).value)
        lookup = normalize_value(ws.cell(r, 19).value)
        value = price(ws.cell(r, 20).value)
        if label is None and lookup is None and value is None:
            continue
        items.append({
            'label': str(label) if label is not None else '',
            'lookupKey': str(lookup) if lookup is not None else '',
            'value': value,
        })
    return items


def parse_price_map(ws, row_map):
    out = {}
    for key, row in row_map.items():
        out[key] = price(ws.cell(row, 6).value)
    return out


def main():
    wb = load_workbook(WORKBOOK_PATH, data_only=True)
    ws = wb['Price']

    data = {
        'sourceWorkbook': str(WORKBOOK_PATH),
        'sheet': 'Price',
        'programs': {},
    }

    for name, spec in PROGRAMS.items():
        data['programs'][name] = {
            'inputCode': spec['inputCode'],
            'inputName': spec['inputName'],
            'sections': {
                'pricing30Day': {
                    'rows': list(spec['pricingRows']),
                    'rowsData': parse_pricing_table(ws, spec['pricingRows'][0], spec['pricingRows'][1], spec['basePriceColumn']),
                    'maxPrice': parse_price_map(ws, spec['maxPriceRows']),
                    'minPrice': parse_price_map(ws, spec['minPriceRows']),
                },
                'cltvFullDoc': {
                    'rowRange': [spec['cltv']['startRow'], spec['cltv']['endRow']],
                    **parse_cltv_groups(ws, spec['cltv'])['fullDoc'],
                },
                'adjustments': {
                    category: {
                        'rows': list(row_range),
                        'items': parse_adjustment_rows(ws, row_range[0], row_range[1]),
                    }
                    for category, row_range in spec['adjustmentRows'].items()
                },
            },
        }

    OUTPUT_PATH.write_text(json.dumps(data, indent=2) + '\n')
    print(f'Wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
