import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedApplication, requireTrustedBrowserRequest } from '@/lib/application-session';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';
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
  scrubMeridianLinkXml,
  submitMeridianLinkProdTest,
} from '@/lib/meridianlink-credit';

const SOFTPULL_IP_LIMIT = 10;
const SOFTPULL_SESSION_LIMIT = 5;
const SOFTPULL_WINDOW_SECONDS = 10 * 60;

export async function POST(req: NextRequest) {
  try {
    const trusted = requireTrustedBrowserRequest(req);
    if (trusted) return trusted;

    const body = await req.json();
    const requestedMode = String(body?.mode || '').toLowerCase();
    const borrower = body?.borrower || {};
    const coborrower = body?.coborrower || null;
    const provider = (process.env.CREDIT_API_PROVIDER || 'mock').toLowerCase();
    const clientIp = getClientIp(req);

    let applicationId: string | null = null;
    let supabase = getSupabaseAdmin();

    if (requestedMode !== 'production-test') {
      const auth = await getAuthenticatedApplication(req, 'id, session_expires_at');
      if ('response' in auth) return auth.response;
      applicationId = typeof auth.app.id === 'string' ? auth.app.id : null;
      supabase = auth.supabase;
    }

    const [ipRate, sessionRate] = await Promise.all([
      consumeRateLimit({
        scope: 'softpull:ip',
        key: clientIp,
        limit: SOFTPULL_IP_LIMIT,
        windowSeconds: SOFTPULL_WINDOW_SECONDS,
      }),
      consumeRateLimit({
        scope: requestedMode === 'production-test' ? 'softpull:prodtest' : 'softpull:session',
        key: applicationId || clientIp,
        limit: SOFTPULL_SESSION_LIMIT,
        windowSeconds: SOFTPULL_WINDOW_SECONDS,
      }),
    ]);

    if (!ipRate.allowed || !sessionRate.allowed) {
      const retryAfterSeconds = Math.max(ipRate.retryAfterSeconds, sessionRate.retryAfterSeconds);
      return NextResponse.json(
        {
          success: false,
          error: 'Too many soft credit pull attempts. Please wait and try again.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
          },
        }
      );
    }

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

      const runId = randomUUID();

      const showXmlPreview = process.env.MERIDIANLINK_PROXY_DEBUG === 'true' && process.env.NODE_ENV !== 'production';
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
        borrower_file_number: null,
        approved_borrower_file_number: null,
        success: false,
      };

      try {
        const { error: insertError } = await supabase.from('meridianlink_runs').insert(baseRunPayload);
        if (insertError) {
          console.warn('meridianlink_runs attempt insert failed');
        }
      } catch (logError) {
        console.warn('meridianlink_runs attempt insert threw');
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
          error_category: result.reportReady ? (result.debug?.errorCategory || null) : 'no_credit_data_returned',
          borrower_file_number: result.fileNumber || null,
          approved_borrower_file_number: result.fileNumber || null,
          success: result.success,
          notes: result.reportStatusMessage || null,
        };

        try {
          const { error: updateError } = await supabase.from('meridianlink_runs').update(successPayload).eq('run_id', runId);
          if (updateError) {
            console.warn('meridianlink_runs success update failed');
          }
        } catch (logError) {
          console.warn('meridianlink_runs success update threw');
        }

        const scrubbedResponseXml = scrubMeridianLinkXml(result.rawResponse);

        if (!result.reportReady) {
          return NextResponse.json(
            {
              success: false,
              runId,
              application_id: applicationId,
              provider: result.provider,
              mode: result.mode,
              requestType: result.requestType,
              status: result.status,
              vendorOrderIdentifier: result.vendorOrderIdentifier,
              fileNumber: result.fileNumber || null,
              error: result.reportStatusMessage || 'Credit report data was not ready yet.',
              borrower: {
                firstName: borrower.firstName,
                lastName: borrower.lastName,
                middleName: borrower.middleName || null,
                suffixName: borrower.suffixName || null,
              },
              reportReady: false,
              reportStatusMessage: result.reportStatusMessage,
              responseSummary: {
                creditFileCount: result.debug?.creditFileCount ?? 0,
                creditScoreCount: result.debug?.creditScoreCount ?? 0,
                creditLiabilityCount: result.debug?.creditLiabilityCount ?? 0,
                hasVendorOrderIdentifier: Boolean(result.debug?.hasVendorOrderIdentifier),
              },
              ...(showXmlPreview ? { responseXmlSnippet: scrubbedResponseXml.slice(0, 350) } : {}),
              applicationId,
            },
            { status: 202 }
          );
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
          borrower: {
            firstName: borrower.firstName,
            lastName: borrower.lastName,
            middleName: borrower.middleName || null,
            suffixName: borrower.suffixName || null,
          },
          reportReady: result.reportReady,
          reportStatusMessage: result.reportStatusMessage,
          responseSummary: {
            creditFileCount: result.debug?.creditFileCount ?? 0,
            creditScoreCount: result.debug?.creditScoreCount ?? 0,
            creditLiabilityCount: result.debug?.creditLiabilityCount ?? 0,
            hasVendorOrderIdentifier: Boolean(result.debug?.hasVendorOrderIdentifier),
          },
          responseXml: scrubbedResponseXml,
          ...(showXmlPreview ? { responseXmlSnippet: scrubbedResponseXml.slice(0, 350) } : {}),
          applicationId,
        });
      } catch (error) {
        const failurePayload = {
          ...baseRunPayload,
          status: 'failed',
          error_category: 'request_failed',
          success: false,
        };
        try {
          const { error: updateError } = await supabase.from('meridianlink_runs').update(failurePayload).eq('run_id', runId);
          if (updateError) {
            console.warn('meridianlink_runs failure update failed');
          }
        } catch (logError) {
          console.warn('meridianlink_runs failure update threw');
        }
        return NextResponse.json(
          {
            success: false,
            runId,
            application_id: applicationId,
            error: 'Credit pull failed',
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
    console.error('Softpull route error');
    return NextResponse.json(
      {
        success: false,
        mode: getCreditPullMode(),
        error: 'Credit pull failed',
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
    productionTestAccess: {
      provider: 'meridianlink',
      routeMode: 'production-test',
      restricted: false,
      note: 'Production-test mode is available as a MeridianLink XML test harness and accepts test borrower values entered in the UI.',
    },
    message:
      'Use POST /api/credit/softpull with sandbox/test mode for mock responses. Production-test mode can be used as a MeridianLink XML test harness when CREDIT_API_PROVIDER=meridianlink.',
  });
}
