import manifest from './guide-max-prices.json';
import type { Stage1ExecutionQuote, TesterInput } from '@/lib/stage1-pricing/types';

type GuideManifest = typeof manifest;
const DATA = manifest as GuideManifest;

export function getGuideMaxBuyPrice(quote: Stage1ExecutionQuote, input: TesterInput): number {
  switch (quote.engine) {
    case 'NewRez':
      return DATA.investors.NewRez.default;
    case 'OSB':
      return quote.program === 'HELOC'
        ? (quote.product === '30 Year Maturity' ? DATA.investors.OSB.heloc.maxPrice30Year : DATA.investors.OSB.heloc.maxPriceShorterTerm)
        : (quote.product === 'Fixed 30' ? DATA.investors.OSB.secondLiens.maxPrice30Year : DATA.investors.OSB.secondLiens.maxPriceShorterTerm);
    case 'Vista':
      return input.occupancy === 'Investment'
        ? DATA.investors.Vista.nonOwnerOccupied.noPrepayHard
        : DATA.investors.Vista.ownerOccupied;
    case 'Verus':
      return quote.program === 'HELOC'
        ? DATA.investors.Verus.HELOC.default
        : (input.occupancy === 'Investment'
            ? DATA.investors.Verus.CES.investor.noPenalty
            : DATA.investors.Verus.CES.primaryAndSecondHomes);
    case 'Deephaven':
      return quote.program === 'Expanded Prime' && (input.desiredLoanAmount ?? 0) > 500000
        ? DATA.investors.Deephaven.equityAdvantage.over500k
        : 105;
    case 'Arc Home': {
      const product = quote.product as keyof typeof DATA.investors['Arc Home']['allElse'];
      return DATA.investors['Arc Home'].allElse[product] ?? 106.5;
    }
    case 'Button':
      if ((input.desiredLoanAmount ?? 0) > 500000) {
        return quote.product === 'HELOC' ? DATA.investors.Button.over500k.HELOC : DATA.investors.Button.over500k.CES;
      }
      return 105;
    default:
      return 0;
  }
}

export function getGuideMaxBuyManifest() {
  return DATA;
}
