import { jest } from '@jest/globals';
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import { VeraidDnssecChain } from '@relaycorp/veraid';
import type { Connection, HydratedDocument } from 'mongoose';
import { addDays, addSeconds, setMilliseconds } from 'date-fns';

import { Org } from '../organisations/Org.model.js';
import { setUpTestDbConnection } from '../../testUtils/db.js';
import { makeMockLogging, partialPinoLog } from '../../testUtils/logging.js';
import {
  AWALA_PEER_ID,
  MEMBER_ID,
  MEMBER_NAME,
  MEMBER_PUBLIC_KEY_MONGO_ID,
  ORG_NAME,
  SIGNATURE,
  TEST_SERVICE_OID,
} from '../../testUtils/stubs.js';
import type { ServiceOptions } from '../../utilities/serviceTypes.js';
import { derSerialisePublicKey } from '../../utilities/webcrypto.js';
import { Member, Role } from '../members/Member.model.js';
import { generateKeyPair } from '../../testUtils/webcrypto.js';
import { mockKms } from '../../testUtils/kms/mockKms.js';
import { requireFailureResult, requireSuccessfulResult } from '../../testUtils/result.js';
import { stringToArrayBuffer } from '../../testUtils/buffer.js';
import { mockSpy } from '../../testUtils/jest.js';
import type { MemberBundleRequest } from '../../servers/awala/awala.schema.js';

import { MemberPublicKey } from './MemberPublicKey.model.js';
import { MemberBundleRequestModel } from './MemberBundleRequest.model.js';
import { generateMemberBundle, createMemberBundleRequest } from './memberBundle.js';

const CERTIFICATE_EXPIRY_DAYS = 90;
const { publicKey: testPublicKey } = await generateKeyPair();
const testPublicKeyBuffer = await derSerialisePublicKey(testPublicKey);

describe('memberBundle', () => {
  const getConnection = setUpTestDbConnection();
  const getMockKms = mockKms();

  const mockLogging = makeMockLogging();

  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let orgModel: ReturnModelType<typeof Org>;
  let memberModel: ReturnModelType<typeof Member>;
  let memberPublicKeyModel: ReturnModelType<typeof MemberPublicKey>;
  let memberPublicKeyBuffer: Buffer;
  let orgPrivateKeyRef: Buffer;
  let orgPublicKey: Buffer;

  beforeEach(async () => {
    const { kms } = getMockKms();
    const { publicKey: orgPublicCryptoKey, privateKey: orgPrivateCryptoKey } =
      await kms.generateKeyPair();

    orgPrivateKeyRef = await kms.getPrivateKeyRef(orgPrivateCryptoKey);
    orgPublicKey = await derSerialisePublicKey(orgPublicCryptoKey);

    const { publicKey: memberPublicCryptoKey } = await generateKeyPair();
    memberPublicKeyBuffer = await derSerialisePublicKey(memberPublicCryptoKey);

    connection = getConnection();
    serviceOptions = {
      dbConnection: connection,
      logger: mockLogging.logger,
    };
    orgModel = getModelForClass(Org, {
      existingConnection: connection,
    });
    memberModel = getModelForClass(Member, {
      existingConnection: connection,
    });
    memberPublicKeyModel = getModelForClass(MemberPublicKey, {
      existingConnection: connection,
    });
  });

  describe('createMemberBundleRequest', () => {
    let memberBundleRequestModel: ReturnModelType<typeof MemberBundleRequestModel>;
    let memberPublicKey: HydratedDocument<MemberPublicKey>;
    let futureTimestamp: string;
    let methodInput: MemberBundleRequest;
    beforeEach(async () => {
      memberBundleRequestModel = getModelForClass(MemberBundleRequestModel, {
        existingConnection: connection,
      });

      memberPublicKey = await memberPublicKeyModel.create({
        memberId: MEMBER_ID,
        serviceOid: TEST_SERVICE_OID,
        publicKey: testPublicKeyBuffer,
      });

      futureTimestamp = addSeconds(new Date(), 5).toISOString();
      methodInput = {
        publicKeyId: memberPublicKey._id.toString(),
        memberBundleStartDate: futureTimestamp,
        peerId: AWALA_PEER_ID,
        signature: SIGNATURE,
      };
    });

    test('Valid data should be accepted and stored', async () => {
      const result = await createMemberBundleRequest(methodInput, serviceOptions);

      const dbResult = await memberBundleRequestModel.findOne({
        publicKeyId: memberPublicKey._id.toString(),
      });
      expect(result).toStrictEqual({
        didSucceed: true,
      });
      expect(dbResult).not.toBeNull();
      expect(dbResult!.memberId).toBe(MEMBER_ID);
      expect(dbResult!.peerId).toBe(AWALA_PEER_ID);
      expect(dbResult!.signature.toString('base64')).toBe(SIGNATURE);
      expect(dbResult!.memberBundleStartDate).toBeDate();
      expect(dbResult!.memberBundleStartDate.toISOString()).toBe(futureTimestamp);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member bundle request created', {
          memberPublicKeyId: memberPublicKey._id.toString(),
        }),
      );
    });

    test('Member bundle data should be updated', async () => {
      const data = {
        publicKeyId: memberPublicKey._id.toString(),
        memberBundleStartDate: new Date(),
        signature: 'test',
        peerId: 'test',
        memberId: MEMBER_ID,
      };
      await memberBundleRequestModel.create(data);

      await createMemberBundleRequest(methodInput, serviceOptions);
      const dbResult = await memberBundleRequestModel.findOne({
        publicKeyId: memberPublicKey._id.toString(),
      });
      expect(dbResult).not.toBeNull();
      expect(dbResult!.memberId).toBe(MEMBER_ID);
      expect(dbResult!.peerId).toBe(AWALA_PEER_ID);
      expect(dbResult!.signature.toString('base64')).toBe(SIGNATURE);
      expect(dbResult!.memberBundleStartDate).toBeDate();
      expect(dbResult!.memberBundleStartDate.toISOString()).toBe(futureTimestamp);
    });

    test('Existing data should not create new entry', async () => {
      await memberBundleRequestModel.create({
        ...methodInput,
        memberId: MEMBER_ID,
      });

      await createMemberBundleRequest(methodInput, serviceOptions);

      const countResult = await memberBundleRequestModel.count({
        publicKeyId: memberPublicKey._id.toString(),
      });
      expect(countResult).toBe(1);
    });

    test('Non existing public key id should be refused', async () => {
      const result = await createMemberBundleRequest(
        {
          ...methodInput,
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        },
        serviceOptions,
      );

      expect(result.didSucceed).not.toBeTrue();
      const dbResult = await memberBundleRequestModel.exists({
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      });
      expect(dbResult).toBeNull();
    });
  });

  describe('generateMemberBundle', () => {
    const mockDnssecChainRetrieve = mockSpy(jest.spyOn(VeraidDnssecChain, 'retrieve'));

    const mockDnssecChain = new VeraidDnssecChain(ORG_NAME, [stringToArrayBuffer(ORG_NAME)]);
    beforeEach(() => {
      mockDnssecChainRetrieve.mockResolvedValue(mockDnssecChain);
    });

    describe('Valid data should generate member bundle', () => {
      let botPublicKey: HydratedDocument<MemberPublicKey>;
      beforeEach(async () => {
        await orgModel.create({
          name: ORG_NAME,
          privateKeyRef: orgPrivateKeyRef,
          publicKey: orgPublicKey,
        });
        const member = await memberModel.create({
          orgName: ORG_NAME,
          name: MEMBER_NAME,
          role: Role.REGULAR,
        });
        botPublicKey = await memberPublicKeyModel.create({
          memberId: member.id,
          publicKey: memberPublicKeyBuffer,
          serviceOid: TEST_SERVICE_OID,
        });
      });

      test('KMS should be initialised', async () => {
        await generateMemberBundle(botPublicKey._id.toString(), serviceOptions);

        const { kmsInitMock } = getMockKms();
        expect(kmsInitMock).toHaveBeenCalledOnce();
      });

      describe('Self issued organisation certificate', () => {
        test('Should be issued with existing org name', async () => {
          const result = await generateMemberBundle(botPublicKey._id.toString(), serviceOptions);

          requireSuccessfulResult(result);
          const { orgCertificate } = result.result;
          expect(orgCertificate.commonName).toBe(ORG_NAME);
        });

        test('Should be issued with org private and public keys', async () => {
          const result = await generateMemberBundle(botPublicKey._id.toString(), serviceOptions);

          requireSuccessfulResult(result);
          const { orgCertificate } = result.result;
          await expect(
            derSerialisePublicKey(await orgCertificate.getPublicKey()),
          ).resolves.toStrictEqual(orgPublicKey);

          // Can't check the use of the private key per se, but we can check the certification path
          await expect(
            orgCertificate.getCertificationPath([], [orgCertificate]),
          ).resolves.toHaveLength(2);
        });

        test('Should be valid at the time of generation', async () => {
          const startDate = setMilliseconds(new Date(), 0);

          const result = await generateMemberBundle(botPublicKey._id.toString(), serviceOptions);

          requireSuccessfulResult(result);
          const { orgCertificate } = result.result;
          expect(orgCertificate.validityPeriod.start).toBeBetween(startDate, new Date());
        });

        test('Should expire in 90 days', async () => {
          const startDate = setMilliseconds(new Date(), 0);

          const result = await generateMemberBundle(botPublicKey._id.toString(), serviceOptions);

          requireSuccessfulResult(result);
          const { orgCertificate } = result.result;
          expect(orgCertificate.validityPeriod.end).toBeBetween(
            addDays(startDate, CERTIFICATE_EXPIRY_DAYS),
            addDays(new Date(), CERTIFICATE_EXPIRY_DAYS),
          );
        });
      });

      describe('Issued Member Certificate', () => {
        test('Should be issued using the correct member name', async () => {
          const result = await generateMemberBundle(botPublicKey._id.toString(), serviceOptions);

          requireSuccessfulResult(result);
          const { memberCertificate } = result.result;
          expect(memberCertificate.commonName).toBe(MEMBER_NAME);
        });

        test('Should be issued with member public key', async () => {
          const result = await generateMemberBundle(botPublicKey._id.toString(), serviceOptions);

          requireSuccessfulResult(result);
          const { memberCertificate } = result.result;
          await expect(
            derSerialisePublicKey(await memberCertificate.getPublicKey()),
          ).resolves.toStrictEqual(memberPublicKeyBuffer);
        });

        test('Should be issued with org self signed certificate', async () => {
          const result = await generateMemberBundle(botPublicKey._id.toString(), serviceOptions);

          requireSuccessfulResult(result);
          const { memberCertificate, orgCertificate } = result.result;
          await expect(
            memberCertificate.getCertificationPath([], [orgCertificate]),
          ).resolves.toHaveLength(2);
        });

        test('Should be valid at the time of generation', async () => {
          const startDate = setMilliseconds(new Date(), 0);

          const result = await generateMemberBundle(botPublicKey._id.toString(), serviceOptions);

          requireSuccessfulResult(result);
          const { memberCertificate } = result.result;
          expect(memberCertificate.validityPeriod.start).toBeBetween(startDate, new Date());
        });

        test('Should expire in 90 days', async () => {
          const startDate = setMilliseconds(new Date(), 0);

          const result = await generateMemberBundle(botPublicKey._id.toString(), serviceOptions);

          requireSuccessfulResult(result);
          const { memberCertificate } = result.result;
          expect(memberCertificate.validityPeriod.end).toBeBetween(
            addDays(startDate, CERTIFICATE_EXPIRY_DAYS),
            addDays(new Date(), CERTIFICATE_EXPIRY_DAYS),
          );
        });
      });

      test('Dnssec chain should be retrieved with org name', async () => {
        const result = await generateMemberBundle(botPublicKey._id.toString(), serviceOptions);

        requireSuccessfulResult(result);
        const { dnssecChain } = result.result;
        expect(dnssecChain.domainName).toBe(ORG_NAME);
      });

      test('Member bundle for member without name should output bot certificate', async () => {
        const botMember = await memberModel.create({
          orgName: ORG_NAME,
          role: Role.REGULAR,
        });
        botPublicKey = await memberPublicKeyModel.create({
          memberId: botMember.id,
          publicKey: memberPublicKeyBuffer,
          serviceOid: TEST_SERVICE_OID,
        });

        const result = await generateMemberBundle(botPublicKey._id.toString(), serviceOptions);

        requireSuccessfulResult(result);
        const { memberCertificate } = result.result;
        expect(memberCertificate.commonName).toBe('@');
      });
    });

    test('Invalid member public key should fail', async () => {
      const result = await generateMemberBundle(MEMBER_PUBLIC_KEY_MONGO_ID, serviceOptions);

      requireFailureResult(result);
      expect(result.context.chainRetrievalFailed).not.toBeTrue();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member public key not found', {
          memberPublicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        }),
      );
    });

    test('Missing member should fail', async () => {
      const memberPublicKey = await memberPublicKeyModel.create({
        memberId: MEMBER_ID,
        publicKey: memberPublicKeyBuffer,
        serviceOid: TEST_SERVICE_OID,
      });
      const result = await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

      requireFailureResult(result);
      expect(result.context.chainRetrievalFailed).not.toBeTrue();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member not found', { memberId: MEMBER_ID }),
      );
    });

    test('Missing org should fail', async () => {
      const member = await memberModel.create({
        orgName: ORG_NAME,
        name: MEMBER_NAME,
        role: Role.REGULAR,
      });
      const memberPublicKey = await memberPublicKeyModel.create({
        memberId: member._id,
        publicKey: memberPublicKeyBuffer,
        serviceOid: TEST_SERVICE_OID,
      });
      const result = await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

      requireFailureResult(result);
      expect(result.context.chainRetrievalFailed).not.toBeTrue();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Org not found', { orgName: ORG_NAME }),
      );
    });

    describe('Retrieving DNSSEC chain error', () => {
      let memberPublicKeyId: string;
      beforeEach(async () => {
        await orgModel.create({
          name: ORG_NAME,
          privateKeyRef: orgPrivateKeyRef,
          publicKey: orgPublicKey,
        });
        const member = await memberModel.create({
          orgName: ORG_NAME,
          name: MEMBER_NAME,
          role: Role.REGULAR,
        });
        const memberPublicKey = await memberPublicKeyModel.create({
          memberId: member.id,
          publicKey: memberPublicKeyBuffer,
          serviceOid: TEST_SERVICE_OID,
        });
        memberPublicKeyId = memberPublicKey._id.toString();
      });

      test('Should mark retrieval as failed', async () => {
        const error = new Error('Oh noes');
        mockDnssecChainRetrieve.mockRejectedValueOnce(error);

        const result = await generateMemberBundle(memberPublicKeyId, serviceOptions);

        requireFailureResult(result);
        expect(result.context.chainRetrievalFailed).toBeTrue();
        expect(mockLogging.logs).toContainEqual(
          partialPinoLog('warn', 'Failed to retrieve DNSSEC chain', {
            memberPublicKeyId,
            err: expect.objectContaining({ message: error.message }),
          }),
        );
      });

      test('Should not initialise KMS', async () => {
        const error = new Error('Oh noes');
        mockDnssecChainRetrieve.mockRejectedValueOnce(error);

        await generateMemberBundle(memberPublicKeyId, serviceOptions);

        const { kmsInitMock } = getMockKms();
        expect(kmsInitMock).not.toHaveBeenCalled();
      });
    });
  });
});
