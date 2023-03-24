/* eslint-disable unicorn/text-encoding-identifier-case */
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

import { MemberAccessType, OrgModelSchema } from './models/Org.model.js';
import { createOrg, deleteOrg, getOrg, updateOrg } from './org.js';
import {
  type OrgSchema,
  type OrgSchemaMemberAccessType,
  orgSchemaMemberAccessTypes,
} from './services/schema/org.schema.js';
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
import { OrgProblemType } from './OrgProblemType.js';
import { MEMBER_ACCESS_TYPE_MAPPING, type ServiceOptions } from './orgTypes.js';

describe('org', () => {
  const getConnection = setUpTestDbConnection();

  let mockLogging: MockLogging;
  let connection: Connection;
  let orgModel: ReturnModelType<typeof OrgModelSchema>;
  beforeEach(() => {
    mockLogging = makeMockLogging();
    connection = getConnection();
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

      await createOrg(orgData, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

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

      const result = await createOrg(orgData, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

      expect(result.didSucceed).toBeTrue();
    });

    test('Malformed name should be refused', async () => {
      const malformedName = '192.168.0.0';
      const orgData: OrgSchema = {
        name: malformedName,
        memberAccessType: 'INVITE_ONLY',
      };

      const result = await createOrg(orgData, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

      requireFailureResult(result);
      expect(result.reason).toBe(OrgProblemType.MALFORMED_ORG_NAME);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused malformed org name', { name: malformedName }),
      );
    });

    test('INVITE_ONLY access type should be allowed', async () => {
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
      };

      const methodResult = await createOrg(orgData, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

      requireSuccessfulResult(methodResult);
      const dbResult = await orgModel.findOne({
        name: methodResult.result.name,
      });
      expect(dbResult?.memberAccessType).toBe(MemberAccessType.INVITE_ONLY);
    });

    test('OPEN access type should be allowed', async () => {
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'OPEN',
      };

      const methodResult = await createOrg(orgData, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

      requireSuccessfulResult(methodResult);
      const dbResult = await orgModel.findOne({
        name: methodResult.result.name,
      });
      expect(dbResult?.memberAccessType).toBe(MemberAccessType.OPEN);
    });

    test('Any Awala endpoint should be stored', async () => {
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'OPEN',
        awalaEndpoint: AWALA_ENDPOINT,
      };

      const methodResult = await createOrg(orgData, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

      requireSuccessfulResult(methodResult);
      const dbResult = await orgModel.findOne({
        name: methodResult.result.name,
      });
      expect(dbResult?.awalaEndpoint).toBe(AWALA_ENDPOINT);
    });

    test('Non ASCII Awala endpoint should be allowed', async () => {
      const nonAsciiAwalaEndpoint = 'はじめよう.みんな';
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
        awalaEndpoint: nonAsciiAwalaEndpoint,
      };

      const result = await createOrg(orgData, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

      expect(result.didSucceed).toBeTrue();
    });

    test('Malformed Awala endpoint should be refused', async () => {
      const malformedAwalaEndpoint = '192.168.0.0';
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
        awalaEndpoint: malformedAwalaEndpoint,
      };

      const result = await createOrg(orgData, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

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

      const methodResult = await createOrg(orgData, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

      requireSuccessfulResult(methodResult);

      const dbResult = await orgModel.findOne({
        name: methodResult.result.name,
      });
      expect(methodResult.result.name).toStrictEqual(dbResult?.name);
    });

    test('Clash with existing name should be refused', async () => {
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
      };
      const creationOptions: ServiceOptions = {
        dbConnection: connection,
        logger: mockLogging.logger,
      };
      await createOrg(orgData, creationOptions);

      const methodResult = await createOrg(orgData, creationOptions);

      requireFailureResult(methodResult);
      expect(methodResult.reason).toBe(OrgProblemType.EXISTING_ORG_NAME);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused duplicated org name', {
          name: ORG_NAME,
        }),
      );
    });

    test('Record creation errors should be propagated', async () => {
      await connection.close();
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
      };

      const error = await getPromiseRejection(
        async () =>
          createOrg(orgData, {
            dbConnection: connection,
            logger: mockLogging.logger,
          }),
        Error,
      );

      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
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
        {
          dbConnection: connection,
          logger: mockLogging.logger,
        },
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
        {
          dbConnection: connection,
          logger: mockLogging.logger,
        },
      );

      expect(response.didSucceed).toBeTrue();
    });

    test('Non existing name should be ignored', async () => {
      const result = await updateOrg(
        ORG_NAME,
        {},
        {
          dbConnection: connection,
          logger: mockLogging.logger,
        },
      );

      expect(result.didSucceed).toBeTrue();
    });

    test('Malformed name should be refused', async () => {
      const malformedOrgName = 'INVALID_NAME';

      const result = await updateOrg(
        malformedOrgName,
        {
          name: malformedOrgName,
        },
        {
          dbConnection: connection,
          logger: mockLogging.logger,
        },
      );

      requireFailureResult(result);
      expect(result.reason).toBe(OrgProblemType.MALFORMED_ORG_NAME);
    });

    test('Non matching name should be refused', async () => {
      const result = await updateOrg(
        ORG_NAME,
        {
          name: `a.${ORG_NAME}`,
        },
        {
          dbConnection: connection,
          logger: mockLogging.logger,
        },
      );

      requireFailureResult(result);
      expect(result.reason).toBe(OrgProblemType.INVALID_ORG_NAME);
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
          {
            dbConnection: connection,
            logger: mockLogging.logger,
          },
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
        {
          dbConnection: connection,
          logger: mockLogging.logger,
        },
      );

      expect(response.didSucceed).toBeTrue();
    });

    test('Malformed Awala endpoint should be refused', async () => {
      const result = await updateOrg(
        ORG_NAME,
        {
          name: ORG_NAME,
          memberAccessType: 'INVITE_ONLY',
          awalaEndpoint: 'INVALID_AWALA_ENDPOINT',
        },
        {
          dbConnection: connection,
          logger: mockLogging.logger,
        },
      );

      requireFailureResult(result);
      expect(result.reason).toBe(OrgProblemType.MALFORMED_AWALA_ENDPOINT);
    });

    test('Record update errors should be propagated', async () => {
      await connection.close();
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
      };

      const error = await getPromiseRejection(
        async () =>
          updateOrg(ORG_NAME, orgData, {
            dbConnection: connection,
            logger: mockLogging.logger,
          }),
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

      const result = await getOrg(ORG_NAME, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

      requireSuccessfulResult(result);
      expect(result.result).toMatchObject({
        name: ORG_NAME,
        memberAccessType: 'OPEN',
        awalaEndpoint: AWALA_ENDPOINT,
      });
    });

    test('Invalid name should return non existing error', async () => {
      const result = await getOrg(ORG_NAME, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

      requireFailureResult(result);
      expect(result.reason).toBe(OrgProblemType.ORG_NOT_FOUND);
    });

    test('Record Find errors should be propagated', async () => {
      await connection.close();

      const error = await getPromiseRejection(
        async () =>
          getOrg(ORG_NAME, {
            dbConnection: connection,
            logger: mockLogging.logger,
          }),
        Error,
      );

      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
    });
  });

  describe('deleteOrg', () => {
    test('Existing name should remove org', async () => {
      await orgModel.create({
        name: ORG_NAME,
        memberAccessType: MemberAccessType.OPEN,
      });

      const result = await deleteOrg(ORG_NAME, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

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
      await orgModel.create({
        name: NON_ASCII_ORG_NAME,
        memberAccessType: MemberAccessType.OPEN,
      });

      const result = await deleteOrg(ORG_NAME, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

      requireSuccessfulResult(result);
      const dbResult = await orgModel.exists({
        name: NON_ASCII_ORG_NAME,
      });
      expect(dbResult).not.toBeNull();
    });

    test('Record deletion errors should be propagated', async () => {
      await connection.close();

      const error = await getPromiseRejection(
        async () =>
          deleteOrg(ORG_NAME, {
            dbConnection: connection,
            logger: mockLogging.logger,
          }),
        Error,
      );

      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
    });
  });
});
