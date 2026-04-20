export type CreditPullMode = 'sandbox' | 'production';

export type TestBorrower = {
  firstName: string;
  lastName: string;
  ssnLast4?: string;
  dob?: string;
};

export type CreditBorrowerInput = {
  firstName?: unknown;
  lastName?: unknown;
  ssn?: unknown;
  ssnLast4?: unknown;
  dob?: unknown;
};

export type CreditLiability = {
  id: string;
  borrowerType: 'borrower' | 'coborrower' | 'joint';
  creditor: string;
  accountType: 'mortgage' | 'installment' | 'revolving';
  balance: number;
  monthlyPayment: number;
  openDate: string;
  propertyAddress?: string | null;
};

export type MockCreditPullResponse = {
  success: true;
  mode: 'sandbox';
  provider: string;
  reportId: string;
  inquiry: {
    type: 'sandbox-soft-pull';
    billable: false;
  };
  borrower: {
    firstName: string;
    lastName: string;
    dob?: string;
    ssnLast4?: string;
  };
  coborrower?: {
    firstName: string;
    lastName: string;
    dob?: string;
    ssnLast4?: string;
  };
  scores: {
    experian: number;
    equifax: number;
    transunion: number;
    representative: number;
  };
  liabilities: CreditLiability[];
  mortgages: Array<{
    id: string;
    borrowerType: 'borrower' | 'coborrower' | 'joint';
    lender: string;
    balance: number;
    monthlyPayment: number;
    accountType: string;
    openDate: string;
    propertyAddress?: string | null;
  }>;
  summary: {
    totalMonthlyDebt: number;
    totalMortgageDebt: number;
    liabilityCount: number;
    mortgageCount: number;
  };
};

export const APPROVED_TEST_BORROWERS: TestBorrower[] = [
  { firstName: 'Test', lastName: 'Borrower', ssnLast4: '0000' },
  { firstName: 'Credit', lastName: 'Tester', ssnLast4: '1234' },
  { firstName: 'Sandbox', lastName: 'User', ssnLast4: '9999' },
];

export function getCreditPullMode(): CreditPullMode {
  const mode = (process.env.CREDIT_API_MODE || 'sandbox').toLowerCase();
  if (mode === 'production') return 'production';
  return 'sandbox';
}

export function assertSandboxOnly() {
  const mode = getCreditPullMode();
  if (mode !== 'sandbox') {
    throw new Error('Credit API production mode is blocked in this route. Use sandbox/test mode only.');
  }
}

export function normalize(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function getDigits(value: unknown): string {
  return String(value || '').replace(/\D/g, '');
}

export function getSsnLast4(input: { ssn?: unknown; ssnLast4?: unknown }) {
  const explicit = getDigits(input.ssnLast4);
  if (explicit) return explicit.slice(-4);
  return getDigits(input.ssn).slice(-4);
}

export function sanitizeBorrower(input: CreditBorrowerInput) {
  return {
    firstName: String(input.firstName || '').trim(),
    lastName: String(input.lastName || '').trim(),
    dob: String(input.dob || '').trim() || undefined,
    ssnLast4: getSsnLast4(input) || undefined,
  };
}

export function isApprovedTestBorrower(input: CreditBorrowerInput) {
  const firstName = normalize(input.firstName);
  const lastName = normalize(input.lastName);
  const ssnLast4 = normalize(getSsnLast4(input));

  return APPROVED_TEST_BORROWERS.some((borrower) => {
    return (
      normalize(borrower.firstName) === firstName &&
      normalize(borrower.lastName) === lastName &&
      (!borrower.ssnLast4 || borrower.ssnLast4 === ssnLast4)
    );
  });
}

export function assertApprovedTestBorrower(input: CreditBorrowerInput) {
  if (!isApprovedTestBorrower(input)) {
    throw new Error('Borrower is not an approved test identity. Real consumer pulls are blocked.');
  }
}

export function buildMockCreditResponse(input: {
  borrower: CreditBorrowerInput;
  coborrower?: CreditBorrowerInput;
}): MockCreditPullResponse {
  const borrower = sanitizeBorrower(input.borrower);
  const coborrower = input.coborrower ? sanitizeBorrower(input.coborrower) : undefined;

  const liabilities: CreditLiability[] = [
    {
      id: 'mtg-1',
      borrowerType: 'borrower',
      creditor: 'WELLS FARGO HOME MORTGAGE',
      accountType: 'mortgage',
      balance: 325000,
      monthlyPayment: 2100,
      openDate: '2019-06-15',
      propertyAddress: null,
    },
    {
      id: 'mtg-2',
      borrowerType: coborrower ? 'joint' : 'borrower',
      creditor: 'PENNYMAC HOME EQUITY',
      accountType: 'mortgage',
      balance: 48000,
      monthlyPayment: 450,
      openDate: '2022-03-01',
      propertyAddress: null,
    },
    {
      id: 'auto-1',
      borrowerType: 'borrower',
      creditor: 'TEST AUTO LOAN',
      accountType: 'installment',
      balance: 18450,
      monthlyPayment: 425,
      openDate: '2021-08-10',
      propertyAddress: null,
    },
    {
      id: 'card-1',
      borrowerType: coborrower ? 'coborrower' : 'borrower',
      creditor: 'TEST CREDIT CARD',
      accountType: 'revolving',
      balance: 2100,
      monthlyPayment: 65,
      openDate: '2023-01-05',
      propertyAddress: null,
    },
  ];

  const mortgages = liabilities
    .filter((item) => item.accountType === 'mortgage')
    .map((item) => ({
      id: item.id,
      borrowerType: item.borrowerType,
      lender: item.creditor,
      balance: item.balance,
      monthlyPayment: item.monthlyPayment,
      accountType: item.accountType === 'mortgage' ? 'Mortgage' : item.accountType,
      openDate: item.openDate,
      propertyAddress: item.propertyAddress ?? null,
    }));

  const totalMonthlyDebt = liabilities.reduce((sum, item) => sum + item.monthlyPayment, 0);
  const totalMortgageDebt = mortgages.reduce((sum, item) => sum + item.monthlyPayment, 0);

  return {
    success: true,
    mode: 'sandbox',
    provider: process.env.CREDIT_API_PROVIDER || 'mock',
    reportId: `test-${Date.now()}`,
    inquiry: {
      type: 'sandbox-soft-pull',
      billable: false,
    },
    borrower,
    ...(coborrower?.firstName && coborrower?.lastName ? { coborrower } : {}),
    scores: {
      experian: 742,
      equifax: 738,
      transunion: 745,
      representative: 742,
    },
    liabilities,
    mortgages,
    summary: {
      totalMonthlyDebt,
      totalMortgageDebt,
      liabilityCount: liabilities.length,
      mortgageCount: mortgages.length,
    },
  };
}
