import { getModelForClass } from '@typegoose/typegoose';

import { MemberAccessType, OrgModelSchema } from './models/Org.model.js';
import { createOrg, getOrg, updateOrg } from './org.js';
import type { OrgSchema } from './services/schema/org.schema.js';
import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging, type MockLogging, partialPinoLog } from './testUtils/logging.js';
import { requireFailureResult, requireSuccessfulResult } from './testUtils/result.js';
import { AWALA_ENDPOINT, ORG_NAME } from './testUtils/stubs.js';
import { getPromiseRejection } from './testUtils/jest.js';
import { OrgProblemType } from './OrgProblemType.js';
import type { ServiceOptions } from './orgTypes.js';

describe('org', () => {
  const getConnection = setUpTestDbConnection();

  let mockLogging: MockLogging;
  beforeEach(() => {
    mockLogging = makeMockLogging();
  });

  describe('createOrg', () => {
    test('Minimum required data should be stored', async () => {
      const connection = getConnection();
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
      };

      await createOrg(orgData, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

      const orgModel = getModelForClass(OrgModelSchema, {
        existingConnection: connection,
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
      const connection = getConnection();
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
      const connection = getConnection();
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
      const connection = getConnection();
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
      };

      const methodResult = await createOrg(orgData, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

      const orgModel = getModelForClass(OrgModelSchema, {
        existingConnection: connection,
      });
      requireSuccessfulResult(methodResult);

      const dbResult = await orgModel.findOne({
        name: methodResult.result.name,
      });
      expect(dbResult?.memberAccessType).toBe(MemberAccessType.INVITE_ONLY);
    });

    test('OPEN access type should be allowed', async () => {
      const connection = getConnection();
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'OPEN',
      };

      const methodResult = await createOrg(orgData, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

      const orgModel = getModelForClass(OrgModelSchema, {
        existingConnection: connection,
      });
      requireSuccessfulResult(methodResult);
      const dbResult = await orgModel.findOne({
        name: methodResult.result.name,
      });
      expect(dbResult?.memberAccessType).toBe(MemberAccessType.OPEN);
    });

    test('Any Awala endpoint should be stored', async () => {
      const connection = getConnection();
      const orgData: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'OPEN',
        awalaEndpoint: AWALA_ENDPOINT,
      };

      const methodResult = await createOrg(orgData, {
        dbConnection: connection,
        logger: mockLogging.logger,
      });

      const orgModel = getModelForClass(OrgModelSchema, {
        existingConnection: connection,
      });
      requireSuccessfulResult(methodResult);
      const dbResult = await orgModel.findOne({
        name: methodResult.result.name,
      });
      expect(dbResult?.awalaEndpoint).toBe(AWALA_ENDPOINT);
    });

    test('Non ASCII Awala endpoint should be allowed', async () => {
      const connection = getConnection();
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
      const connection = getConnection();
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
      const connection = getConnection();
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
      const orgModel = getModelForClass(OrgModelSchema, {
        existingConnection: connection,
      });
      const dbResult = await orgModel.findOne({
        name: methodResult.result.name,
      });
      expect(methodResult.result.name).toStrictEqual(dbResult?.name);
    });

    test('Clash with existing name should be refused', async () => {
      const connection = getConnection();
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
      const connection = getConnection();
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
    test('Valid data should be allowed and updated', async () => {
      const connection = getConnection();
      const orgModel = getModelForClass(OrgModelSchema, {
        existingConnection: connection,
      });
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
    });

    test('matching ASCII name should be allowed', async () => {
      const connection = getConnection();
      const orgModel = getModelForClass(OrgModelSchema, {
        existingConnection: connection,
      });
      await orgModel.create({
        name: ORG_NAME,
        memberAccessType: MemberAccessType.INVITE_ONLY,
      });

      const response = await updateOrg(
        ORG_NAME,
        {
          name: ORG_NAME,
        },
        {
          dbConnection: connection,
          logger: mockLogging.logger,
        },
      );

      expect(response.didSucceed).toBeTrue();
    });

    test('matching Non ASCII name should be allowed', async () => {
      const connection = getConnection();
      const nonAsciiAwalaEndpoint = 'はじめよう.みんな';
      const orgModel = getModelForClass(OrgModelSchema, {
        existingConnection: connection,
      });
      await orgModel.create({
        name: nonAsciiAwalaEndpoint,
        memberAccessType: MemberAccessType.INVITE_ONLY,
      });

      const response = await updateOrg(
        nonAsciiAwalaEndpoint,
        {
          name: nonAsciiAwalaEndpoint,
        },
        {
          dbConnection: connection,
          logger: mockLogging.logger,
        },
      );

      expect(response.didSucceed).toBeTrue();
    });

    test('Non existing name should not be refused', async () => {
      const connection = getConnection();

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

    test('INVITE_ONLY access type should be allowed', async () => {
      const connection = getConnection();
      const orgModel = getModelForClass(OrgModelSchema, {
        existingConnection: connection,
      });
      await orgModel.create({
        name: ORG_NAME,
        memberAccessType: MemberAccessType.INVITE_ONLY,
      });

      const response = await updateOrg(
        ORG_NAME,
        {
          memberAccessType: 'INVITE_ONLY',
        },
        {
          dbConnection: connection,
          logger: mockLogging.logger,
        },
      );

      expect(response.didSucceed).toBeTrue();
    });

    test('OPEN access type should be allowed', async () => {
      const connection = getConnection();
      const orgModel = getModelForClass(OrgModelSchema, {
        existingConnection: connection,
      });
      await orgModel.create({
        name: ORG_NAME,
        memberAccessType: MemberAccessType.OPEN,
      });

      const response = await updateOrg(
        ORG_NAME,
        {
          memberAccessType: 'OPEN',
        },
        {
          dbConnection: connection,
          logger: mockLogging.logger,
        },
      );

      expect(response.didSucceed).toBeTrue();
    });

    test('ASCII Awala endpoint should be allowed', async () => {
      const connection = getConnection();
      const orgModel = getModelForClass(OrgModelSchema, {
        existingConnection: connection,
      });
      await orgModel.create({
        name: ORG_NAME,
        memberAccessType: MemberAccessType.OPEN,
        awalaEndpoint: `a.${AWALA_ENDPOINT}`,
      });

      const response = await updateOrg(
        ORG_NAME,
        {
          awalaEndpoint: AWALA_ENDPOINT,
        },
        {
          dbConnection: connection,
          logger: mockLogging.logger,
        },
      );

      expect(response.didSucceed).toBeTrue();
    });

    test('non ASCII Awala endpoint should be allowed', async () => {
      const connection = getConnection();
      const nonAsciiAwalaEndpoint = 'はじめよう.みんな';
      const orgModel = getModelForClass(OrgModelSchema, {
        existingConnection: connection,
      });
      await orgModel.create({
        name: ORG_NAME,
        memberAccessType: MemberAccessType.OPEN,
        awalaEndpoint: nonAsciiAwalaEndpoint,
      });

      const response = await updateOrg(
        ORG_NAME,
        {
          awalaEndpoint: nonAsciiAwalaEndpoint,
        },
        {
          dbConnection: connection,
          logger: mockLogging.logger,
        },
      );

      expect(response.didSucceed).toBeTrue();
    });

    test('Non ASCII Awala endpoint should be allowed and be updated', async () => {
      const connection = getConnection();
      const nonAsciiAwalaEndpoint = 'はじめよう.みんな';
      const orgModel = getModelForClass(OrgModelSchema, {
        existingConnection: connection,
      });
      await orgModel.create({
        name: ORG_NAME,
        memberAccessType: MemberAccessType.OPEN,
        awalaEndpoint: AWALA_ENDPOINT,
      });

      await updateOrg(
        ORG_NAME,
        {
          name: ORG_NAME,
          memberAccessType: 'INVITE_ONLY',
          awalaEndpoint: nonAsciiAwalaEndpoint,
        },
        {
          dbConnection: connection,
          logger: mockLogging.logger,
        },
      );

      const dbResult = await orgModel.exists({
        name: ORG_NAME,
        memberAccessType: MemberAccessType.INVITE_ONLY,
        awalaEndpoint: nonAsciiAwalaEndpoint,
      });
      expect(dbResult).not.toBeNull();
    });

    test('Malformed name should be refused', async () => {
      const connection = getConnection();

      const result = await updateOrg(
        'INVALID_Name',
        {
          name: 'INVALID_Name',
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
      const connection = getConnection();

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

    test('Malformed Awala endpoint should be refused', async () => {
      const connection = getConnection();

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
      const connection = getConnection();
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

    describe('getOrg', () => {
      test('valid name should return the corresponding data', async () => {
        const connection = getConnection();
        const orgModel = getModelForClass(OrgModelSchema, {
          existingConnection: connection,
        });
        await orgModel.create({
          name: ORG_NAME,
          memberAccessType: MemberAccessType.OPEN,
          awalaEndpoint: AWALA_ENDPOINT,
        });

        const methodResponse = await getOrg(ORG_NAME, {
          dbConnection: connection,
          logger: mockLogging.logger,
        });

        requireSuccessfulResult(methodResponse);
        expect(methodResponse.result).toMatchObject({
          name: ORG_NAME,
          memberAccessType: 'OPEN',
          awalaEndpoint: AWALA_ENDPOINT,
        });
      });

      test('invalid name should return NOT_FOUND error', async () => {
        const connection = getConnection();

        const methodResponse = await getOrg(ORG_NAME, {
          dbConnection: connection,
          logger: mockLogging.logger,
        });

        requireFailureResult(methodResponse);
        expect(methodResponse.reason).toBe(OrgProblemType.ORG_NOT_FOUND);
      });

      test('find errors should be propagated', async () => {
        const connection = getConnection();
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
  });
});
