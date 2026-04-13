export type CreditPullMode = 'sandbox' | 'production';

export type TestBorrower = {
  firstName: string;
  lastName: string;
  ssnLast4?: string;
  dob?: string;
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

export function isApprovedTestBorrower(input: {
  firstName?: unknown;
  lastName?: unknown;
  ssn?: unknown;
  ssnLast4?: unknown;
}) {
  const firstName = normalize(input.firstName);
  const lastName = normalize(input.lastName);
  const ssnDigits = String(input.ssn || '').replace(/\D/g, '');
  const ssnLast4 = normalize(input.ssnLast4 || ssnDigits.slice(-4));

  return APPROVED_TEST_BORROWERS.some((borrower) => {
    return (
      normalize(borrower.firstName) === firstName &&
      normalize(borrower.lastName) === lastName &&
      (!borrower.ssnLast4 || borrower.ssnLast4 === ssnLast4)
    );
  });
}

export function assertApprovedTestBorrower(input: {
  firstName?: unknown;
  lastName?: unknown;
  ssn?: unknown;
  ssnLast4?: unknown;
}) {
  if (!isApprovedTestBorrower(input)) {
    throw new Error('Borrower is not an approved test identity. Real consumer pulls are blocked.');
  }
}

export function buildMockCreditResponse(input: Record<string, unknown>) {
  return {
    success: true,
    mode: 'sandbox',
    provider: process.env.CREDIT_API_PROVIDER || 'mock',
    reportId: `test-${Date.now()}`,
    borrower: {
      firstName: input.firstName,
      lastName: input.lastName,
    },
    scores: {
      experian: 742,
      equifax: 738,
      transunion: 745,
      representative: 742,
    },
    liabilities: [
      {
        creditor: 'TEST AUTO LOAN',
        monthlyPayment: 425,
        balance: 18450,
        accountType: 'installment',
      },
      {
        creditor: 'TEST CREDIT CARD',
        monthlyPayment: 65,
        balance: 2100,
        accountType: 'revolving',
      },
    ],
    inquiry: {
      type: 'sandbox-soft-pull',
      billable: false,
    },
  };
}
