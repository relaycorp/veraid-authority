import { getModelForClass, mongoose, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

import { setUpTestDbConnection } from '../../testUtils/db.js';
import { makeMockLogging, partialPinoLog } from '../../testUtils/logging.js';
import { MEMBER_ID, TEST_SERVICE_OID } from '../../testUtils/stubs.js';
import type { ServiceOptions } from '../../utilities/serviceTypes.js';
import { requireFailureResult, requireSuccessfulResult } from '../../testUtils/result.js';

import { SignatureSpec } from './SignatureSpec.model.js';
import { createSignatureSpec, deleteSignatureSpec, getSignatureSpec } from './signatureSpec.js';
import { SignatureSpecProblem } from './SignatureSpecProblem.js';

const OPENID_PROVIDER_ISSUER_URL = new URL('https://idp.example.com');
const JWT_SUBJECT_CLAIM = 'sub';
const JWT_SUBJECT_VALUE = 'alice@example.com';
const SIGNATURE_SPEC_ID = '111111111111111111111111';
const PLAINTEXT = Buffer.from('test plaintext').toString('base64');
const AUTH_TYPE = 'oidc-discovery';

describe('Member signature specs', () => {
  const getConnection = setUpTestDbConnection();

  const mockLogging = makeMockLogging();
  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let signatureSpecModel: ReturnModelType<typeof SignatureSpec>;
  beforeEach(() => {
    connection = getConnection();
    serviceOptions = {
      dbConnection: connection,
      logger: mockLogging.logger,
    };
    signatureSpecModel = getModelForClass(SignatureSpec, {
      existingConnection: connection,
    });
  });

  describe('createSignatureSpec', () => {
    test('Should create signature spec with default TTL', async () => {
      const signatureSpec = await createSignatureSpec(
        MEMBER_ID,
        {
          auth: {
            type: AUTH_TYPE,
            providerIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
            jwtSubjectClaim: JWT_SUBJECT_CLAIM,
            jwtSubjectValue: JWT_SUBJECT_VALUE,
          },

          serviceOid: TEST_SERVICE_OID,

          plaintext: PLAINTEXT,
        },
        serviceOptions,
      );

      requireSuccessfulResult(signatureSpec);
      const dbResult = await signatureSpecModel.findById(signatureSpec.result.id);
      expect(dbResult).not.toBeNull();
      expect(dbResult!.ttlSeconds).toBe(3600);
    });

    test('Should create signature spec with custom TTL', async () => {
      const customTtl = 1800;

      const signatureSpec = await createSignatureSpec(
        MEMBER_ID,
        {
          auth: {
            type: AUTH_TYPE,
            providerIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
            jwtSubjectClaim: JWT_SUBJECT_CLAIM,
            jwtSubjectValue: JWT_SUBJECT_VALUE,
          },

          serviceOid: TEST_SERVICE_OID,

          ttlSeconds: customTtl,

          plaintext: PLAINTEXT,
        },
        serviceOptions,
      );

      requireSuccessfulResult(signatureSpec);
      const dbResult = await signatureSpecModel.findById(signatureSpec.result.id);
      expect(dbResult).not.toBeNull();
      expect(dbResult!.ttlSeconds).toStrictEqual(customTtl);
    });

    test('Should store all required fields correctly', async () => {
      const signatureSpec = await createSignatureSpec(
        MEMBER_ID,
        {
          auth: {
            type: AUTH_TYPE,
            providerIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
            jwtSubjectClaim: JWT_SUBJECT_CLAIM,
            jwtSubjectValue: JWT_SUBJECT_VALUE,
          },

          serviceOid: TEST_SERVICE_OID,

          plaintext: PLAINTEXT,
        },
        serviceOptions,
      );

      requireSuccessfulResult(signatureSpec);
      const dbResult = await signatureSpecModel.findById(signatureSpec.result.id);
      expect(dbResult).not.toBeNull();
      expect(dbResult!.member._id.toString()).toStrictEqual(MEMBER_ID);
      expect(dbResult!.auth.providerIssuerUrl).toStrictEqual(OPENID_PROVIDER_ISSUER_URL);
      expect(dbResult!.auth.jwtSubjectClaim).toStrictEqual(JWT_SUBJECT_CLAIM);
      expect(dbResult!.auth.jwtSubjectValue).toStrictEqual(JWT_SUBJECT_VALUE);
      expect(dbResult!.serviceOid).toStrictEqual(TEST_SERVICE_OID);
      expect(dbResult!.plaintext.toString()).toStrictEqual(
        Buffer.from(PLAINTEXT, 'base64').toString(),
      );
    });

    test('Should log creation', async () => {
      const signatureSpec = await createSignatureSpec(
        MEMBER_ID,
        {
          auth: {
            type: AUTH_TYPE,
            providerIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
            jwtSubjectClaim: JWT_SUBJECT_CLAIM,
            jwtSubjectValue: JWT_SUBJECT_VALUE,
          },

          serviceOid: TEST_SERVICE_OID,
          plaintext: PLAINTEXT,
        },
        serviceOptions,
      );

      requireSuccessfulResult(signatureSpec);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Signature spec created', {
          signatureSpecId: signatureSpec.result.id,
        }),
      );
    });

    test('Should refuse TTL below minimum', async () => {
      const invalidTtl = 0;

      const signatureSpec = await createSignatureSpec(
        MEMBER_ID,
        {
          auth: {
            type: AUTH_TYPE,
            providerIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
            jwtSubjectClaim: JWT_SUBJECT_CLAIM,
            jwtSubjectValue: JWT_SUBJECT_VALUE,
          },

          serviceOid: TEST_SERVICE_OID,
          ttlSeconds: invalidTtl,
          plaintext: PLAINTEXT,
        },
        serviceOptions,
      );

      requireFailureResult(signatureSpec);
      expect(signatureSpec.context).toBe(SignatureSpecProblem.INVALID_TTL);
    });

    test('Should refuse TTL exceeding maximum', async () => {
      const invalidTtl = 3601;

      const signatureSpec = await createSignatureSpec(
        MEMBER_ID,
        {
          auth: {
            type: AUTH_TYPE,
            providerIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
            jwtSubjectClaim: JWT_SUBJECT_CLAIM,
            jwtSubjectValue: JWT_SUBJECT_VALUE,
          },

          serviceOid: TEST_SERVICE_OID,
          ttlSeconds: invalidTtl,
          plaintext: PLAINTEXT,
        },
        serviceOptions,
      );

      requireFailureResult(signatureSpec);
      expect(signatureSpec.context).toBe(SignatureSpecProblem.INVALID_TTL);
    });
  });

  describe('getSignatureSpec', () => {
    test('Existing id should return the corresponding data', async () => {
      const signatureSpec = await signatureSpecModel.create({
        member: MEMBER_ID,

        auth: {
          providerIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
          jwtSubjectClaim: JWT_SUBJECT_CLAIM,
          jwtSubjectValue: JWT_SUBJECT_VALUE,
        },

        serviceOid: TEST_SERVICE_OID,
        ttlSeconds: 3600,
        plaintext: Buffer.from(PLAINTEXT, 'base64'),
      });

      const result = await getSignatureSpec(
        MEMBER_ID,
        signatureSpec._id.toString(),
        serviceOptions,
      );

      requireSuccessfulResult(result);
      expect(result.result).toMatchObject({
        auth: {
          type: AUTH_TYPE,
          providerIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
          jwtSubjectClaim: JWT_SUBJECT_CLAIM,
          jwtSubjectValue: JWT_SUBJECT_VALUE,
        },

        serviceOid: TEST_SERVICE_OID,
        ttlSeconds: 3600,
        plaintext: PLAINTEXT,
      });
    });

    test('Non existing id should return non existing error', async () => {
      await signatureSpecModel.create({
        member: MEMBER_ID,

        auth: {
          providerIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
          jwtSubjectClaim: JWT_SUBJECT_CLAIM,
          jwtSubjectValue: JWT_SUBJECT_VALUE,
        },

        serviceOid: TEST_SERVICE_OID,
        ttlSeconds: 3600,
        plaintext: Buffer.from(PLAINTEXT, 'base64'),
      });

      const result = await getSignatureSpec(MEMBER_ID, SIGNATURE_SPEC_ID, serviceOptions);

      requireFailureResult(result);
      expect(result.context).toBe(SignatureSpecProblem.NOT_FOUND);
    });

    test('Non existing member id should return non existing error', async () => {
      const invalidMemberId = '222222222222222222222222';
      const signatureSpec = await signatureSpecModel.create({
        member: MEMBER_ID,

        auth: {
          providerIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
          jwtSubjectClaim: JWT_SUBJECT_CLAIM,
          jwtSubjectValue: JWT_SUBJECT_VALUE,
        },

        serviceOid: TEST_SERVICE_OID,
        ttlSeconds: 3600,
        plaintext: Buffer.from(PLAINTEXT, 'base64'),
      });

      const result = await getSignatureSpec(
        invalidMemberId,
        signatureSpec._id.toString(),
        serviceOptions,
      );

      requireFailureResult(result);
      expect(result.context).toBe(SignatureSpecProblem.NOT_FOUND);
    });
  });

  describe('deleteSignatureSpec', () => {
    const signatureSpecData: Partial<SignatureSpec> = {
      member: new mongoose.Types.ObjectId(MEMBER_ID),

      auth: {
        providerIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
        jwtSubjectClaim: JWT_SUBJECT_CLAIM,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
      },

      serviceOid: TEST_SERVICE_OID,
      ttlSeconds: 3600,
      plaintext: Buffer.from(PLAINTEXT, 'base64'),
    };

    test('Existing id should remove signature spec', async () => {
      const signatureSpec = await signatureSpecModel.create(signatureSpecData);

      const result = await deleteSignatureSpec(signatureSpec._id.toString(), serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await signatureSpecModel.findById(signatureSpec._id);
      expect(dbResult).toBeNull();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Signature spec deleted', {
          signatureSpecId: signatureSpec.id,
        }),
      );
    });

    test('Non existing id should not remove any signature spec', async () => {
      const signatureSpec = await signatureSpecModel.create(signatureSpecData);

      const result = await deleteSignatureSpec(SIGNATURE_SPEC_ID, serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await signatureSpecModel.findById(signatureSpec.id);
      expect(dbResult).not.toBeNull();
    });
  });
});
