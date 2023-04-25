import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection, HydratedDocument } from 'mongoose';
import { addDays, addSeconds, subSeconds } from 'date-fns';

import { mockedVeraidModule } from './testUtils/veraid.mock.js';
import { OrgModelSchema } from './models/Org.model.js';
import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging } from './testUtils/logging.js';
import { MEMBER_NAME, ORG_NAME, TEST_SERVICE_OID } from './testUtils/stubs.js';
import type { ServiceOptions } from './serviceTypes.js';
import { derSerialisePublicKey } from './utilities/webcrypto.js';
import { MemberModelSchema, Role } from './models/Member.model.js';
import { MemberPublicKeyModelSchema } from './models/MemberPublicKey.model.js';
import { generateKeyPair } from './testUtils/webcrypto.js';
import { type MockKms, mockKms } from './testUtils/kms/mockKms.js';
import { requireSuccessfulResult } from './testUtils/result.js';

const { generateMemberBundle } = await import('./memberBundle.js');
const {
  selfIssueOrganisationCertificate,
  issueMemberCertificate,
  retrieveVeraDnssecChain,
  serialiseMemberIdBundle,
} = mockedVeraidModule;

const CERTIFICATE_ISSIE_PERIOD = 90;

describe('memberBundle', () => {
  const getConnection = setUpTestDbConnection();
  const getMockKms = mockKms();
  let kms: MockKms;

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
    certificateValidTill = addDays(new Date(), CERTIFICATE_ISSIE_PERIOD);
    kms = getMockKms();
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
        selfIssueCertificateResult = new ArrayBuffer(1);
        selfIssueOrganisationCertificate.mockResolvedValueOnce(selfIssueCertificateResult);
        issueMemberCertificateResult = new ArrayBuffer(2);
        issueMemberCertificate.mockResolvedValueOnce(issueMemberCertificateResult);
        retrieveVeraDnssecChainResult = new ArrayBuffer(3);
        retrieveVeraDnssecChain.mockResolvedValueOnce(retrieveVeraDnssecChainResult);
        serialiseMemberIdBundleResult = new ArrayBuffer(4);
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
            selfIssueCertificateResult,
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

      test('Member bundle serialisation should be called with member Certificate', async () => {
        await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

        expect(serialiseMemberIdBundle).toHaveBeenCalledOnceWith(
          issueMemberCertificateResult,
          expect.anything(),
          expect.anything(),
        );
      });

      describe('Member bundle serialisation', () => {
        test('should be called with self signed certificate', async () => {
          await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

          expect(serialiseMemberIdBundle).toHaveBeenCalledOnceWith(
            expect.anything(),
            selfIssueCertificateResult,
            expect.anything(),
          );
        });

        test('should be called with dnssec chain', async () => {
          await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

          expect(serialiseMemberIdBundle).toHaveBeenCalledOnceWith(
            expect.anything(),
            expect.anything(),
            retrieveVeraDnssecChainResult,
          );
        });
      });

      test('Member bundle should be generated', async () => {
        const result = await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

        requireSuccessfulResult(result);
        expect(result.result).toBe(serialiseMemberIdBundleResult);
      });
    });
  });
});
