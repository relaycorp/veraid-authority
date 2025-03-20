import type { InjectOptions } from 'fastify';
import { jest } from '@jest/globals';
import type { SignatureBundle } from '@relaycorp/veraid';

import type { Result } from '../../utilities/result.js';
import { mockSpy } from '../../testUtils/jest.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import { stringToArrayBuffer } from '../../testUtils/buffer.js';

import { SignatureBundleIssuanceProblem } from './SignatureBundleIssuanceProblem.js';

const SIGNATURE_SPEC_ID = '111111111111111111111111';
const JWT = 'j.w.t.';
const SIGNATURE_BUNDLE_PATH = `/credentials/signatureBundles/${SIGNATURE_SPEC_ID}`;

const mockIssueSignatureBundle = mockSpy(
  jest.fn<() => Promise<Result<SignatureBundle, SignatureBundleIssuanceProblem>>>(),
);

jest.unstable_mockModule('./signatureBundleIssuance.js', () => ({
  issueSignatureBundle: mockIssueSignatureBundle,
}));

const { makeTestApiServer } = await import('../../testUtils/apiServer.js');

describe('signature bundle issuance route', () => {
  const getTestServerFixture = makeTestApiServer();
  let serverInstance: FastifyTypedInstance;
  beforeEach(() => {
    serverInstance = getTestServerFixture().server;
  });

  const injectionOptions: InjectOptions = {
    method: 'GET',
    url: SIGNATURE_BUNDLE_PATH,

    headers: {
      authorization: `Bearer ${JWT}`,
    },
  };

  test('should refuse request without Authorization header', async () => {
    const response = await serverInstance.inject({
      ...injectionOptions,
      headers: {},
    });

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.UNAUTHORIZED);
  });

  test('should refuse Authorization header without Bearer token', async () => {
    const response = await serverInstance.inject({
      ...injectionOptions,

      headers: {
        authorization: 'Basic dXNlcjpwYXNzd29yZA==',
      },
    });

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.UNAUTHORIZED);
  });

  test('should refuse invalid JWT', async () => {
    mockIssueSignatureBundle.mockResolvedValueOnce({
      didSucceed: false,
      context: SignatureBundleIssuanceProblem.INVALID_JWT,
    });

    const response = await serverInstance.inject(injectionOptions);

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.UNAUTHORIZED);
    expect(response.json()).toHaveProperty('type', SignatureBundleIssuanceProblem.INVALID_JWT);
  });

  test('should refuse expired JWT', async () => {
    mockIssueSignatureBundle.mockResolvedValueOnce({
      didSucceed: false,
      context: SignatureBundleIssuanceProblem.EXPIRED_JWT,
    });

    const response = await serverInstance.inject(injectionOptions);

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.UNAUTHORIZED);
    expect(response.json()).toHaveProperty('type', SignatureBundleIssuanceProblem.EXPIRED_JWT);
  });

  test('should report failure to retrieve JWKS', async () => {
    mockIssueSignatureBundle.mockResolvedValueOnce({
      didSucceed: false,
      context: SignatureBundleIssuanceProblem.JWKS_RETRIEVAL_ERROR,
    });

    const response = await serverInstance.inject(injectionOptions);

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.SERVICE_UNAVAILABLE);
    expect(response.json()).toHaveProperty(
      'type',
      SignatureBundleIssuanceProblem.JWKS_RETRIEVAL_ERROR,
    );
  });

  test('should report failure to retrieve DNSSEC chain', async () => {
    mockIssueSignatureBundle.mockResolvedValueOnce({
      didSucceed: false,
      context: SignatureBundleIssuanceProblem.DNSSEC_CHAIN_RETRIEVAL_FAILED,
    });

    const response = await serverInstance.inject(injectionOptions);

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.SERVICE_UNAVAILABLE);
    expect(response.json()).toHaveProperty(
      'type',
      SignatureBundleIssuanceProblem.DNSSEC_CHAIN_RETRIEVAL_FAILED,
    );
  });

  test('should report failure to load org', async () => {
    mockIssueSignatureBundle.mockResolvedValueOnce({
      didSucceed: false,
      context: SignatureBundleIssuanceProblem.SIGNATURE_SPEC_NOT_FOUND,
    });

    const response = await serverInstance.inject(injectionOptions);

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
    expect(response.json()).toHaveProperty(
      'type',
      SignatureBundleIssuanceProblem.SIGNATURE_SPEC_NOT_FOUND,
    );
  });

  test('should refuse non-existing spec', async () => {
    mockIssueSignatureBundle.mockResolvedValueOnce({
      didSucceed: false,
      context: SignatureBundleIssuanceProblem.SIGNATURE_SPEC_NOT_FOUND,
    });

    const response = await serverInstance.inject(injectionOptions);

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
    expect(response.json()).toHaveProperty(
      'type',
      SignatureBundleIssuanceProblem.SIGNATURE_SPEC_NOT_FOUND,
    );
  });

  test('should return signature bundle', async () => {
    const signatureBundleSerialised = stringToArrayBuffer('bundle');
    const signatureBundle = {
      serialise: jest.fn().mockReturnValue(signatureBundleSerialised),
    } as unknown as SignatureBundle;
    mockIssueSignatureBundle.mockResolvedValueOnce({
      didSucceed: true,
      result: signatureBundle,
    });

    const response = await serverInstance.inject(injectionOptions);

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
    expect(response.headers['content-type']).toBe('application/vnd.veraid.signature-bundle');
    expect(response.rawPayload.equals(Buffer.from(signatureBundleSerialised))).toBeTrue();
  });
});
