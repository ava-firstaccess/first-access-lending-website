export type AvmProviderName =
  | 'Clear Capital'
  | 'Veros'
  | 'CA Value'
  | 'Black Knight (Valusure)'
  | 'CoreLogic'
  | 'HouseCanary'
  | 'Red Bell'
  | 'Home Genius';

export type InvestorName =
  | 'Onslow'
  | 'Verus'
  | 'SG Capital'
  | 'NQM Capital'
  | 'Vista'
  | 'NewRez'
  | 'Button'
  | 'DeepHaven'
  | 'Arc';

export type VerificationAvmProvider = 'HouseCanary' | 'Clear Capital';

export type InvestorAvmRule = {
  investor: InvestorName;
  allowsQmHpml: boolean;
  provider: AvmProviderName;
  minConfidenceAllowed: number | null;
  maxFsdAllowed: number | null;
  supported: boolean;
  source: 'investor_avm_matrix_2026-04-29';
  notes?: string;
};

export type InvestorAvmEvaluation = {
  investor: InvestorName;
  provider: VerificationAvmProvider;
  actualFsd: number;
  actualConfidence: number;
  rule: InvestorAvmRule | null;
  supported: boolean;
  passes: boolean;
  reason: string | null;
};

function toMaxFsd(minConfidenceAllowed: number | null) {
  if (minConfidenceAllowed === null) return null;
  return Number((1 - minConfidenceAllowed).toFixed(2));
}

function toActualConfidence(actualFsd: number) {
  return Number((1 - actualFsd).toFixed(2));
}

function rule(
  investor: InvestorName,
  allowsQmHpml: boolean,
  provider: AvmProviderName,
  minConfidenceAllowed: number | null,
  notes?: string,
): InvestorAvmRule {
  return {
    investor,
    allowsQmHpml,
    provider,
    minConfidenceAllowed,
    maxFsdAllowed: toMaxFsd(minConfidenceAllowed),
    supported: minConfidenceAllowed !== null,
    source: 'investor_avm_matrix_2026-04-29',
    notes,
  };
}

export const INVESTOR_AVM_RULES: InvestorAvmRule[] = [
  rule('Onslow', true, 'Clear Capital', 0.8),
  rule('Onslow', true, 'Veros', 0.8),
  rule('Onslow', true, 'CA Value', 0.82),
  rule('Onslow', true, 'Black Knight (Valusure)', null),
  rule('Onslow', true, 'CoreLogic', null),
  rule('Onslow', true, 'HouseCanary', 0.8),
  rule('Onslow', true, 'Red Bell', 0.8),
  rule('Onslow', true, 'Home Genius', null),

  rule('Verus', true, 'Clear Capital', 0.87),
  rule('Verus', true, 'Veros', null),
  rule('Verus', true, 'CA Value', 0.9),
  rule('Verus', true, 'Black Knight (Valusure)', null),
  rule('Verus', true, 'CoreLogic', null),
  rule('Verus', true, 'HouseCanary', 0.9),
  rule('Verus', true, 'Red Bell', 0.9),
  rule('Verus', true, 'Home Genius', null),

  rule('SG Capital', false, 'Clear Capital', 0.9),
  rule('SG Capital', false, 'Veros', null),
  rule('SG Capital', false, 'CA Value', null),
  rule('SG Capital', false, 'Black Knight (Valusure)', null),
  rule('SG Capital', false, 'CoreLogic', 0.9),
  rule('SG Capital', false, 'HouseCanary', 0.9),
  rule('SG Capital', false, 'Red Bell', null),
  rule('SG Capital', false, 'Home Genius', 0.9),

  rule('NQM Capital', false, 'Clear Capital', null),
  rule('NQM Capital', false, 'Veros', null),
  rule('NQM Capital', false, 'CA Value', null),
  rule('NQM Capital', false, 'Black Knight (Valusure)', null),
  rule('NQM Capital', false, 'CoreLogic', null),
  rule('NQM Capital', false, 'HouseCanary', null),
  rule('NQM Capital', false, 'Red Bell', null),
  rule('NQM Capital', false, 'Home Genius', null),

  rule('Vista', true, 'Clear Capital', 0.9, 'Workbook label was Vista*'),
  rule('Vista', true, 'Veros', 0.9, 'Workbook label was Vista*'),
  rule('Vista', true, 'CA Value', 0.9, 'Workbook label was Vista*'),
  rule('Vista', true, 'Black Knight (Valusure)', null, 'Workbook label was Vista*'),
  rule('Vista', true, 'CoreLogic', 0.9, 'Workbook label was Vista*'),
  rule('Vista', true, 'HouseCanary', 0.9, 'Workbook label was Vista*'),
  rule('Vista', true, 'Red Bell', null, 'Workbook label was Vista*'),
  rule('Vista', true, 'Home Genius', null, 'Workbook label was Vista*'),

  rule('NewRez', false, 'Clear Capital', 0.87),
  rule('NewRez', false, 'Veros', null),
  rule('NewRez', false, 'CA Value', null),
  rule('NewRez', false, 'Black Knight (Valusure)', null),
  rule('NewRez', false, 'CoreLogic', null),
  rule('NewRez', false, 'HouseCanary', null),
  rule('NewRez', false, 'Red Bell', null),
  rule('NewRez', false, 'Home Genius', 0.9),

  rule('Button', true, 'Clear Capital', 0.8),
  rule('Button', true, 'Veros', 0.8),
  rule('Button', true, 'CA Value', 0.8),
  rule('Button', true, 'Black Knight (Valusure)', 0.8),
  rule('Button', true, 'CoreLogic', 0.8),
  rule('Button', true, 'HouseCanary', 0.8),
  rule('Button', true, 'Red Bell', 0.8),
  rule('Button', true, 'Home Genius', 0.8),

  rule('DeepHaven', false, 'Clear Capital', 0.9),
  rule('DeepHaven', false, 'Veros', 0.9),
  rule('DeepHaven', false, 'CA Value', 0.9),
  rule('DeepHaven', false, 'Black Knight (Valusure)', null),
  rule('DeepHaven', false, 'CoreLogic', 0.9),
  rule('DeepHaven', false, 'HouseCanary', 0.9),
  rule('DeepHaven', false, 'Red Bell', null),
  rule('DeepHaven', false, 'Home Genius', 0.9),

  rule('Arc', true, 'Clear Capital', 0.87),
  rule('Arc', true, 'Veros', 0.84),
  rule('Arc', true, 'CA Value', null),
  rule('Arc', true, 'Black Knight (Valusure)', 0.74),
  rule('Arc', true, 'CoreLogic', 0.78),
  rule('Arc', true, 'HouseCanary', 0.86),
  rule('Arc', true, 'Red Bell', 0.83),
  rule('Arc', true, 'Home Genius', 0.83),
];

export function getInvestorAvmRules(investor: InvestorName) {
  return INVESTOR_AVM_RULES.filter((rule) => rule.investor === investor);
}

export function getInvestorAvmRule(investor: InvestorName, provider: AvmProviderName) {
  return INVESTOR_AVM_RULES.find((rule) => rule.investor === investor && rule.provider === provider) || null;
}

export function getMaxFsdAllowed(investor: InvestorName, provider: AvmProviderName) {
  return getInvestorAvmRule(investor, provider)?.maxFsdAllowed ?? null;
}

export function mapVerificationProviderToRuleProvider(provider: VerificationAvmProvider): AvmProviderName {
  return provider === 'Clear Capital' ? 'Clear Capital' : 'HouseCanary';
}

export function evaluateInvestorAvmRule(
  investor: InvestorName,
  provider: VerificationAvmProvider,
  actualFsd: number,
): InvestorAvmEvaluation {
  const normalizedFsd = Number(actualFsd.toFixed(2));
  const actualConfidence = toActualConfidence(normalizedFsd);
  const ruleProvider = mapVerificationProviderToRuleProvider(provider);
  const investorRule = getInvestorAvmRule(investor, ruleProvider);

  if (!investorRule || !investorRule.supported || investorRule.maxFsdAllowed === null) {
    return {
      investor,
      provider,
      actualFsd: normalizedFsd,
      actualConfidence,
      rule: investorRule,
      supported: false,
      passes: false,
      reason: `${investor} does not support ${provider} AVM for pricing eligibility.`,
    };
  }

  if (normalizedFsd <= investorRule.maxFsdAllowed) {
    return {
      investor,
      provider,
      actualFsd: normalizedFsd,
      actualConfidence,
      rule: investorRule,
      supported: true,
      passes: true,
      reason: null,
    };
  }

  return {
    investor,
    provider,
    actualFsd: normalizedFsd,
    actualConfidence,
    rule: investorRule,
    supported: true,
    passes: false,
    reason: `${investor} requires ${provider} FSD <= ${investorRule.maxFsdAllowed.toFixed(2)} (confidence >= ${investorRule.minConfidenceAllowed?.toFixed(2)}). Actual FSD is ${normalizedFsd.toFixed(2)} (confidence ${actualConfidence.toFixed(2)}).`,
  };
}
