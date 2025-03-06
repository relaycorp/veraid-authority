/* eslint-disable unicorn/text-encoding-identifier-case */
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection, HydratedDocument } from 'mongoose';

import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging, partialPinoLog } from './testUtils/logging.js';
import {
  AWALA_PEER_ID,
  MEMBER_EMAIL,
  MEMBER_MONGO_ID,
  MEMBER_NAME,
  MEMBER_PUBLIC_KEY_MONGO_ID,
  NON_ASCII_MEMBER_NAME,
  NON_ASCII_ORG_NAME,
  ORG_NAME,
  SIGNATURE,
  TEST_SERVICE_OID,
} from './testUtils/stubs.js';
import type { ServiceOptions } from './serviceTypes.js';
import { Member, Role } from './models/Member.model.js';
import {
  type MemberSchema,
  type MemberSchemaRole,
  memberSchemaRoles,
} from './schemas/member.schema.js';
import { requireFailureResult, requireSuccessfulResult } from './testUtils/result.js';
import { getPromiseRejection } from './testUtils/jest.js';
import { createMember, deleteMember, getMember, updateMember } from './member.js';
import { ROLE_MAPPING } from './memberTypes.js';
import { MemberProblem } from './MemberProblem.js';
import { MemberPublicKey } from './models/MemberPublicKey.model.js';
import { MemberBundleRequestModel } from './models/MemberBundleRequest.model.js';
import { generateKeyPair } from './testUtils/webcrypto.js';
import { derSerialisePublicKey } from './utilities/webcrypto.js';
import { MemberKeyImportToken } from './models/MemberKeyImportToken.model.js';

const { publicKey } = await generateKeyPair();
const publicKeyBuffer = await derSerialisePublicKey(publicKey);

describe('member', () => {
  const getConnection = setUpTestDbConnection();

  const mockLogging = makeMockLogging();
  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let memberModel: ReturnModelType<typeof Member>;
  beforeEach(() => {
    connection = getConnection();
    serviceOptions = {
      dbConnection: connection,
      logger: mockLogging.logger,
    };
    memberModel = getModelForClass(Member, {
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
          partialPinoLog('info', 'Member created', {
            orgName: ORG_NAME,
            memberId: member.result.id,
          }),
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
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member created', { userName: name }),
      );
    });

    test('Missing name should be set to null', async () => {
      const memberData: MemberSchema = {
        role: 'ORG_ADMIN',
      };

      const result = await createMember(ORG_NAME, memberData, serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await memberModel.findById(result.result.id);
      expect(dbResult?.name).toBeNull();
    });

    test('Null name should be set', async () => {
      const memberData: MemberSchema = {
        name: null,
        role: 'ORG_ADMIN',
      };

      const result = await createMember(ORG_NAME, memberData, serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await memberModel.findById(result.result.id);
      expect(dbResult?.name).toBeNull();
    });

    test('Duplicated name within different orgs should be allowed', async () => {
      const memberData: MemberSchema = {
        name: MEMBER_NAME,
        role: 'ORG_ADMIN',
      };

      await createMember(NON_ASCII_ORG_NAME, memberData, serviceOptions);
      const result = await createMember(ORG_NAME, memberData, serviceOptions);

      expect(result.didSucceed).toBeTrue();
    });

    test('Duplicated null name within one org should be allowed', async () => {
      const memberData: MemberSchema = {
        name: null,
        role: 'ORG_ADMIN',
      };

      await createMember(ORG_NAME, memberData, serviceOptions);
      const result = await createMember(ORG_NAME, memberData, serviceOptions);

      expect(result.didSucceed).toBeTrue();
    });

    test('Duplicated name within one org should be refused', async () => {
      const memberData: MemberSchema = {
        name: MEMBER_NAME,
        role: 'ORG_ADMIN',
      };

      await createMember(ORG_NAME, memberData, serviceOptions);
      const result = await createMember(ORG_NAME, memberData, serviceOptions);

      requireFailureResult(result);
      expect(result.context).toBe(MemberProblem.EXISTING_MEMBER_NAME);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused duplicated member name', {
          name: MEMBER_NAME,
        }),
      );
    });

    test('Malformed name should be refused', async () => {
      const malformedName = `${MEMBER_NAME}@`;
      const memberData: MemberSchema = {
        name: malformedName,
        role: 'ORG_ADMIN',
      };

      const result = await createMember(ORG_NAME, memberData, serviceOptions);

      requireFailureResult(result);
      expect(result.context).toBe(MemberProblem.MALFORMED_MEMBER_NAME);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused malformed member name', {
          name: malformedName,
        }),
      );
    });

    test('Email should be inserted', async () => {
      const memberData: MemberSchema = {
        email: MEMBER_EMAIL,
        role: 'ORG_ADMIN',
      };

      const result = await createMember(ORG_NAME, memberData, serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await memberModel.findById(result.result.id);
      expect(dbResult?.email).toBe(MEMBER_EMAIL);
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
      expect(result.context).toBe(MemberProblem.MEMBER_NOT_FOUND);
    });

    test('Invalid member id should return non existing error', async () => {
      await memberModel.create({
        orgName: ORG_NAME,
        role: Role.ORG_ADMIN,
      });

      const result = await getMember(ORG_NAME, MEMBER_MONGO_ID, serviceOptions);

      requireFailureResult(result);
      expect(result.context).toBe(MemberProblem.MEMBER_NOT_FOUND);
    });

    test('Record Find errors should be propagated', async () => {
      const member = await memberModel.create({
        orgName: ORG_NAME,
        role: Role.ORG_ADMIN,
      });
      await connection.close();

      const error = await getPromiseRejection(
        async () => getMember(ORG_NAME, member._id.toString(), serviceOptions),
        Error,
      );

      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
    });
  });

  describe('deleteMember', () => {
    test('Existing id should remove member', async () => {
      const member = await memberModel.create({
        role: Role.ORG_ADMIN,
        orgName: ORG_NAME,
      });

      const result = await deleteMember(member._id.toString(), serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await memberModel.findById(member._id);
      expect(dbResult).toBeNull();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member deleted', { memberId: member._id.toString() }),
      );
    });

    test('Non existing id should not remove any member', async () => {
      const member = await memberModel.create({
        role: Role.ORG_ADMIN,
        orgName: ORG_NAME,
      });

      const result = await deleteMember(MEMBER_MONGO_ID, serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await memberModel.findById(member._id);
      expect(dbResult).not.toBeNull();
    });

    test('Record deletion errors should be propagated', async () => {
      await connection.close();

      const error = await getPromiseRejection(
        async () => deleteMember(MEMBER_MONGO_ID, serviceOptions),
        Error,
      );
      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
    });

    describe('Related records', () => {
      let memberKeyImportTokenModel: ReturnModelType<typeof MemberKeyImportToken>;
      let memberBundleRequestModel: ReturnModelType<typeof MemberBundleRequestModel>;
      let memberPublicKeyModel: ReturnModelType<typeof MemberPublicKey>;
      let member: HydratedDocument<Member>;

      beforeEach(async () => {
        memberKeyImportTokenModel = getModelForClass(MemberKeyImportToken, {
          existingConnection: connection,
        });
        memberBundleRequestModel = getModelForClass(MemberBundleRequestModel, {
          existingConnection: connection,
        });
        memberPublicKeyModel = getModelForClass(MemberPublicKey, {
          existingConnection: connection,
        });
        member = await memberModel.create({
          role: Role.ORG_ADMIN,
          orgName: ORG_NAME,
        });
      });

      test('Related public keys should be removed', async () => {
        await memberPublicKeyModel.create({
          memberId: member.id,
          publicKey: publicKeyBuffer,
          serviceOid: TEST_SERVICE_OID,
        });
        await memberPublicKeyModel.create({
          memberId: member.id,
          publicKey: publicKeyBuffer,
          serviceOid: TEST_SERVICE_OID,
        });

        await deleteMember(member._id.toString(), serviceOptions);

        const memberPublicKeysCount = await memberPublicKeyModel.count();
        expect(memberPublicKeysCount).toBe(0);
      });

      test('Non related public keys should not be removed', async () => {
        const memberPublicKey = await memberPublicKeyModel.create({
          memberId: MEMBER_MONGO_ID,
          publicKey: publicKeyBuffer,
          serviceOid: TEST_SERVICE_OID,
        });

        await deleteMember(member._id.toString(), serviceOptions);

        const dbResult = await memberPublicKeyModel.findById(memberPublicKey._id);
        expect(dbResult).not.toBeNull();
      });

      test('Related key import tokens should be removed', async () => {
        await memberKeyImportTokenModel.create({
          memberId: member.id,
          serviceOid: TEST_SERVICE_OID,
        });
        await memberKeyImportTokenModel.create({
          memberId: member.id,
          serviceOid: TEST_SERVICE_OID,
        });

        await deleteMember(member._id.toString(), serviceOptions);

        const memberKeyImportTokenCount = await memberKeyImportTokenModel.count();
        expect(memberKeyImportTokenCount).toBe(0);
      });

      test('Non related key import tokens should not be removed', async () => {
        const memberKeyImportToken = await memberKeyImportTokenModel.create({
          memberId: MEMBER_MONGO_ID,
          serviceOid: TEST_SERVICE_OID,
        });

        await deleteMember(member._id.toString(), serviceOptions);

        const dbResult = await memberKeyImportTokenModel.findById(memberKeyImportToken._id);
        expect(dbResult).not.toBeNull();
      });

      test('Related member bundle requests should be removed', async () => {
        await memberBundleRequestModel.create({
          memberId: member.id,
          peerId: AWALA_PEER_ID,
          signature: Buffer.from(SIGNATURE, 'base64'),
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
          memberBundleStartDate: new Date(),
        });
        await memberBundleRequestModel.create({
          memberId: member.id,
          peerId: AWALA_PEER_ID,
          signature: Buffer.from(SIGNATURE, 'base64'),
          publicKeyId: '111111111111111111111111',
          memberBundleStartDate: new Date(),
        });

        await deleteMember(member._id.toString(), serviceOptions);

        const memberBundleRequestCount = await memberBundleRequestModel.count();
        expect(memberBundleRequestCount).toBe(0);
      });

      test('Non related member bundle requests should not be removed', async () => {
        const memberBundleRequest = await memberBundleRequestModel.create({
          memberId: MEMBER_MONGO_ID,
          peerId: AWALA_PEER_ID,
          signature: Buffer.from(SIGNATURE, 'base64'),
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
          memberBundleStartDate: new Date(),
        });

        await deleteMember(member._id.toString(), serviceOptions);

        const dbResult = await memberBundleRequestModel.findById(memberBundleRequest._id);
        expect(dbResult).not.toBeNull();
      });
    });
  });

  describe('updateMember', () => {
    const testEmail = 'different@email.com';

    test('Valid data should be updated', async () => {
      const member = await memberModel.create({
        name: MEMBER_NAME,
        orgName: ORG_NAME,
        role: Role.ORG_ADMIN,
        email: MEMBER_EMAIL,
      });

      await updateMember(
        member._id.toString(),
        {
          name: NON_ASCII_MEMBER_NAME,
          role: 'REGULAR',
          email: testEmail,
        },
        serviceOptions,
      );

      const dbResult = await memberModel.findById(member._id);
      expect(dbResult?.orgName).toBe(ORG_NAME);
      expect(dbResult?.name).toBe(NON_ASCII_MEMBER_NAME);
      expect(dbResult?.role).toBe(Role.REGULAR);
      expect(dbResult?.email).toBe(testEmail);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member updated', {
          memberId: member._id.toString(),
        }),
      );
    });

    test('Empty data should be accepted and nothing should be updated', async () => {
      const member = await memberModel.create({
        name: MEMBER_NAME,
        orgName: ORG_NAME,
        role: Role.ORG_ADMIN,
        email: MEMBER_EMAIL,
      });

      await updateMember(member._id.toString(), {}, serviceOptions);

      const dbResult = await memberModel.findById(member._id);
      expect(dbResult?.orgName).toBe(ORG_NAME);
      expect(dbResult?.name).toBe(MEMBER_NAME);
      expect(dbResult?.role).toBe(Role.ORG_ADMIN);
      expect(dbResult?.email).toBe(MEMBER_EMAIL);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member updated', {
          memberId: member._id.toString(),
        }),
      );
    });

    test('Null name should be set', async () => {
      const member = await memberModel.create({
        name: MEMBER_NAME,
        orgName: ORG_NAME,
        role: Role.ORG_ADMIN,
      });

      const result = await updateMember(
        member._id.toString(),
        {
          name: null,
        },
        serviceOptions,
      );

      expect(result.didSucceed).toBeTrue();
      const dbResult = await memberModel.findById(member._id);
      expect(dbResult!.name).toBeNull();
    });

    test('Duplicated name within different orgs should be allowed', async () => {
      const member = await memberModel.create({
        name: MEMBER_NAME,
        orgName: ORG_NAME,
        role: Role.ORG_ADMIN,
      });
      await memberModel.create({
        name: NON_ASCII_MEMBER_NAME,
        orgName: NON_ASCII_ORG_NAME,
        role: Role.ORG_ADMIN,
      });

      const result = await updateMember(
        member._id.toString(),
        {
          name: NON_ASCII_MEMBER_NAME,
        },
        serviceOptions,
      );

      expect(result.didSucceed).toBeTrue();
    });

    test('Multiple null name within one org should be allowed', async () => {
      const member = await memberModel.create({
        name: MEMBER_NAME,
        orgName: ORG_NAME,
        role: Role.ORG_ADMIN,
      });
      await memberModel.create({
        name: null,
        orgName: ORG_NAME,
        role: Role.ORG_ADMIN,
      });

      const result = await updateMember(
        member._id.toString(),
        {
          name: null,
        },
        serviceOptions,
      );

      requireSuccessfulResult(result);
      expect(result.didSucceed).toBeTrue();
    });

    test('Duplicated name within one org should be refused', async () => {
      const member = await memberModel.create({
        name: MEMBER_NAME,
        orgName: ORG_NAME,
        role: Role.ORG_ADMIN,
      });
      await memberModel.create({
        name: NON_ASCII_MEMBER_NAME,
        orgName: ORG_NAME,
        role: Role.ORG_ADMIN,
      });

      const result = await updateMember(
        member._id.toString(),
        {
          name: NON_ASCII_MEMBER_NAME,
        },
        serviceOptions,
      );

      requireFailureResult(result);
      expect(result.context).toBe(MemberProblem.EXISTING_MEMBER_NAME);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused duplicated member name', {
          name: NON_ASCII_MEMBER_NAME,
        }),
      );
    });

    test('Malformed name should be refused', async () => {
      const malformedName = `${MEMBER_NAME}@`;
      const member = await memberModel.create({
        name: MEMBER_NAME,
        orgName: ORG_NAME,
        role: Role.ORG_ADMIN,
      });

      const result = await updateMember(
        member._id.toString(),
        {
          name: malformedName,
        },
        serviceOptions,
      );

      requireFailureResult(result);
      expect(result.context).toBe(MemberProblem.MALFORMED_MEMBER_NAME);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused malformed member name', {
          name: malformedName,
        }),
      );
    });

    test.each(memberSchemaRoles)(
      'Role ORG_ADMIN should be allowed',
      async (memberSchemaRole: MemberSchemaRole) => {
        const member = await memberModel.create({
          orgName: ORG_NAME,
          role: ROLE_MAPPING[memberSchemaRole],
        });

        const response = await updateMember(
          member._id.toString(),
          {
            role: memberSchemaRole,
          },
          serviceOptions,
        );

        expect(response.didSucceed).toBeTrue();
      },
    );

    test('Duplicated email within one org should be allowed', async () => {
      const member = await memberModel.create({
        name: MEMBER_NAME,
        orgName: ORG_NAME,
        role: Role.ORG_ADMIN,
        email: testEmail,
      });
      await memberModel.create({
        name: NON_ASCII_MEMBER_NAME,
        orgName: NON_ASCII_ORG_NAME,
        role: Role.ORG_ADMIN,
        email: MEMBER_EMAIL,
      });

      const result = await updateMember(
        member._id.toString(),
        {
          email: MEMBER_EMAIL,
        },
        serviceOptions,
      );

      expect(result.didSucceed).toBeTrue();
    });

    test('Null email should be set', async () => {
      const member = await memberModel.create({
        email: MEMBER_EMAIL,
        orgName: ORG_NAME,
        role: Role.ORG_ADMIN,
      });

      const result = await updateMember(
        member._id.toString(),
        {
          email: null,
        },
        serviceOptions,
      );

      expect(result.didSucceed).toBeTrue();
      const dbResult = await memberModel.findById(member._id);
      expect(dbResult?.email).toBeNull();
    });

    test('Update errors should be propagated', async () => {
      await connection.close();

      const error = await getPromiseRejection(
        async () => updateMember(MEMBER_MONGO_ID, {}, serviceOptions),
        Error,
      );
      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
    });
  });
});
