/* eslint-disable unicorn/text-encoding-identifier-case */
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

import { MemberAccessType, OrgModelSchema } from './models/Org.model.js';
import {
  type OrgSchema,
  type OrgSchemaMemberAccessType,
  orgSchemaMemberAccessTypes,
} from './schemas/org.schema.js';
import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging, type MockLogging, partialPinoLog } from './testUtils/logging.js';
import { requireFailureResult, requireSuccessfulResult } from './testUtils/result.js';
import {
  AWALA_ENDPOINT,
  NON_ASCII_AWALA_ENDPOINT,
  NON_ASCII_ORG_NAME,
  ORG_NAME,
} from './testUtils/stubs.js';
import { getPromiseRejection } from './testUtils/jest.js';
import type { ServiceOptions } from './serviceTypes.js';
import { OrgProblemType } from './OrgProblemType.js';
import { MEMBER_ACCESS_TYPE_MAPPING } from './orgTypes.js';
import { createOrg, deleteOrg, getOrg, updateOrg } from './org.js';
import { mockKms } from './testUtils/kms/mockKms.js';
import { derSerialisePublicKey } from './utilities/webcrypto.js';

describe('org', () => {
  const getConnection = setUpTestDbConnection();
  const getMockKms = mockKms();

  let mockLogging: MockLogging;
  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let orgModel: ReturnModelType<typeof OrgModelSchema>;
  beforeEach(() => {
    mockLogging = makeMockLogging();
    connection = getConnection();
    serviceOptions = {
      dbConnection: connection,
      logger: mockLogging.logger,
    };
    orgModel = getModelForClass(OrgModelSchema, {
      existingConnection: connection,
    });
  });

  describe('createOrg', () => {
    test('Minimum required data should be stored', async () => {
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
      };

      await createOrg(orgData, serviceOptions);

      const dbResult = await orgModel.exists({
        name: ORG_NAME,
        memberAccessType: MemberAccessType.INVITE_ONLY,
      });
      expect(dbResult).not.toBeNull();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Org created', { name: ORG_NAME }),
      );
    });

    test('Non ASCII name should be allowed', async () => {
      const nonAsciiName = 'はじめよう.みんな';
      const orgData: OrgSchema = {
        name: nonAsciiName,
        memberAccessType: 'INVITE_ONLY',
      };

      const result = await createOrg(orgData, serviceOptions);

      expect(result.didSucceed).toBeTrue();
    });

    test('Malformed name should be refused', async () => {
      const malformedName = '192.168.0.0';
      const orgData: OrgSchema = {
        name: malformedName,
        memberAccessType: 'INVITE_ONLY',
      };

      const result = await createOrg(orgData, serviceOptions);

      requireFailureResult(result);
      expect(result.reason).toBe(OrgProblemType.MALFORMED_ORG_NAME);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused malformed org name', {
          name: malformedName,
        }),
      );
    });

    test('Clash with existing name should be refused', async () => {
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
      };
      await createOrg(orgData, serviceOptions);

      // Use different data to make sure the creation operation isn't being deduped
      const methodResult = await createOrg(
        { ...orgData, memberAccessType: 'OPEN' },
        serviceOptions,
      );

      requireFailureResult(methodResult);
      expect(methodResult.reason).toBe(OrgProblemType.EXISTING_ORG_NAME);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused duplicated org name', {
          name: ORG_NAME,
        }),
      );
    });

    test.each(orgSchemaMemberAccessTypes)(
      '%s access type should be allowed',
      async (memberAccessType: OrgSchemaMemberAccessType) => {
        const orgData: OrgSchema = {
          name: ORG_NAME,
          memberAccessType,
        };

        const methodResult = await createOrg(orgData, serviceOptions);

        requireSuccessfulResult(methodResult);
        const dbResult = await orgModel.findOne({
          name: methodResult.result.name,
        });
        expect(dbResult?.memberAccessType).toBe(MEMBER_ACCESS_TYPE_MAPPING[memberAccessType]);
      },
    );

    test.each([
      ['ASCII', AWALA_ENDPOINT],
      ['Non ASCII', NON_ASCII_AWALA_ENDPOINT],
    ])('%s Awala endpoint should be allowed', async (_type, awalaEndpoint: string) => {
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
        awalaEndpoint,
      };

      const result = await createOrg(orgData, serviceOptions);

      expect(result.didSucceed).toBeTrue();
    });

    test('Malformed Awala endpoint should be refused', async () => {
      const malformedAwalaEndpoint = '192.168.0.0';
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
        awalaEndpoint: malformedAwalaEndpoint,
      };

      const result = await createOrg(orgData, serviceOptions);

      requireFailureResult(result);
      expect(result.reason).toBe(OrgProblemType.MALFORMED_AWALA_ENDPOINT);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused malformed Awala endpoint', {
          awalaEndpoint: malformedAwalaEndpoint,
        }),
      );
    });

    test('Returned id should match that of the database', async () => {
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
        awalaEndpoint: AWALA_ENDPOINT,
      };

      const methodResult = await createOrg(orgData, serviceOptions);

      requireSuccessfulResult(methodResult);

      const dbResult = await orgModel.findOne({
        name: methodResult.result.name,
      });
      expect(methodResult.result.name).toStrictEqual(dbResult?.name);
    });

    test('Record creation errors should be propagated', async () => {
      await connection.close();
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
      };

      const error = await getPromiseRejection(
        async () => createOrg(orgData, serviceOptions),
        Error,
      );

      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
    });

    describe('Key pair', () => {
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
      };

      test('Key pair should be generated', async () => {
        const kms = getMockKms();
        expect(kms.generatedKeyPairRefs).toHaveLength(0);

        await createOrg(orgData, serviceOptions);

        expect(kms.generatedKeyPairRefs).toHaveLength(1);
      });

      test('Private key reference should be stored in DB', async () => {
        const result = await createOrg(orgData, serviceOptions);

        requireSuccessfulResult(result);
        const dbResult = await orgModel.findOne({ name: result.result.name });
        const kms = getMockKms();
        const [{ privateKeyRef }] = kms.generatedKeyPairRefs;
        expect(Buffer.from(dbResult!.privateKeyRef)).toStrictEqual(privateKeyRef);
      });

      test('Public key should be stored DER-serialised in DB', async () => {
        const result = await createOrg(orgData, serviceOptions);

        requireSuccessfulResult(result);
        const dbResult = await orgModel.findOne({ name: result.result.name });
        const kms = getMockKms();
        const [{ publicKey: generatedPublicKey }] = kms.generatedKeyPairRefs;
        const expectedPublicKey = await derSerialisePublicKey(generatedPublicKey);
        expect(Buffer.from(dbResult!.publicKey)).toStrictEqual(expectedPublicKey);
      });
    });
  });

  describe('updateOrg', () => {
    test('Valid data should be updated', async () => {
      await orgModel.create({
        name: ORG_NAME,
        memberAccessType: MemberAccessType.OPEN,
        awalaEndpoint: `a.${AWALA_ENDPOINT}`,
      });

      await updateOrg(
        ORG_NAME,
        {
          name: ORG_NAME,
          memberAccessType: 'INVITE_ONLY',
          awalaEndpoint: AWALA_ENDPOINT,
        },
        serviceOptions,
      );

      const dbResult = await orgModel.exists({
        name: ORG_NAME,
        memberAccessType: MemberAccessType.INVITE_ONLY,
        awalaEndpoint: AWALA_ENDPOINT,
      });

      expect(dbResult).not.toBeNull();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Org updated', {
          name: ORG_NAME,
        }),
      );
    });

    test.each([
      ['ASCII', ORG_NAME],
      ['Non ASCII', NON_ASCII_ORG_NAME],
    ])('Matching %s name should be allowed', async (_type, name: string) => {
      await orgModel.create({
        name,
        memberAccessType: MemberAccessType.INVITE_ONLY,
      });

      const response = await updateOrg(
        name,
        {
          name,
        },
        serviceOptions,
      );

      expect(response.didSucceed).toBeTrue();
    });

    test('Non existing name should be ignored', async () => {
      const result = await updateOrg(ORG_NAME, {}, serviceOptions);

      expect(result.didSucceed).toBeTrue();
    });

    test('Malformed name should be refused', async () => {
      const malformedOrgName = 'INVALID_NAME';

      const result = await updateOrg(
        malformedOrgName,
        {
          name: malformedOrgName,
        },
        serviceOptions,
      );

      requireFailureResult(result);
      expect(result.reason).toBe(OrgProblemType.MALFORMED_ORG_NAME);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused malformed org name', {
          name: malformedOrgName,
        }),
      );
    });

    test('Non matching name should be refused', async () => {
      const originalName = `a.${ORG_NAME}`;
      const result = await updateOrg(
        ORG_NAME,
        {
          name: originalName,
        },
        serviceOptions,
      );

      requireFailureResult(result);
      expect(result.reason).toBe(OrgProblemType.INVALID_ORG_NAME);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused non matching name', {
          originalName: ORG_NAME,
          targetName: originalName,
        }),
      );
    });

    test.each(orgSchemaMemberAccessTypes)(
      '%s access type should be allowed',
      async (memberAccessType: OrgSchemaMemberAccessType) => {
        await orgModel.create({
          name: ORG_NAME,
          memberAccessType: MEMBER_ACCESS_TYPE_MAPPING[memberAccessType],
        });

        const response = await updateOrg(
          ORG_NAME,
          {
            memberAccessType,
          },
          serviceOptions,
        );

        expect(response.didSucceed).toBeTrue();
      },
    );

    test.each([
      ['ASCII', AWALA_ENDPOINT],
      ['Non ASCII', NON_ASCII_AWALA_ENDPOINT],
    ])('%s Awala endpoint should be allowed', async (_type, awalaEndpoint: string) => {
      await orgModel.create({
        name: ORG_NAME,
        memberAccessType: MemberAccessType.OPEN,
        awalaEndpoint: AWALA_ENDPOINT,
      });

      const response = await updateOrg(
        ORG_NAME,
        {
          awalaEndpoint,
        },
        serviceOptions,
      );

      expect(response.didSucceed).toBeTrue();
    });

    test('Malformed Awala endpoint should be refused', async () => {
      const malformedAwalaEndpoint = 'MALFORMED_AWALA_ENDPOINT';
      const result = await updateOrg(
        ORG_NAME,
        {
          name: ORG_NAME,
          memberAccessType: 'INVITE_ONLY',
          awalaEndpoint: malformedAwalaEndpoint,
        },
        serviceOptions,
      );

      requireFailureResult(result);
      expect(result.reason).toBe(OrgProblemType.MALFORMED_AWALA_ENDPOINT);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused malformed Awala endpoint', {
          awalaEndpoint: malformedAwalaEndpoint,
        }),
      );
    });

    test('Record update errors should be propagated', async () => {
      await connection.close();
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
      };

      const error = await getPromiseRejection(
        async () => updateOrg(ORG_NAME, orgData, serviceOptions),
        Error,
      );

      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
    });
  });

  describe('getOrg', () => {
    test('Existing name should return the corresponding data', async () => {
      await orgModel.create({
        name: ORG_NAME,
        memberAccessType: MemberAccessType.OPEN,
        awalaEndpoint: AWALA_ENDPOINT,
      });

      const result = await getOrg(ORG_NAME, serviceOptions);

      requireSuccessfulResult(result);
      expect(result.result).toMatchObject({
        name: ORG_NAME,
        memberAccessType: 'OPEN',
        awalaEndpoint: AWALA_ENDPOINT,
      });
    });

    test('Invalid name should return non existing error', async () => {
      const result = await getOrg(ORG_NAME, serviceOptions);

      requireFailureResult(result);
      expect(result.reason).toBe(OrgProblemType.ORG_NOT_FOUND);
    });

    test('Record Find errors should be propagated', async () => {
      await connection.close();

      const error = await getPromiseRejection(async () => getOrg(ORG_NAME, serviceOptions), Error);

      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
    });
  });

  describe('deleteOrg', () => {
    const orgData: OrgSchema = {
      name: ORG_NAME,
      memberAccessType: 'INVITE_ONLY',
    };

    test('Existing name should remove org', async () => {
      await createOrg(orgData, serviceOptions);

      const result = await deleteOrg(ORG_NAME, serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await orgModel.exists({
        name: ORG_NAME,
      });
      expect(dbResult).toBeNull();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Org deleted', { name: ORG_NAME }),
      );
    });

    test('Non existing name should not remove any org', async () => {
      await createOrg(orgData, serviceOptions);

      const result = await deleteOrg(NON_ASCII_ORG_NAME, serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await orgModel.exists({ name: ORG_NAME });
      expect(dbResult).not.toBeNull();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Ignored deletion of non-existing org', {
          name: NON_ASCII_ORG_NAME,
        }),
      );
    });

    test('Private key should be destroyed', async () => {
      await createOrg(orgData, serviceOptions);

      await deleteOrg(ORG_NAME, serviceOptions);

      const kms = getMockKms();
      const [{ privateKeyRef }] = kms.generatedKeyPairRefs;
      expect(kms.destroyedPrivateKeyRefs).toContainEqual(privateKeyRef);
    });

    test('Record deletion errors should be propagated', async () => {
      await createOrg(orgData, serviceOptions);
      await connection.close();

      const error = await getPromiseRejection(
        async () => deleteOrg(ORG_NAME, serviceOptions),
        Error,
      );

      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
    });
  });
});
