export interface MeridianLinkBorrowerSummary {
  id: string;
  fullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffixName: string;
}

export interface MeridianLinkScoreSummary {
  id: string;
  bureau: string;
  modelName: string;
  score: number | null;
  percentile: number | null;
  scoreDate: string;
  factors: string[];
}

export interface MeridianLinkLiabilitySummary {
  id: string;
  bureau: string;
  creditorName: string;
  accountIdentifier: string;
  accountType: string;
  loanType: string;
  ownershipType: string;
  status: string;
  currentRating: string;
  openedDate: string;
  reportedDate: string;
  termsDescription: string;
  termMonths: number | null;
  monthlyPayment: number | null;
  unpaidBalance: number | null;
  highBalance: number | null;
  creditLimit: number | null;
  pastDueAmount: number | null;
}

export interface MeridianLinkParsedReport {
  borrowers: MeridianLinkBorrowerSummary[];
  scores: MeridianLinkScoreSummary[];
  liabilities: MeridianLinkLiabilitySummary[];
}

function getDirectChild(parent: Element, localName: string) {
  return Array.from(parent.children).find((child) => child.localName === localName) ?? null;
}

function getDirectText(parent: Element | null, localName: string) {
  if (!parent) return '';
  return getDirectChild(parent, localName)?.textContent?.trim() || '';
}

function getDescendantText(parent: Element | null, localNames: string[]) {
  if (!parent) return '';
  for (const localName of localNames) {
    const match = parent.getElementsByTagNameNS('*', localName)[0];
    const text = match?.textContent?.trim();
    if (text) return text;
  }
  return '';
}

function getDescendantTexts(parent: Element | null, localName: string) {
  if (!parent) return [];
  return Array.from(parent.getElementsByTagNameNS('*', localName))
    .map((node) => node.textContent?.trim() || '')
    .filter(Boolean);
}

function deriveBureau(modelName: string) {
  if (/equifax/i.test(modelName)) return 'Equifax';
  if (/experian/i.test(modelName)) return 'Experian';
  if (/transunion/i.test(modelName) || /trans union/i.test(modelName)) return 'TransUnion';
  return 'Unknown';
}

function closestAncestorByLocalName(node: Element | null, localName: string): Element | null {
  let current = node?.parentElement || null;
  while (current) {
    if (current.localName === localName) return current;
    current = current.parentElement;
  }
  return null;
}

function parseNumber(value: string) {
  if (!value) return null;
  const normalized = value.replace(/[$,]/g, '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string) {
  if (!value) return null;
  const parsed = parseInt(value.replace(/^0+(?=\d)/, ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getRepresentativeMeridianLinkScore(scores: MeridianLinkScoreSummary[]) {
  const numeric = scores
    .map((score) => score.score)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
    .sort((a, b) => a - b);

  if (numeric.length === 0) return null;
  return numeric[Math.floor(numeric.length / 2)];
}

export function isMortgageLiability(liability: MeridianLinkLiabilitySummary) {
  const haystack = `${liability.accountType} ${liability.loanType} ${liability.termsDescription}`.toLowerCase();
  return /mortgage|heloc|home\s*equity|second lien|real estate/.test(haystack);
}

export function parseMeridianLinkResponseXml(xml: string): MeridianLinkParsedReport {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('MeridianLink returned invalid XML.');
  }

  const borrowers = Array.from(doc.getElementsByTagNameNS('*', 'PARTY'))
    .filter((party) => getDescendantText(party, ['PartyRoleType']) === 'Borrower')
    .map((party, index) => {
      const individual = getDirectChild(party, 'INDIVIDUAL') || party.getElementsByTagNameNS('*', 'INDIVIDUAL')[0] || null;
      const name = individual ? getDirectChild(individual, 'NAME') || individual.getElementsByTagNameNS('*', 'NAME')[0] : null;
      const firstName = getDirectText(name, 'FirstName');
      const middleName = getDirectText(name, 'MiddleName');
      const lastName = getDirectText(name, 'LastName');
      const suffixName = getDirectText(name, 'SuffixName');
      const fullName = [firstName, middleName, lastName, suffixName].filter(Boolean).join(' ').trim();

      return {
        id: `borrower-${index + 1}`,
        fullName: fullName || getDirectText(name, 'FullName') || `Borrower ${index + 1}`,
        firstName,
        middleName,
        lastName,
        suffixName,
      };
    });

  const scores = Array.from(doc.getElementsByTagNameNS('*', 'CREDIT_SCORE')).map((score, index) => {
    const modelName = getDescendantText(score, ['CreditScoreModelNameType']);
    return {
      id: `score-${index + 1}`,
      bureau: deriveBureau(modelName),
      modelName,
      score: parseInteger(getDescendantText(score, ['CreditScoreValue'])),
      percentile: parseInteger(getDescendantText(score, ['CreditScoreRankPercentileValue'])),
      scoreDate: getDescendantText(score, ['CreditScoreDate']),
      factors: getDescendantTexts(score, 'CreditScoreFactorText'),
    };
  });

  const liabilities = Array.from(doc.getElementsByTagNameNS('*', 'CREDIT_LIABILITY')).map((liability, index) => {
    const creditFile = closestAncestorByLocalName(liability, 'CREDIT_FILE');
    const creditor = getDirectChild(liability, 'CREDIT_LIABILITY_CREDITOR');
    return {
      id: `liability-${index + 1}`,
      bureau: getDescendantText(creditFile, ['CreditRepositorySourceType']) || 'Unknown',
      creditorName: getDescendantText(creditor, ['FullName']) || `Liability ${index + 1}`,
      accountIdentifier: getDescendantText(liability, ['CreditLiabilityAccountIdentifier']),
      accountType: getDescendantText(liability, ['CreditLiabilityAccountType']),
      loanType: getDescendantText(liability, ['CreditLoanType']),
      ownershipType: getDescendantText(liability, ['CreditLiabilityAccountOwnershipType']),
      status: getDescendantText(liability, ['CreditLiabilityAccountStatusType']),
      currentRating: getDescendantText(liability, ['CreditLiabilityCurrentRatingType']),
      openedDate: getDescendantText(liability, ['CreditLiabilityAccountOpenedDate']),
      reportedDate: getDescendantText(liability, ['CreditLiabilityAccountReportedDate']),
      termsDescription: getDescendantText(liability, ['CreditLiabilityTermsDescription']),
      termMonths: parseInteger(getDescendantText(liability, ['CreditLiabilityTermsMonthsCount'])),
      monthlyPayment: parseNumber(getDescendantText(liability, ['CreditLiabilityMonthlyPaymentAmount'])),
      unpaidBalance: parseNumber(getDescendantText(liability, ['CreditLiabilityUnpaidBalanceAmount'])),
      highBalance: parseNumber(getDescendantText(liability, ['CreditLiabilityHighBalanceAmount'])),
      creditLimit: parseNumber(getDescendantText(liability, ['CreditLiabilityCreditLimitAmount'])),
      pastDueAmount: parseNumber(getDescendantText(liability, ['CreditLiabilityPastDueAmount'])),
    };
  });

  return {
    borrowers,
    scores,
    liabilities,
  };
}
