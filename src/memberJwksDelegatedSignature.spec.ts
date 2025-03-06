import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging, partialPinoLog } from './testUtils/logging.js';
import { MEMBER_ID, TEST_SERVICE_OID } from './testUtils/stubs.js';
import type { ServiceOptions } from './serviceTypes.js';
import { requireFailureResult, requireSuccessfulResult } from './testUtils/result.js';
import { MemberJwksDelegatedSignature } from './models/MemberJwksDelegatedSignature.model.js';
import {
  createJwksDelegatedSignature,
  deleteJwksDelegatedSignature,
  getJwksDelegatedSignature,
} from './memberJwksDelegatedSignature.js';
import { MemberJwksDelegatedSignatureProblem } from './MemberJwksDelegatedSignatureProblem.js';

const JWKS_URL = 'https://example.com/.well-known/jwks.json';
const JWT_SUBJECT_FIELD = 'sub';
const JWT_SUBJECT_VALUE = 'alice@example.com';
const DELEGATED_SIGNATURE_ID = '111111111111111111111111';
const PLAINTEXT = Buffer.from('test plaintext').toString('base64');

describe('member JWKS delegated signature', () => {
  const getConnection = setUpTestDbConnection();

  const mockLogging = makeMockLogging();
  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let delegatedSignatureModel: ReturnModelType<typeof MemberJwksDelegatedSignature>;
  beforeEach(() => {
    connection = getConnection();
    serviceOptions = {
      dbConnection: connection,
      logger: mockLogging.logger,
    };
    delegatedSignatureModel = getModelForClass(MemberJwksDelegatedSignature, {
      existingConnection: connection,
    });
  });

  describe('createJwksDelegatedSignature', () => {
    test('Should create delegated signature with default TTL', async () => {
      const delegatedSignature = await createJwksDelegatedSignature(
        MEMBER_ID,
        {
          jwksUrl: JWKS_URL,
          jwtSubjectField: JWT_SUBJECT_FIELD,
          jwtSubjectValue: JWT_SUBJECT_VALUE,
          veraidServiceOid: TEST_SERVICE_OID,
          veraidSignaturePlaintext: PLAINTEXT,
        },
        serviceOptions,
      );

      requireSuccessfulResult(delegatedSignature);
      const dbResult = await delegatedSignatureModel.findById(delegatedSignature.result.id);
      expect(dbResult).not.toBeNull();
      expect(dbResult!.veraidSignatureTtlSeconds).toBe(3600);
    });

    test('Should create delegated signature with custom TTL', async () => {
      const customTtl = 1800;

      const delegatedSignature = await createJwksDelegatedSignature(
        MEMBER_ID,
        {
          jwksUrl: JWKS_URL,
          jwtSubjectField: JWT_SUBJECT_FIELD,
          jwtSubjectValue: JWT_SUBJECT_VALUE,
          veraidServiceOid: TEST_SERVICE_OID,
          veraidSignatureTtlSeconds: customTtl,
          veraidSignaturePlaintext: PLAINTEXT,
        },
        serviceOptions,
      );

      requireSuccessfulResult(delegatedSignature);
      const dbResult = await delegatedSignatureModel.findById(delegatedSignature.result.id);
      expect(dbResult).not.toBeNull();
      expect(dbResult!.veraidSignatureTtlSeconds).toStrictEqual(customTtl);
    });

    test('Should store all required fields correctly', async () => {
      const delegatedSignature = await createJwksDelegatedSignature(
        MEMBER_ID,
        {
          jwksUrl: JWKS_URL,
          jwtSubjectField: JWT_SUBJECT_FIELD,
          jwtSubjectValue: JWT_SUBJECT_VALUE,
          veraidServiceOid: TEST_SERVICE_OID,
          veraidSignaturePlaintext: PLAINTEXT,
        },
        serviceOptions,
      );

      requireSuccessfulResult(delegatedSignature);
      const dbResult = await delegatedSignatureModel.findById(delegatedSignature.result.id);
      expect(dbResult).not.toBeNull();
      expect(dbResult!.memberId).toStrictEqual(MEMBER_ID);
      expect(dbResult!.jwksUrl).toStrictEqual(JWKS_URL);
      expect(dbResult!.jwtSubjectField).toStrictEqual(JWT_SUBJECT_FIELD);
      expect(dbResult!.jwtSubjectValue).toStrictEqual(JWT_SUBJECT_VALUE);
      expect(dbResult!.veraidServiceOid).toStrictEqual(TEST_SERVICE_OID);
      expect(dbResult!.veraidSignaturePlaintext.toString()).toStrictEqual(
        Buffer.from(PLAINTEXT, 'base64').toString(),
      );
    });

    test('Should log creation', async () => {
      const delegatedSignature = await createJwksDelegatedSignature(
        MEMBER_ID,
        {
          jwksUrl: JWKS_URL,
          jwtSubjectField: JWT_SUBJECT_FIELD,
          jwtSubjectValue: JWT_SUBJECT_VALUE,
          veraidServiceOid: TEST_SERVICE_OID,
          veraidSignaturePlaintext: PLAINTEXT,
        },
        serviceOptions,
      );

      requireSuccessfulResult(delegatedSignature);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member JWKS delegated signature created', {
          memberJwksDelegatedSignatureId: delegatedSignature.result.id,
        }),
      );
    });

    test('Should refuse TTL below minimum', async () => {
      const invalidTtl = 0;

      const delegatedSignature = await createJwksDelegatedSignature(
        MEMBER_ID,
        {
          jwksUrl: JWKS_URL,
          jwtSubjectField: JWT_SUBJECT_FIELD,
          jwtSubjectValue: JWT_SUBJECT_VALUE,
          veraidServiceOid: TEST_SERVICE_OID,
          veraidSignatureTtlSeconds: invalidTtl,
          veraidSignaturePlaintext: PLAINTEXT,
        },
        serviceOptions,
      );

      requireFailureResult(delegatedSignature);
      expect(delegatedSignature.context).toBe(MemberJwksDelegatedSignatureProblem.INVALID_TTL);
    });

    test('Should refuse TTL exceeding maximum', async () => {
      const invalidTtl = 3601;

      const delegatedSignature = await createJwksDelegatedSignature(
        MEMBER_ID,
        {
          jwksUrl: JWKS_URL,
          jwtSubjectField: JWT_SUBJECT_FIELD,
          jwtSubjectValue: JWT_SUBJECT_VALUE,
          veraidServiceOid: TEST_SERVICE_OID,
          veraidSignatureTtlSeconds: invalidTtl,
          veraidSignaturePlaintext: PLAINTEXT,
        },
        serviceOptions,
      );

      requireFailureResult(delegatedSignature);
      expect(delegatedSignature.context).toBe(MemberJwksDelegatedSignatureProblem.INVALID_TTL);
    });
  });

  describe('getJwksDelegatedSignature', () => {
    test('Existing id should return the corresponding data', async () => {
      const delegatedSignature = await delegatedSignatureModel.create({
        memberId: MEMBER_ID,
        jwksUrl: JWKS_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignatureTtlSeconds: 3600,
        veraidSignaturePlaintext: Buffer.from(PLAINTEXT, 'base64'),
      });

      const result = await getJwksDelegatedSignature(
        MEMBER_ID,
        delegatedSignature._id.toString(),
        serviceOptions,
      );

      requireSuccessfulResult(result);
      expect(result.result).toMatchObject({
        jwksUrl: JWKS_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignatureTtlSeconds: 3600,
        veraidSignaturePlaintext: PLAINTEXT,
      });
    });

    test('Non existing id should return non existing error', async () => {
      await delegatedSignatureModel.create({
        memberId: MEMBER_ID,
        jwksUrl: JWKS_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignatureTtlSeconds: 3600,
        veraidSignaturePlaintext: Buffer.from(PLAINTEXT, 'base64'),
      });

      const result = await getJwksDelegatedSignature(
        MEMBER_ID,
        DELEGATED_SIGNATURE_ID,
        serviceOptions,
      );

      requireFailureResult(result);
      expect(result.context).toBe(MemberJwksDelegatedSignatureProblem.NOT_FOUND);
    });

    test('Non existing member id should return non existing error', async () => {
      const invalidMemberId = '222222222222222222222222';
      const delegatedSignature = await delegatedSignatureModel.create({
        memberId: MEMBER_ID,
        jwksUrl: JWKS_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignatureTtlSeconds: 3600,
        veraidSignaturePlaintext: Buffer.from(PLAINTEXT, 'base64'),
      });

      const result = await getJwksDelegatedSignature(
        invalidMemberId,
        delegatedSignature._id.toString(),
        serviceOptions,
      );

      requireFailureResult(result);
      expect(result.context).toBe(MemberJwksDelegatedSignatureProblem.NOT_FOUND);
    });
  });

  describe('deleteJwksDelegatedSignature', () => {
    const delegatedSignatureData = {
      memberId: MEMBER_ID,
      jwksUrl: JWKS_URL,
      jwtSubjectField: JWT_SUBJECT_FIELD,
      jwtSubjectValue: JWT_SUBJECT_VALUE,
      veraidServiceOid: TEST_SERVICE_OID,
      veraidSignatureTtlSeconds: 3600,
      veraidSignaturePlaintext: Buffer.from(PLAINTEXT, 'base64'),
    };

    test('Existing id should remove delegated signature', async () => {
      const delegatedSignature = await delegatedSignatureModel.create(delegatedSignatureData);

      const result = await deleteJwksDelegatedSignature(
        delegatedSignature._id.toString(),
        serviceOptions,
      );

      requireSuccessfulResult(result);
      const dbResult = await delegatedSignatureModel.findById(delegatedSignature._id);
      expect(dbResult).toBeNull();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member JWKS delegated signature deleted', {
          memberJwksDelegatedSignatureId: delegatedSignature.id,
        }),
      );
    });

    test('Non existing id should not remove any delegated signature', async () => {
      const delegatedSignature = await delegatedSignatureModel.create(delegatedSignatureData);

      const result = await deleteJwksDelegatedSignature(DELEGATED_SIGNATURE_ID, serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await delegatedSignatureModel.findById(delegatedSignature.id);
      expect(dbResult).not.toBeNull();
    });
  });
});
