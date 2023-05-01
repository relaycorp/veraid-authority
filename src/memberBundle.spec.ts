import { jest } from '@jest/globals';
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection, HydratedDocument } from 'mongoose';
import { addDays, addSeconds, subSeconds } from 'date-fns';

import type { Kms } from './utilities/kms/Kms.js';
import { mockedVeraidModule } from './testUtils/veraid.mock.js';
import { OrgModelSchema } from './models/Org.model.js';
import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging, partialPinoLog } from './testUtils/logging.js';
import {
  MEMBER_MONGO_ID,
  MEMBER_NAME,
  MEMBER_PUBLIC_KEY_MONGO_ID,
  ORG_NAME,
  TEST_SERVICE_OID,
} from './testUtils/stubs.js';
import type { ServiceOptions } from './serviceTypes.js';
import { derSerialisePublicKey } from './utilities/webcrypto.js';
import { MemberModelSchema, Role } from './models/Member.model.js';
import { MemberPublicKeyModelSchema } from './models/MemberPublicKey.model.js';
import { generateKeyPair } from './testUtils/webcrypto.js';
import { type MockKms, mockKms } from './testUtils/kms/mockKms.js';
import { requireFailureResult, requireSuccessfulResult } from './testUtils/result.js';
import { stringToArrayBuffer } from './testUtils/buffer.js';

import SpiedFunction = jest.SpiedFunction;

const { generateMemberBundle } = await import('./memberBundle.js');
const {
  selfIssueOrganisationCertificate,
  issueMemberCertificate,
  retrieveVeraDnssecChain,
  serialiseMemberIdBundle,
} = mockedVeraidModule;

const CERTIFICATE_EXPIRY_DAYS = 90;

describe('memberBundle', () => {
  const getConnection = setUpTestDbConnection();
  const getMockKms = mockKms();
  let kms: MockKms;
  let kmsInitMock: SpiedFunction<() => Promise<Kms>>;

  const mockLogging = makeMockLogging();

  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let orgModel: ReturnModelType<typeof OrgModelSchema>;
  let memberModel: ReturnModelType<typeof MemberModelSchema>;
  let memberPublicKeyModel: ReturnModelType<typeof MemberPublicKeyModelSchema>;
  let memberPublicKeyBuffer: Buffer;
  let orgPrivateKeyRef: Buffer;
  let orgPublicKey: Buffer;
  let certificateValidTill: Date;

  beforeEach(async () => {
    certificateValidTill = addDays(new Date(), CERTIFICATE_EXPIRY_DAYS);
    ({ kms, kmsInitMock } = getMockKms());
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
    orgModel = getModelForClass(OrgModelSchema, {
      existingConnection: connection,
    });
    memberModel = getModelForClass(MemberModelSchema, {
      existingConnection: connection,
    });
    memberPublicKeyModel = getModelForClass(MemberPublicKeyModelSchema, {
      existingConnection: connection,
    });
  });

  describe('generateMemberBundle', () => {
    describe('Valid data should generate member bundle', () => {
      let selfIssueCertificateResult: ArrayBuffer;
      let issueMemberCertificateResult: ArrayBuffer;
      let retrieveVeraDnssecChainResult: ArrayBuffer;
      let serialiseMemberIdBundleResult: ArrayBuffer;
      let memberPublicKey: HydratedDocument<MemberPublicKeyModelSchema>;

      beforeEach(async () => {
        selfIssueCertificateResult = stringToArrayBuffer('selfIssueCertificateResult');
        selfIssueOrganisationCertificate.mockResolvedValueOnce(selfIssueCertificateResult);
        issueMemberCertificateResult = stringToArrayBuffer('issueMemberCertificateResult');
        issueMemberCertificate.mockResolvedValueOnce(issueMemberCertificateResult);
        retrieveVeraDnssecChainResult = stringToArrayBuffer('retrieveVeraDnssecChainResult');
        retrieveVeraDnssecChain.mockResolvedValueOnce(retrieveVeraDnssecChainResult);
        serialiseMemberIdBundleResult = stringToArrayBuffer('serialiseMemberIdBundleResult');
        serialiseMemberIdBundle.mockReturnValueOnce(serialiseMemberIdBundleResult);

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
        memberPublicKey = await memberPublicKeyModel.create({
          memberId: member.id,
          publicKey: memberPublicKeyBuffer,
          serviceOid: TEST_SERVICE_OID,
        });
      });

      test('KMS should be initialised', async () => {
        await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

        expect(kmsInitMock).toHaveBeenCalledOnce();
      });

      describe('Self issued organisation certificate', () => {
        test('Should be issued with existing org name', async () => {
          await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

          expect(selfIssueOrganisationCertificate).toHaveBeenCalledOnceWith(
            ORG_NAME,
            expect.anything(),
            expect.anything(),
          );
        });

        test('Should be issued with org private and public keys', async () => {
          await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

          const [[, kayPair]] = selfIssueOrganisationCertificate.mock.calls;
          const orgPrivateKeyBuffer = await kms.getPrivateKeyRef(kayPair.privateKey);
          const orgPublicKeyBuffer = await derSerialisePublicKey(kayPair.publicKey);
          expect(orgPrivateKeyBuffer).toStrictEqual(orgPrivateKeyRef);
          expect(orgPublicKeyBuffer).toStrictEqual(orgPublicKey);
        });

        test('Should be issued for a period of 90 days', async () => {
          await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

          expect(selfIssueOrganisationCertificate).toHaveBeenCalledOnceWith(
            expect.anything(),
            expect.anything(),
            expect.toBeBetween(
              subSeconds(certificateValidTill, 20),
              addSeconds(certificateValidTill, 20),
            ),
          );
        });
      });

      describe('Issued Member Certificate', () => {
        test('Should be issued using the correct member name', async () => {
          await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

          expect(issueMemberCertificate).toHaveBeenCalledOnceWith(
            MEMBER_NAME,
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
          );
        });

        test('Should be issued with member public key', async () => {
          await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

          const [[, memberCertificate]] = issueMemberCertificate.mock.calls;
          const memberCertificateBuffer = await derSerialisePublicKey(memberCertificate);
          expect(memberCertificateBuffer).toStrictEqual(memberPublicKeyBuffer);
        });

        test('Should be issued with org self signed certificate', async () => {
          await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

          expect(issueMemberCertificate).toHaveBeenCalledOnceWith(
            expect.anything(),
            expect.anything(),
            expect.toSatisfy<ArrayBuffer>((arrayBuffer) =>
              Buffer.from(selfIssueCertificateResult).equals(Buffer.from(arrayBuffer)),
            ),
            expect.anything(),
            expect.anything(),
          );
        });

        test('Should be issued with org private key', async () => {
          await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

          // eslint-disable-next-line unicorn/no-unreadable-array-destructuring
          const [[, , , orgPrivateKey]] = issueMemberCertificate.mock.calls;
          const orgPrivateKeyBuffer = await kms.getPrivateKeyRef(orgPrivateKey);
          expect(orgPrivateKeyBuffer).toStrictEqual(orgPrivateKeyRef);
        });

        test('Should be issued for a period of 90 days', async () => {
          await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

          expect(issueMemberCertificate).toHaveBeenCalledOnceWith(
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.toBeBetween(
              subSeconds(certificateValidTill, 20),
              addSeconds(certificateValidTill, 20),
            ),
          );
        });
      });

      test('Dnssec chain should be retrieved with org name', async () => {
        await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

        expect(retrieveVeraDnssecChain).toHaveBeenCalledOnceWith(ORG_NAME);
      });

      describe('Member bundle serialisation', () => {
        test('Should be called with member Certificate', async () => {
          await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

          expect(serialiseMemberIdBundle).toHaveBeenCalledOnceWith(
            expect.toSatisfy<ArrayBuffer>((arrayBuffer) =>
              Buffer.from(issueMemberCertificateResult).equals(Buffer.from(arrayBuffer)),
            ),
            expect.anything(),
            expect.anything(),
          );
        });

        test('should be called with self signed certificate', async () => {
          await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

          expect(serialiseMemberIdBundle).toHaveBeenCalledOnceWith(
            expect.anything(),
            expect.toSatisfy<ArrayBuffer>((arrayBuffer) =>
              Buffer.from(selfIssueCertificateResult).equals(Buffer.from(arrayBuffer)),
            ),
            expect.anything(),
          );
        });

        test('should be called with dnssec chain', async () => {
          await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

          expect(serialiseMemberIdBundle).toHaveBeenCalledOnceWith(
            expect.anything(),
            expect.anything(),
            expect.toSatisfy<ArrayBuffer>((arrayBuffer) =>
              Buffer.from(retrieveVeraDnssecChainResult).equals(Buffer.from(arrayBuffer)),
            ),
          );
        });
      });

      test('Member bundle should be output', async () => {
        const result = await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

        requireSuccessfulResult(result);
        expect(result.result).toStrictEqual(serialiseMemberIdBundleResult);
      });

      test('Member bundle for member without name should be output', async () => {
        const member = await memberModel.create({
          orgName: ORG_NAME,
          role: Role.REGULAR,
        });
        memberPublicKey = await memberPublicKeyModel.create({
          memberId: member.id,
          publicKey: memberPublicKeyBuffer,
          serviceOid: TEST_SERVICE_OID,
        });

        const result = await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

        requireSuccessfulResult(result);
        expect(result.result).toStrictEqual(serialiseMemberIdBundleResult);
      });
    });

    test('Invalid member public key should fail', async () => {
      const result = await generateMemberBundle(MEMBER_PUBLIC_KEY_MONGO_ID, serviceOptions);

      requireFailureResult(result);
      expect(result.context.shouldRetry).not.toBeTrue();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member public key not found', {
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        }),
      );
    });

    test('Missing member should fail', async () => {
      const memberPublicKey = await memberPublicKeyModel.create({
        memberId: MEMBER_MONGO_ID,
        publicKey: memberPublicKeyBuffer,
        serviceOid: TEST_SERVICE_OID,
      });
      const result = await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

      requireFailureResult(result);
      expect(result.context.shouldRetry).not.toBeTrue();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member not found', { memberId: MEMBER_MONGO_ID }),
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
      expect(result.context.shouldRetry).not.toBeTrue();
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

      test('Should return positive shouldRetry', async () => {
        const error = new Error('Oh noes');
        retrieveVeraDnssecChain.mockRejectedValueOnce(error);

        const result = await generateMemberBundle(memberPublicKeyId, serviceOptions);

        requireFailureResult(result);
        expect(result.context.shouldRetry).toBeTrue();
        expect(mockLogging.logs).toContainEqual(
          partialPinoLog('warn', 'Failed to retrieve DNSSEC chain', {
            memberPublicKeyId,
            err: expect.objectContaining({ message: error.message }),
          }),
        );
      });

      test('Should not initialise KMS', async () => {
        const error = new Error('Oh noes');
        retrieveVeraDnssecChain.mockRejectedValueOnce(error);

        await generateMemberBundle(memberPublicKeyId, serviceOptions);

        expect(kmsInitMock).not.toHaveBeenCalled();
      });
    });
  });
});
