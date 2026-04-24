import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
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

      const runId = randomUUID();
      const supabase = getSupabaseAdmin();
      const sessionToken = req.cookies.get('session_token')?.value;
      let applicationId: string | null = null;
      if (sessionToken) {
        const { data: app } = await supabase
          .from('applications')
          .select('id')
          .eq('session_token', sessionToken)
          .single();
        applicationId = app?.id || null;
      }

      const showXmlPreview = process.env.MERIDIANLINK_PROXY_DEBUG === 'true' || process.env.NODE_ENV !== 'production';
      const endpointHost = new URL(
        process.env.BIRCHWOOD_CREDIT_PROXY_URL || process.env.MERIDIANLINK_PROXY_URL || 'https://api.firstaccesslending.com/meridianlink/prod-test'
      ).hostname;
      const baseRunPayload = {
        run_id: runId,
        mode: 'production-test',
        application_id: applicationId,
        provider,
        request_type: 'Submit',
        endpoint_host: endpointHost,
        status_code: null,
        status: 'started',
        vendor_order_identifier: null,
        has_vendor_order_identifier: false,
        response_bytes: 0,
        error_category: null,
        error_message: null,
        borrower_first_name: borrower.firstName,
        borrower_last_name: borrower.lastName,
        borrower_file_number: null,
        approved_borrower_first_name: MERIDIANLINK_APPROVED_PROD_TEST.firstName,
        approved_borrower_last_name: MERIDIANLINK_APPROVED_PROD_TEST.lastName,
        approved_borrower_file_number: null,
        success: false,
      };

      try {
        await supabase.from('meridianlink_runs').insert(baseRunPayload);
      } catch (logError) {
        console.warn('meridianlink_runs attempt insert threw:', logError instanceof Error ? logError.message : logError);
      }

      try {
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

        const successPayload = {
          ...baseRunPayload,
          mode: result.mode,
          provider: result.provider,
          request_type: result.requestType,
          endpoint_host: result.debug?.endpointHost || endpointHost,
          status_code: result.debug?.statusCode ?? null,
          status: result.status,
          vendor_order_identifier: result.vendorOrderIdentifier || null,
          has_vendor_order_identifier: Boolean(result.debug?.hasVendorOrderIdentifier),
          response_bytes: result.debug?.responseBytes ?? 0,
          error_category: result.debug?.errorCategory || null,
          error_message: result.debug?.errorMessage || null,
          borrower_file_number: result.fileNumber || null,
          approved_borrower_file_number: result.fileNumber || null,
          success: result.success,
        };

        try {
          const { error: updateError } = await supabase.from('meridianlink_runs').update(successPayload).eq('run_id', runId);
          if (updateError) {
            console.warn('meridianlink_runs success update failed:', updateError.message);
          }
        } catch (logError) {
          console.warn('meridianlink_runs success update threw:', logError instanceof Error ? logError.message : logError);
        }

        return NextResponse.json({
          runId,
          success: result.success,
          application_id: applicationId,
          provider: result.provider,
          mode: result.mode,
          requestType: result.requestType,
          status: result.status,
          vendorOrderIdentifier: result.vendorOrderIdentifier,
          fileNumber: result.fileNumber || null,
          ...(showXmlPreview ? { responseXmlSnippet: result.rawResponse.slice(0, 350) } : {}),
          borrower: {
            firstName: result.borrower.firstName,
            lastName: result.borrower.lastName,
            middleName: result.borrower.middleName,
            suffixName: result.borrower.suffixName,
            address: result.borrower.address,
            city: result.borrower.city,
            state: result.borrower.state,
            zip: result.borrower.zip,
            preferredResponseFormat: result.borrower.preferredResponseFormat,
          },
          approvedProdTestBorrower: {
            firstName: MERIDIANLINK_APPROVED_PROD_TEST.firstName,
            lastName: MERIDIANLINK_APPROVED_PROD_TEST.lastName,
          },
          applicationId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown MeridianLink error';
        const failurePayload = {
          ...baseRunPayload,
          status: 'failed',
          error_message: message,
          success: false,
        };
        try {
          const { error: updateError } = await supabase.from('meridianlink_runs').update(failurePayload).eq('run_id', runId);
          if (updateError) {
            console.warn('meridianlink_runs failure update failed:', updateError.message);
          }
        } catch (logError) {
          console.warn('meridianlink_runs failure update threw:', logError instanceof Error ? logError.message : logError);
        }
        return NextResponse.json(
          {
            success: false,
            runId,
            application_id: applicationId,
            error: message,
          },
          { status: 400 }
        );
      }
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
      ssnLast4: MERIDIANLINK_APPROVED_PROD_TEST.ssn.slice(-4),
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
