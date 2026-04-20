import { NextRequest, NextResponse } from 'next/server';
import {
  APPROVED_TEST_BORROWERS,
  assertApprovedTestBorrower,
  assertSandboxOnly,
  buildMockCreditResponse,
  getCreditPullMode,
  getSsnLast4,
} from '@/lib/credit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    assertSandboxOnly();

    const requestedMode = String(body?.mode || '').toLowerCase();
    if (requestedMode && requestedMode !== 'sandbox' && requestedMode !== 'test') {
      return NextResponse.json(
        {
          success: false,
          error: 'Only sandbox/test mode is allowed for this endpoint.',
        },
        { status: 400 }
      );
    }

    const borrower = body?.borrower || {};
    const coborrower = body?.coborrower || null;

    if (!borrower?.firstName || !borrower?.lastName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Borrower firstName and lastName are required.',
        },
        { status: 400 }
      );
    }

    assertApprovedTestBorrower({
      firstName: borrower.firstName,
      lastName: borrower.lastName,
      ssn: borrower.ssn,
      ssnLast4: borrower.ssnLast4,
    });

    const provider = (process.env.CREDIT_API_PROVIDER || 'mock').toLowerCase();

    if (provider !== 'mock') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Sandbox route is scaffolded, but the external credit provider is not wired yet. Keep CREDIT_API_PROVIDER=mock until Birchwood sandbox docs/credentials are confirmed.',
          mode: getCreditPullMode(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ...buildMockCreditResponse({
        borrower,
        coborrower: coborrower?.firstName && coborrower?.lastName ? coborrower : undefined,
      }),
      approvedTestBorrowers: APPROVED_TEST_BORROWERS.map((item) => ({
        firstName: item.firstName,
        lastName: item.lastName,
        ssnLast4: item.ssnLast4,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        mode: getCreditPullMode(),
        error: error instanceof Error ? error.message : 'Unknown credit API error',
      },
      { status: 400 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    mode: getCreditPullMode(),
    provider: process.env.CREDIT_API_PROVIDER || 'mock',
    sandboxOnly: true,
    approvedTestBorrowers: APPROVED_TEST_BORROWERS.map((item) => ({
      firstName: item.firstName,
      lastName: item.lastName,
      ssnLast4: item.ssnLast4,
      exampleBorrower: {
        firstName: item.firstName,
        lastName: item.lastName,
        ssnLast4: getSsnLast4({ ssnLast4: item.ssnLast4 }),
      },
    })),
    message:
      'Use POST /api/credit/softpull with an approved test borrower only. Production pulls are blocked by default.',
  });
}
