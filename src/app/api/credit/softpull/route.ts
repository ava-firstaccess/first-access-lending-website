import { NextRequest, NextResponse } from 'next/server';
import {
  APPROVED_TEST_BORROWERS,
  assertApprovedTestBorrower,
  buildMockCreditResponse,
  getCreditPullMode,
  getSsnLast4,
} from '@/lib/credit';
import {
  MERIDIANLINK_APPROVED_PROD_TEST,
  assertApprovedProdTestBorrower,
  submitMeridianLinkProdTest,
} from '@/lib/meridianlink-credit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const requestedMode = String(body?.mode || '').toLowerCase();
    const borrower = body?.borrower || {};
    const coborrower = body?.coborrower || null;
    const provider = (process.env.CREDIT_API_PROVIDER || 'mock').toLowerCase();

    if (!borrower?.firstName || !borrower?.lastName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Borrower firstName and lastName are required.',
        },
        { status: 400 }
      );
    }

    if (requestedMode === 'production-test') {
      if (provider !== 'meridianlink') {
        return NextResponse.json(
          {
            success: false,
            error: 'Production-test mode requires CREDIT_API_PROVIDER=meridianlink.',
          },
          { status: 400 }
        );
      }

      assertApprovedProdTestBorrower({
        firstName: borrower.firstName,
        lastName: borrower.lastName,
        middleName: borrower.middleName,
        suffixName: borrower.suffixName,
        dob: borrower.dob,
        ssn: borrower.ssn,
        ssnLast4: borrower.ssnLast4,
        address: borrower.address,
        city: borrower.city,
        state: borrower.state,
        zip: borrower.zip,
        preferredResponseFormat: borrower.preferredResponseFormat,
      });

      const result = await submitMeridianLinkProdTest({
        firstName: borrower.firstName,
        lastName: borrower.lastName,
        middleName: borrower.middleName,
        suffixName: borrower.suffixName,
        dob: borrower.dob,
        ssn: borrower.ssn,
        ssnLast4: borrower.ssnLast4,
        address: borrower.address,
        city: borrower.city,
        state: borrower.state,
        zip: borrower.zip,
        preferredResponseFormat: borrower.preferredResponseFormat,
      });

      return NextResponse.json({
        ...result,
        approvedProdTestBorrower: {
          firstName: MERIDIANLINK_APPROVED_PROD_TEST.firstName,
          lastName: MERIDIANLINK_APPROVED_PROD_TEST.lastName,
          ssn: MERIDIANLINK_APPROVED_PROD_TEST.ssn,
        },
      });
    }

    if (requestedMode && requestedMode !== 'sandbox' && requestedMode !== 'test') {
      return NextResponse.json(
        {
          success: false,
          error: 'Only sandbox/test mode is allowed for this endpoint unless mode=production-test is explicitly used.',
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

    if (provider !== 'mock') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Sandbox route is scaffolded, but the external credit provider is not wired for sandbox mode. Keep CREDIT_API_PROVIDER=mock for sandbox UI tests, or use mode=production-test with CREDIT_API_PROVIDER=meridianlink for the approved prod test file.',
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
    sandboxOnly: (process.env.CREDIT_API_PROVIDER || 'mock').toLowerCase() === 'mock',
    supportedModes: ['sandbox', 'test', 'production-test'],
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
    approvedProdTestBorrower: {
      firstName: MERIDIANLINK_APPROVED_PROD_TEST.firstName,
      lastName: MERIDIANLINK_APPROVED_PROD_TEST.lastName,
      middleName: MERIDIANLINK_APPROVED_PROD_TEST.middleName,
      suffixName: MERIDIANLINK_APPROVED_PROD_TEST.suffixName,
      dob: MERIDIANLINK_APPROVED_PROD_TEST.dob,
      ssn: MERIDIANLINK_APPROVED_PROD_TEST.ssn,
      address: MERIDIANLINK_APPROVED_PROD_TEST.address,
      city: MERIDIANLINK_APPROVED_PROD_TEST.city,
      state: MERIDIANLINK_APPROVED_PROD_TEST.state,
      zip: MERIDIANLINK_APPROVED_PROD_TEST.zip,
      preferredResponseFormat: MERIDIANLINK_APPROVED_PROD_TEST.preferredResponseFormat,
      routeMode: 'production-test',
      provider: 'meridianlink',
    },
    message:
      'Use POST /api/credit/softpull with sandbox/test mode for mock responses, or mode=production-test with the approved MeridianLink prod test borrower only.',
  });
}
