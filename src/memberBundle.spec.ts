/* eslint-disable unicorn/text-encoding-identifier-case */
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection, HydratedDocument } from 'mongoose';

import { getVeraid } from './testUtils/veraid.mock.js';
import { OrgModelSchema } from './models/Org.model.js';
import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging } from './testUtils/logging.js';
import { MEMBER_NAME, TEST_SERVICE_OID } from './testUtils/stubs.js';
import type { ServiceOptions } from './serviceTypes.js';
import { derSerialisePublicKey } from './utilities/webcrypto.js';
import { MemberModelSchema, Role } from './models/Member.model.js';
import { MemberPublicKeyModelSchema } from './models/MemberPublicKey.model.js';
import { generateKeyPair } from './testUtils/webcrypto.js';
import { MockKms, mockKms } from './testUtils/kms/mockKms.js';
import { addDays, addSeconds, subSeconds } from 'date-fns';

const { generateMemberBundle } = await import('./memberBundle.js');
const {
  selfIssueOrganisationCertificate,
  issueMemberCertificate,
  retrieveVeraDnssecChain,
  serialiseMemberIdBundle,
} = getVeraid();

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
  let plus90Days: Date;
  // expect problem - let orgPrivateCryptoKey1: CryptoKey;

  beforeEach(async () => {
    plus90Days = addDays(new Date(), 90);
    kms = getMockKms();
    const { publicKey: orgPublicCryptoKey, privateKey: orgPrivateCryptoKey } =
      await kms.generateKeyPair();
    // expect problem - orgPrivateCryptoKey1 = orgPrivateCryptoKey;
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
      const ORG_NAME = 'lib-testing.veraid.net';
      let selfIssueOrganisationCertificateResult: ArrayBuffer;
      let issueMemberCertificateResult: ArrayBuffer;
      let retrieveVeraDnssecChainResult: ArrayBuffer;
      let serialiseMemberIdBundleResult: ArrayBuffer;
      let memberPublicKey: HydratedDocument<MemberPublicKeyModelSchema>;

      beforeEach(async () => {
        selfIssueOrganisationCertificateResult = new ArrayBuffer(1);
        selfIssueOrganisationCertificate.mockResolvedValueOnce(
          selfIssueOrganisationCertificateResult,
        );
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

      // Added "Method" because of the first capital letter
      test('Method selfIssueOrganisationCertificate should be called with correct parameters', async () => {
        await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

        const parameters = selfIssueOrganisationCertificate.mock.calls[0];
        expect(parameters[0]).toBe(ORG_NAME);
        const calledKeyPair = parameters[1];
        const orgPrivateKeyBuffer = await kms.getPrivateKeyRef(calledKeyPair.privateKey);
        const orgPublicKeyBuffer = await derSerialisePublicKey(calledKeyPair.publicKey);
        // expect problem - expect(parameters[1].privateKey).toBe(orgPrivateCryptoKey1);
        // compare buffers
        expect(orgPrivateKeyBuffer.toString()).toBe(orgPrivateKeyRef.toString());
        expect(orgPublicKeyBuffer.toString()).toBe(orgPublicKey.toString());
        expect(parameters[2]).toBeBetween(subSeconds(plus90Days, 20), addSeconds(plus90Days, 20));
      });

      test('Method issueMemberCertificate should be called with correct parameters', async () => {
        await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

        const parameters = issueMemberCertificate.mock.calls[0];
        expect(parameters[0]).toBe(MEMBER_NAME);
        const memberCertificate = parameters[1];
        const memberCertificateBuffer = await derSerialisePublicKey(memberCertificate);
        expect(memberCertificateBuffer.toString()).toBe(memberPublicKeyBuffer.toString());
        expect(parameters[2]).toBe(selfIssueOrganisationCertificateResult);
        const orgPrivateKey = parameters[3];
        const orgPrivateKeyBuffer = await kms.getPrivateKeyRef(orgPrivateKey);
        expect(orgPrivateKeyBuffer.toString()).toBe(orgPrivateKeyRef.toString());
        expect(parameters[4]).toBeBetween(subSeconds(plus90Days, 20), addSeconds(plus90Days, 20));
      });

      test('Method retrieveVeraDnssecChain should be called with correct parameters', async () => {
        await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

        expect(retrieveVeraDnssecChain).toHaveBeenCalledOnceWith(ORG_NAME);
      });

      test('Method retrieveVeraDnssecChain should be called with correct parameters', async () => {
        await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

        expect(serialiseMemberIdBundle).toHaveBeenCalledOnceWith(
          issueMemberCertificateResult,
          selfIssueOrganisationCertificateResult,
          retrieveVeraDnssecChainResult,
        );
      });

      test('Member bundle should be generated', async () => {
        const result = await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

        expect(result).toBe(serialiseMemberIdBundleResult);
      });
    });
  });
});
