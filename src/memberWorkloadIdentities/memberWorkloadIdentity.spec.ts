import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

import { setUpTestDbConnection } from '../testUtils/db.js';
import { makeMockLogging, partialPinoLog } from '../testUtils/logging.js';
import { MEMBER_ID, TEST_SERVICE_OID } from '../testUtils/stubs.js';
import type { ServiceOptions } from '../serviceTypes.js';
import { requireFailureResult, requireSuccessfulResult } from '../testUtils/result.js';

import { MemberWorkloadIdentity } from './MemberWorkloadIdentity.model.js';
import {
  createWorkloadIdentity,
  deleteWorkloadIdentity,
  getWorkloadIdentity,
} from './memberWorkloadIdentity.js';
import { MemberWorkloadIdentityProblem } from './MemberWorkloadIdentityProblem.js';

const JWKS_URL = 'https://example.com/.well-known/jwks.json';
const JWT_SUBJECT_FIELD = 'sub';
const JWT_SUBJECT_VALUE = 'alice@example.com';
const WORKLOAD_IDENTITY_ID = '111111111111111111111111';
const PLAINTEXT = Buffer.from('test plaintext').toString('base64');

describe('Member workload identities', () => {
  const getConnection = setUpTestDbConnection();

  const mockLogging = makeMockLogging();
  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let workloadIdentityModel: ReturnModelType<typeof MemberWorkloadIdentity>;
  beforeEach(() => {
    connection = getConnection();
    serviceOptions = {
      dbConnection: connection,
      logger: mockLogging.logger,
    };
    workloadIdentityModel = getModelForClass(MemberWorkloadIdentity, {
      existingConnection: connection,
    });
  });

  describe('createWorkloadIdentity', () => {
    test('Should create workload identity with default TTL', async () => {
      const workloadIdentity = await createWorkloadIdentity(
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

      requireSuccessfulResult(workloadIdentity);
      const dbResult = await workloadIdentityModel.findById(workloadIdentity.result.id);
      expect(dbResult).not.toBeNull();
      expect(dbResult!.veraidSignatureTtlSeconds).toBe(3600);
    });

    test('Should create workload identity with custom TTL', async () => {
      const customTtl = 1800;

      const workloadIdentity = await createWorkloadIdentity(
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

      requireSuccessfulResult(workloadIdentity);
      const dbResult = await workloadIdentityModel.findById(workloadIdentity.result.id);
      expect(dbResult).not.toBeNull();
      expect(dbResult!.veraidSignatureTtlSeconds).toStrictEqual(customTtl);
    });

    test('Should store all required fields correctly', async () => {
      const workloadIdentity = await createWorkloadIdentity(
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

      requireSuccessfulResult(workloadIdentity);
      const dbResult = await workloadIdentityModel.findById(workloadIdentity.result.id);
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
      const workloadIdentity = await createWorkloadIdentity(
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

      requireSuccessfulResult(workloadIdentity);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member workload identity created', {
          memberWorkloadIdentityId: workloadIdentity.result.id,
        }),
      );
    });

    test('Should refuse TTL below minimum', async () => {
      const invalidTtl = 0;

      const workloadIdentity = await createWorkloadIdentity(
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

      requireFailureResult(workloadIdentity);
      expect(workloadIdentity.context).toBe(MemberWorkloadIdentityProblem.INVALID_TTL);
    });

    test('Should refuse TTL exceeding maximum', async () => {
      const invalidTtl = 3601;

      const workloadIdentity = await createWorkloadIdentity(
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

      requireFailureResult(workloadIdentity);
      expect(workloadIdentity.context).toBe(MemberWorkloadIdentityProblem.INVALID_TTL);
    });
  });

  describe('getWorkloadIdentity', () => {
    test('Existing id should return the corresponding data', async () => {
      const workloadIdentity = await workloadIdentityModel.create({
        memberId: MEMBER_ID,
        jwksUrl: JWKS_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignatureTtlSeconds: 3600,
        veraidSignaturePlaintext: Buffer.from(PLAINTEXT, 'base64'),
      });

      const result = await getWorkloadIdentity(
        MEMBER_ID,
        workloadIdentity._id.toString(),
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
      await workloadIdentityModel.create({
        memberId: MEMBER_ID,
        jwksUrl: JWKS_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignatureTtlSeconds: 3600,
        veraidSignaturePlaintext: Buffer.from(PLAINTEXT, 'base64'),
      });

      const result = await getWorkloadIdentity(MEMBER_ID, WORKLOAD_IDENTITY_ID, serviceOptions);

      requireFailureResult(result);
      expect(result.context).toBe(MemberWorkloadIdentityProblem.NOT_FOUND);
    });

    test('Non existing member id should return non existing error', async () => {
      const invalidMemberId = '222222222222222222222222';
      const workloadIdentity = await workloadIdentityModel.create({
        memberId: MEMBER_ID,
        jwksUrl: JWKS_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignatureTtlSeconds: 3600,
        veraidSignaturePlaintext: Buffer.from(PLAINTEXT, 'base64'),
      });

      const result = await getWorkloadIdentity(
        invalidMemberId,
        workloadIdentity._id.toString(),
        serviceOptions,
      );

      requireFailureResult(result);
      expect(result.context).toBe(MemberWorkloadIdentityProblem.NOT_FOUND);
    });
  });

  describe('deleteWorkloadIdentity', () => {
    const workloadIdentityData: Partial<MemberWorkloadIdentity> = {
      memberId: MEMBER_ID,
      jwksUrl: JWKS_URL,
      jwtSubjectField: JWT_SUBJECT_FIELD,
      jwtSubjectValue: JWT_SUBJECT_VALUE,
      veraidServiceOid: TEST_SERVICE_OID,
      veraidSignatureTtlSeconds: 3600,
      veraidSignaturePlaintext: Buffer.from(PLAINTEXT, 'base64'),
    };

    test('Existing id should remove workload identity', async () => {
      const workloadIdentity = await workloadIdentityModel.create(workloadIdentityData);

      const result = await deleteWorkloadIdentity(workloadIdentity._id.toString(), serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await workloadIdentityModel.findById(workloadIdentity._id);
      expect(dbResult).toBeNull();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member workload identity deleted', {
          memberWorkloadIdentityId: workloadIdentity.id,
        }),
      );
    });

    test('Non existing id should not remove any workload identity', async () => {
      const workloadIdentity = await workloadIdentityModel.create(workloadIdentityData);

      const result = await deleteWorkloadIdentity(WORKLOAD_IDENTITY_ID, serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await workloadIdentityModel.findById(workloadIdentity.id);
      expect(dbResult).not.toBeNull();
    });
  });
});
