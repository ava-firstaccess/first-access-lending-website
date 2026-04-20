import { execFileSync } from 'child_process';

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
  preferredResponseFormat: 'Html',
};

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getSecretFromKeychain(label: string) {
  return execFileSync('security', ['find-generic-password', '-a', 'ava', '-s', label, '-w'], {
    encoding: 'utf8',
  }).trim();
}

export function getMeridianLinkConfig() {
  const baseUrl =
    process.env.BIRCHWOOD_CREDIT_BASE_URL ||
    'https://birchwood.meridianlink.com/inetapi/request_products.aspx';
  const interfaceId = process.env.BIRCHWOOD_CREDIT_INTERFACE || 'FirstAccess040926';
  const username =
    process.env.BIRCHWOOD_CREDIT_USERNAME ||
    getSecretFromKeychain(process.env.BIRCHWOOD_CREDIT_USERNAME_KEYCHAIN_LABEL || 'birchwood-credit-username');
  const password =
    process.env.BIRCHWOOD_CREDIT_PASSWORD ||
    getSecretFromKeychain(process.env.BIRCHWOOD_CREDIT_PASSWORD_KEYCHAIN_LABEL || 'birchwood-credit-password');

  return {
    baseUrl,
    interfaceId,
    username,
    password,
  };
}

export function assertApprovedProdTestBorrower(input: {
  firstName?: unknown;
  lastName?: unknown;
  ssn?: unknown;
  ssnLast4?: unknown;
}) {
  const firstName = String(input.firstName || '').trim().toLowerCase();
  const lastName = String(input.lastName || '').trim().toLowerCase();
  const ssnDigits = String(input.ssn || input.ssnLast4 || '').replace(/\D/g, '');

  if (
    firstName !== MERIDIANLINK_APPROVED_PROD_TEST.firstName.toLowerCase() ||
    lastName !== MERIDIANLINK_APPROVED_PROD_TEST.lastName.toLowerCase() ||
    ssnDigits !== MERIDIANLINK_APPROVED_PROD_TEST.ssn
  ) {
    throw new Error('Production MeridianLink access is locked to the approved vendor test file only.');
  }
}

export function buildMeridianLinkSubmitXml() {
  const t = MERIDIANLINK_APPROVED_PROD_TEST;

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

export async function submitMeridianLinkProdTest() {
  const config = getMeridianLinkConfig();
  const xml = buildMeridianLinkSubmitXml();

  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/xml',
      'MCL-Interface': config.interfaceId,
    },
    body: xml,
    cache: 'no-store',
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`MeridianLink submit failed (${response.status}): ${responseText.slice(0, 500)}`);
  }

  return {
    success: true as const,
    provider: 'meridianlink',
    mode: 'production-test' as const,
    requestType: 'Submit',
    vendorOrderIdentifier: getFirstMatch(responseText, 'VendorOrderIdentifier'),
    status: getFirstMatch(responseText, 'CreditReportRequestActionType') || 'Submit',
    rawResponse: responseText,
  };
}
