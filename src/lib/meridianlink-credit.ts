import { execFileSync } from 'child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

export const MERIDIANLINK_APPROVED_PROD_TEST = {
  firstName: 'Bill',
  lastName: 'Testcase',
  middleName: 'C',
  suffixName: 'JR',
  dob: '',
  ssn: '000000015',
  address: '8842 48th Ave',
  city: 'Anthill',
  state: 'MO',
  zip: '65488',
  preferredResponseFormat: 'Xml',
  fileNumber: '6402787',
};

export type MeridianLinkProdTestBorrowerInput = {
  firstName?: unknown;
  lastName?: unknown;
  middleName?: unknown;
  suffixName?: unknown;
  dob?: unknown;
  ssn?: unknown;
  ssnLast4?: unknown;
  address?: unknown;
  city?: unknown;
  state?: unknown;
  zip?: unknown;
  preferredResponseFormat?: unknown;
  fileNumber?: unknown;
};

function sanitizeProdTestBorrower(input: MeridianLinkProdTestBorrowerInput = {}) {
  return {
    firstName: String(input.firstName || MERIDIANLINK_APPROVED_PROD_TEST.firstName).trim(),
    lastName: String(input.lastName || MERIDIANLINK_APPROVED_PROD_TEST.lastName).trim(),
    middleName: String(input.middleName || MERIDIANLINK_APPROVED_PROD_TEST.middleName).trim(),
    suffixName: String(input.suffixName || MERIDIANLINK_APPROVED_PROD_TEST.suffixName).trim(),
    dob: String(input.dob || MERIDIANLINK_APPROVED_PROD_TEST.dob).trim(),
    ssn: String(input.ssn || input.ssnLast4 || MERIDIANLINK_APPROVED_PROD_TEST.ssn).replace(/\D/g, ''),
    address: String(input.address || MERIDIANLINK_APPROVED_PROD_TEST.address).trim(),
    city: String(input.city || MERIDIANLINK_APPROVED_PROD_TEST.city).trim(),
    state: String(input.state || MERIDIANLINK_APPROVED_PROD_TEST.state).trim(),
    zip: String(input.zip || MERIDIANLINK_APPROVED_PROD_TEST.zip).trim(),
    preferredResponseFormat:
      String(input.preferredResponseFormat || MERIDIANLINK_APPROVED_PROD_TEST.preferredResponseFormat).trim() ||
      'Html',
  };
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function maskSsnLikeValue(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '***-**-****';
  return `***-**-${digits.slice(-4)}`;
}

export function scrubMeridianLinkXml(xml: string) {
  return xml
    .replace(
      /(<TaxpayerIdentifierValue>)([\s\S]*?)(<\/TaxpayerIdentifierValue>)/gi,
      (_, open, value, close) => `${open}${maskSsnLikeValue(String(value))}${close}`
    )
    .replace(
      /(<SocialSecurityNumber>([\s\S]*?)<\/SocialSecurityNumber>)/gi,
      (match) => match.replace(/>([\s\S]*?)</, (_, value) => `>${maskSsnLikeValue(String(value))}<`)
    )
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, (value) => maskSsnLikeValue(value));
}

function getSecretFromKeychain(label: string) {
  return execFileSync('security', ['find-generic-password', '-a', 'ava', '-s', label, '-w'], {
    encoding: 'utf8',
  }).trim();
}

function getSecretFromFile(filePath: string) {
  return fs.readFileSync(filePath, 'utf8').trim();
}

function getSecret(name: string, fallbackLabel: string) {
  const filePath = process.env[`${name}_FILE`] || '';
  if (filePath) return getSecretFromFile(filePath);
  const envValue = process.env[name] || '';
  if (envValue) return envValue;
  if (process.platform === 'darwin') return getSecretFromKeychain(fallbackLabel);
  throw new Error(`Missing ${name}. Set ${name} or ${name}_FILE.`);
}

function shouldLogMeridianLinkDebug() {
  return process.env.MERIDIANLINK_PROXY_DEBUG === 'true';
}

function logMeridianLinkDebug(event: string, details: Record<string, unknown>) {
  if (!shouldLogMeridianLinkDebug()) return;
  console.info(
    JSON.stringify(
      {
        scope: 'meridianlink-prod-test',
        event,
        ...details,
      },
      null,
      0
    )
  );
}

export function getMeridianLinkConfig() {
  const proxyUrl =
    process.env.BIRCHWOOD_CREDIT_PROXY_URL ||
    process.env.MERIDIANLINK_PROXY_URL ||
    'https://api.firstaccesslending.com/meridianlink/prod-test';
  const proxyAuthHeader = process.env.MERIDIANLINK_PROXY_AUTH_HEADER || 'X-MeridianLink-Proxy-Auth';
  const proxyAuthToken = process.env.MERIDIANLINK_PROXY_AUTH_TOKEN || '';
  const interfaceId = process.env.BIRCHWOOD_CREDIT_INTERFACE || 'FirstAccess040926';
  const clientIdentifierHeader = process.env.BIRCHWOOD_CREDIT_CLIENT_IDENTIFIER_HEADER || 'Client-Identifier';
  const clientIdentifier = process.env.BIRCHWOOD_CREDIT_CLIENT_IDENTIFIER || 'B0';
  const proxyCaCertB64 = process.env.MERIDIANLINK_PROXY_CA_CERT_B64 || '';
  const shouldUseProxy = Boolean(proxyUrl);
  const username = getSecret(
    'BIRCHWOOD_CREDIT_USERNAME',
    process.env.BIRCHWOOD_CREDIT_USERNAME_KEYCHAIN_LABEL || 'birchwood-credit-username'
  );
  const passwordFile = process.env.BIRCHWOOD_CREDIT_PASSWORD_FILE || process.env.MERIDIANLINK_PASSWORD_FILE || '';
  const password =
    (passwordFile ? getSecretFromFile(passwordFile) : '') ||
    getSecret(
      'BIRCHWOOD_CREDIT_PASSWORD',
      process.env.BIRCHWOOD_CREDIT_PASSWORD_KEYCHAIN_LABEL || 'birchwood-credit-password'
    );

  return {
    proxyUrl,
    proxyAuthHeader,
    proxyAuthToken,
    interfaceId,
    clientIdentifierHeader,
    clientIdentifier,
    proxyCaCertB64,
    username,
    password,
  };
}

export function assertApprovedProdTestBorrower(input: MeridianLinkProdTestBorrowerInput) {
  const borrower = sanitizeProdTestBorrower(input);
  const firstName = borrower.firstName.toLowerCase();
  const lastName = borrower.lastName.toLowerCase();
  const ssnDigits = borrower.ssn;

  if (
    firstName !== MERIDIANLINK_APPROVED_PROD_TEST.firstName.toLowerCase() ||
    lastName !== MERIDIANLINK_APPROVED_PROD_TEST.lastName.toLowerCase() ||
    ssnDigits !== MERIDIANLINK_APPROVED_PROD_TEST.ssn
  ) {
    throw new Error('Production MeridianLink access is locked to the approved vendor test file only.');
  }
}

export function buildMeridianLinkSubmitXml(input: MeridianLinkProdTestBorrowerInput = {}) {
  const t = sanitizeProdTestBorrower(input);

  return `<?xml version="1.0" encoding="utf-8"?>
<MESSAGE xmlns="http://www.mismo.org/residential/2009/schemas" xmlns:p2="http://www.w3.org/1999/xlink" xmlns:p3="inetapi/MISMO3_4_MCL_Extension.xsd" MessageType="Request">
  <ABOUT_VERSIONS>
    <ABOUT_VERSION>
      <DataVersionIdentifier>201703</DataVersionIdentifier>
    </ABOUT_VERSION>
  </ABOUT_VERSIONS>
  <DEAL_SETS>
    <DEAL_SET>
      <DEALS>
        <DEAL>
          <PARTIES>
            <PARTY p2:label="Party1">
              <INDIVIDUAL>
                <NAME>
                  <FirstName>${xmlEscape(t.firstName)}</FirstName>
                  <LastName>${xmlEscape(t.lastName)}</LastName>
                  <MiddleName>${xmlEscape(t.middleName)}</MiddleName>
                  <SuffixName>${xmlEscape(t.suffixName)}</SuffixName>
                </NAME>
              </INDIVIDUAL>
              <ROLES>
                <ROLE>
                  <BORROWER>
                    <RESIDENCES>
                      <RESIDENCE>
                        <ADDRESS>
                          <AddressLineText>${xmlEscape(t.address)}</AddressLineText>
                          <CityName>${xmlEscape(t.city)}</CityName>
                          <CountryCode>US</CountryCode>
                          <PostalCode>${xmlEscape(t.zip)}</PostalCode>
                          <StateCode>${xmlEscape(t.state)}</StateCode>
                        </ADDRESS>
                        <RESIDENCE_DETAIL>
                          <BorrowerResidencyType>Current</BorrowerResidencyType>
                        </RESIDENCE_DETAIL>
                      </RESIDENCE>
                    </RESIDENCES>
                  </BORROWER>
                  <ROLE_DETAIL>
                    <PartyRoleType>Borrower</PartyRoleType>
                  </ROLE_DETAIL>
                </ROLE>
              </ROLES>
              <TAXPAYER_IDENTIFIERS>
                <TAXPAYER_IDENTIFIER>
                  <TaxpayerIdentifierType>SocialSecurityNumber</TaxpayerIdentifierType>
                  <TaxpayerIdentifierValue>${t.ssn}</TaxpayerIdentifierValue>
                </TAXPAYER_IDENTIFIER>
              </TAXPAYER_IDENTIFIERS>
            </PARTY>
          </PARTIES>
          <RELATIONSHIPS>
            <RELATIONSHIP p2:arcrole="urn:fdc:Meridianlink.com:2017:mortgage/PARTY_IsVerifiedBy_SERVICE" p2:from="Party1" p2:to="Service1"/>
          </RELATIONSHIPS>
          <SERVICES>
            <SERVICE p2:label="Service1">
              <CREDIT>
                <CREDIT_REQUEST>
                  <CREDIT_REQUEST_DATAS>
                    <CREDIT_REQUEST_DATA>
                      <CREDIT_REPOSITORY_INCLUDED>
                        <CreditRepositoryIncludedEquifaxIndicator>true</CreditRepositoryIncludedEquifaxIndicator>
                        <CreditRepositoryIncludedExperianIndicator>true</CreditRepositoryIncludedExperianIndicator>
                        <CreditRepositoryIncludedTransUnionIndicator>true</CreditRepositoryIncludedTransUnionIndicator>
                        <EXTENSION>
                          <OTHER>
                            <p3:RequestEquifaxScore>true</p3:RequestEquifaxScore>
                            <p3:RequestExperianFraud>true</p3:RequestExperianFraud>
                            <p3:RequestExperianScore>true</p3:RequestExperianScore>
                            <p3:RequestTransUnionFraud>true</p3:RequestTransUnionFraud>
                            <p3:RequestTransUnionScore>true</p3:RequestTransUnionScore>
                          </OTHER>
                        </EXTENSION>
                      </CREDIT_REPOSITORY_INCLUDED>
                      <CREDIT_REQUEST_DATA_DETAIL>
                        <CreditReportRequestActionType>Submit</CreditReportRequestActionType>
                      </CREDIT_REQUEST_DATA_DETAIL>
                    </CREDIT_REQUEST_DATA>
                  </CREDIT_REQUEST_DATAS>
                </CREDIT_REQUEST>
              </CREDIT>
              <SERVICE_PRODUCT>
                <SERVICE_PRODUCT_REQUEST>
                  <SERVICE_PRODUCT_DETAIL>
                    <ServiceProductDescription>CreditOrder</ServiceProductDescription>
                    <EXTENSION>
                      <OTHER>
                        <p3:SERVICE_PREFERRED_RESPONSE_FORMATS>
                          <p3:SERVICE_PREFERRED_RESPONSE_FORMAT>
                            <p3:SERVICE_PREFERRED_RESPONSE_FORMAT_DETAIL>
                              <p3:PreferredResponseFormatType>${t.preferredResponseFormat}</p3:PreferredResponseFormatType>
                            </p3:SERVICE_PREFERRED_RESPONSE_FORMAT_DETAIL>
                          </p3:SERVICE_PREFERRED_RESPONSE_FORMAT>
                        </p3:SERVICE_PREFERRED_RESPONSE_FORMATS>
                      </OTHER>
                    </EXTENSION>
                  </SERVICE_PRODUCT_DETAIL>
                </SERVICE_PRODUCT_REQUEST>
              </SERVICE_PRODUCT>
            </SERVICE>
          </SERVICES>
        </DEAL>
      </DEALS>
    </DEAL_SET>
  </DEAL_SETS>
</MESSAGE>`;
}

function getFirstMatch(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i'));
  return match ? match[1].trim() : null;
}

function getMeridianLinkFileNumber(xml: string) {
  return getFirstMatch(xml, 'VendorOrderIdentifier');
}

function countTagMatches(xml: string, tagName: string) {
  const matches = xml.match(new RegExp(`<${tagName}(?:\s|>)`, 'gi'));
  return matches ? matches.length : 0;
}

function postXml(endpointUrl: string, headers: Record<string, string>, body: string, caCertPem = '') {
  return new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
    const url = new URL(endpointUrl);
    const client = url.protocol === 'https:' ? https : http;

    const request = client.request(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
        path: `${url.pathname}${url.search}`,
        headers,
        ...(caCertPem ? { ca: caCertPem, servername: url.hostname } : {}),
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode || 0,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );

    request.setTimeout(120000, () => {
      request.destroy(new Error('MeridianLink proxy request timed out'));
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

export async function submitMeridianLinkProdTest(input: MeridianLinkProdTestBorrowerInput = {}) {
  const config = getMeridianLinkConfig();
  const borrower = sanitizeProdTestBorrower(input);
  const xml = buildMeridianLinkSubmitXml(borrower);

  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  const endpointUrl = config.proxyUrl;
  const headers: Record<string, string> = {
    'Content-Type': 'application/xml',
    'MCL-Interface': config.interfaceId,
    [config.clientIdentifierHeader]: config.clientIdentifier,
  };

  if (config.proxyUrl) {
    if (!config.proxyAuthToken) {
      throw new Error('MERIDIANLINK_PROXY_AUTH_TOKEN is required when MERIDIANLINK_PROXY_URL is set.');
    }
    headers[config.proxyAuthHeader] = config.proxyAuthToken;
  } else {
    headers.Authorization = `Basic ${auth}`;
  }

  const response = await postXml(endpointUrl, headers, xml, config.proxyCaCertB64 ? Buffer.from(config.proxyCaCertB64, 'base64').toString('utf8') : '');
  const responseText = response.body;
  const creditFileCount = countTagMatches(responseText, 'CREDIT_FILE');
  const creditScoreCount = countTagMatches(responseText, 'CREDIT_SCORE');
  const creditLiabilityCount = countTagMatches(responseText, 'CREDIT_LIABILITY');
  const responseDebug = {
    endpointHost: new URL(endpointUrl).hostname,
    statusCode: response.statusCode,
    responseBytes: Buffer.byteLength(responseText, 'utf8'),
    hasVendorOrderIdentifier: Boolean(getFirstMatch(responseText, 'VendorOrderIdentifier')),
    vendorOrderIdentifier: getFirstMatch(responseText, 'VendorOrderIdentifier'),
    fileNumber: getMeridianLinkFileNumber(responseText),
    errorCategory: getFirstMatch(responseText, 'ErrorMessageCategoryCode'),
    errorMessage: getFirstMatch(responseText, 'ErrorMessageText'),
    creditFileCount,
    creditScoreCount,
    creditLiabilityCount,
    hasReportData: creditFileCount > 0 || creditScoreCount > 0 || creditLiabilityCount > 0,
  };

  logMeridianLinkDebug('response', responseDebug);

  if (response.statusCode < 200 || response.statusCode >= 300) {
    logMeridianLinkDebug('http_error', responseDebug);
    throw new Error(`MeridianLink submit failed (${response.statusCode}).`);
  }

  const errorCategory = getFirstMatch(responseText, 'ErrorMessageCategoryCode');
  const errorMessage = getFirstMatch(responseText, 'ErrorMessageText');
  if (errorCategory || errorMessage) {
    logMeridianLinkDebug('provider_error', responseDebug);
    throw new Error('MeridianLink provider error.');
  }

  logMeridianLinkDebug(responseDebug.hasReportData ? 'success' : 'saved_without_report_data', responseDebug);

  return {
    success: responseDebug.hasReportData as boolean,
    provider: 'meridianlink',
    mode: 'production-test' as const,
    requestType: 'Submit',
    borrower,
    vendorOrderIdentifier: getFirstMatch(responseText, 'VendorOrderIdentifier'),
    fileNumber: responseDebug.fileNumber,
    status: responseDebug.hasReportData
      ? getFirstMatch(responseText, 'CreditReportRequestActionType') || 'Submit'
      : 'saved_not_completed',
    rawResponse: responseText,
    debug: responseDebug,
    reportReady: responseDebug.hasReportData,
    reportStatusMessage: responseDebug.hasReportData
      ? 'Credit report data returned.'
      : 'MeridianLink saved the order but did not return populated credit report data.',
  };
}
