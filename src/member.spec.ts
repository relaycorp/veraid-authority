/* eslint-disable unicorn/text-encoding-identifier-case */
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging, type MockLogging, partialPinoLog } from './testUtils/logging.js';
import { MEMBER_EMAIL, MEMBER_NAME, NON_ASCII_MEMBER_NAME, ORG_NAME } from './testUtils/stubs.js';
import type { ServiceOptions } from './serviceTypes.js';
import { MemberModelSchema, Role } from './models/Member.model.js';
import { createMember, getMember } from './member.js';
import {
  type MemberSchema,
  type MemberSchemaRole,
  memberSchemaRoles,
} from './services/schema/member.schema.js';
import { ROLE_MAPPING } from './memberTypes.js';
import { requireFailureResult, requireSuccessfulResult } from './testUtils/result.js';
import { MemberProblemType } from './MemberProblemType.js';
import { getPromiseRejection } from './testUtils/jest.js';

describe('member', () => {
  const getConnection = setUpTestDbConnection();

  let mockLogging: MockLogging;
  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let memberModel: ReturnModelType<typeof MemberModelSchema>;
  const mongoId = '6424ad273f75645b35f9ee79';
  beforeEach(() => {
    mockLogging = makeMockLogging();
    connection = getConnection();
    serviceOptions = {
      dbConnection: connection,
      logger: mockLogging.logger,
    };
    memberModel = getModelForClass(MemberModelSchema, {
      existingConnection: connection,
    });
  });

  describe('createMember', () => {
    test.each(memberSchemaRoles)(
      'Minimum required data with role %s should be stored',
      async (memberSchemaRole: MemberSchemaRole) => {
        const member = await createMember(
          ORG_NAME,
          {
            role: memberSchemaRole,
          },
          serviceOptions,
        );

        const dbResult = await memberModel.findOne({
          orgName: ORG_NAME,
          role: ROLE_MAPPING[memberSchemaRole],
        });
        requireSuccessfulResult(member);
        expect(dbResult?.id).toStrictEqual(member.result.id);
        expect(mockLogging.logs).toContainEqual(
          partialPinoLog('info', 'Member created', { orgName: ORG_NAME }),
        );
      },
    );

    test.each([
      ['ASCII', MEMBER_NAME],
      ['Non ASCII', NON_ASCII_MEMBER_NAME],
    ])('%s name should be allowed', async (_type, name: string | undefined) => {
      const memberData: MemberSchema = {
        name,
        role: 'ORG_ADMIN',
      };

      const result = await createMember(ORG_NAME, memberData, serviceOptions);

      expect(result.didSucceed).toBeTrue();
    });

    test('Missing name should be inserted', async () => {
      const memberData: MemberSchema = {
        role: 'ORG_ADMIN',
      };

      const result = await createMember(ORG_NAME, memberData, serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await memberModel.findById(result.result.id);
      expect(dbResult?.name).toBeUndefined();
    });

    test('Malformed name should be refused', async () => {
      const malformedName = `${MEMBER_NAME}@`;
      const memberData: MemberSchema = {
        name: malformedName,
        role: 'ORG_ADMIN',
      };

      const result = await createMember(ORG_NAME, memberData, serviceOptions);

      requireFailureResult(result);
      expect(result.reason).toBe(MemberProblemType.MALFORMED_MEMBER_NAME);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused malformed member name', { name: malformedName }),
      );
    });

    test('Email should be allowed', async () => {
      const memberData: MemberSchema = {
        email: MEMBER_EMAIL,
        role: 'ORG_ADMIN',
      };

      const result = await createMember(ORG_NAME, memberData, serviceOptions);

      expect(result.didSucceed).toBeTrue();
    });

    test('Record creation errors should be propagated', async () => {
      await connection.close();
      const memberData: MemberSchema = {
        role: 'ORG_ADMIN',
      };

      const error = await getPromiseRejection(
        async () => createMember(ORG_NAME, memberData, serviceOptions),
        Error,
      );

      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
    });
  });

  describe('getMember', () => {
    test('Existing org name and member id should return the corresponding data', async () => {
      const member = await memberModel.create({
        orgName: ORG_NAME,
        role: Role.ORG_ADMIN,
      });

      const result = await getMember(ORG_NAME, member._id.toString(), serviceOptions);

      requireSuccessfulResult(result);
      expect(result.result).toMatchObject({
        role: 'ORG_ADMIN',
      });
    });

    test('Invalid org name should return non existing error', async () => {
      const member = await memberModel.create({
        orgName: ORG_NAME,
        role: Role.ORG_ADMIN,
      });

      const result = await getMember('INVALID_ORG_NAME', member._id.toString(), serviceOptions);

      requireFailureResult(result);
      expect(result.reason).toBe(MemberProblemType.MEMBER_NOT_FOUND);
    });

    test('Invalid member id should return non existing error', async () => {
      await memberModel.create({
        orgName: ORG_NAME,
        role: Role.ORG_ADMIN,
      });

      const result = await getMember(ORG_NAME, mongoId, serviceOptions);

      requireFailureResult(result);
      expect(result.reason).toBe(MemberProblemType.MEMBER_NOT_FOUND);
    });

    test('Record Find errors should be propagated', async () => {
      await connection.close();

      const error = await getPromiseRejection(
        async () => getMember(ORG_NAME, mongoId, serviceOptions),
        Error,
      );

      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
    });
  });
});
