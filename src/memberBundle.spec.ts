/* eslint-disable unicorn/text-encoding-identifier-case */
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

import { getVeraid } from './testUtils/veraid.mock.js';
import { OrgModelSchema } from './models/Org.model.js';
import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging } from './testUtils/logging.js';
import { requireSuccessfulResult } from './testUtils/result.js';
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
  serialiseMemberIdBundle
} = getVeraid();

describe('memberBundle', () => {

  const getConnection = setUpTestDbConnection();
  const getMockKms = mockKms();
  let kmsForKeys: MockKms;

  const mockLogging = makeMockLogging();

  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let orgModel: ReturnModelType<typeof OrgModelSchema>;
  let memberModel: ReturnModelType<typeof MemberModelSchema>;
  let memberPublicKeyModel: ReturnModelType<typeof MemberPublicKeyModelSchema>;
  let memberPublicKeyBuffer: Buffer;
  let orgPrivateKeyRef: Buffer;
  let orgPublicKey: Buffer;

  let orgPublicCryptoKey: CryptoKey;
  let orgPrivateCryptoKey: CryptoKey;
  let memberPublicCryptoKey: CryptoKey;

  beforeEach(async () => {
    kmsForKeys = getMockKms();
    const { publicKey, privateKey } = await kmsForKeys.generateKeyPair();
    orgPublicCryptoKey = publicKey;
    orgPrivateCryptoKey = privateKey;

    orgPrivateKeyRef = await kmsForKeys.getPrivateKeyRef(orgPrivateCryptoKey);
    orgPublicKey = await derSerialisePublicKey(orgPublicCryptoKey);

    const { publicKey: memberCryptoKey } = await generateKeyPair();
    memberPublicCryptoKey = memberCryptoKey;
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

    test('Valid data should generate member bundle', async () => {
      const ORG_NAME = 'lib-testing.veraid.net';

      const selfIssueOrganisationCertificateResult = new ArrayBuffer(1);
      selfIssueOrganisationCertificate.mockResolvedValueOnce(selfIssueOrganisationCertificateResult);
      const issueMemberCertificateResult = new ArrayBuffer(2);
      issueMemberCertificate.mockResolvedValueOnce(issueMemberCertificateResult);
      const retrieveVeraDnssecChainResult = new ArrayBuffer(3);
      retrieveVeraDnssecChain.mockResolvedValueOnce(retrieveVeraDnssecChainResult);
      const serialiseMemberIdBundleResult = new ArrayBuffer(4);
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
      const memberPublicKey = await memberPublicKeyModel.create({
        memberId: member.id,
        publicKey: memberPublicKeyBuffer,
        serviceOid: TEST_SERVICE_OID,
      })

      const result = await generateMemberBundle(memberPublicKey._id.toString(), serviceOptions);

      requireSuccessfulResult(result);
      expect(result.result).not.toBeNull()
      const plus90Days = addDays(new Date(), 90);

      const selfIssueOrganisationCertificateParameters = selfIssueOrganisationCertificate.mock.calls[0];
      expect(selfIssueOrganisationCertificateParameters[0]).toBe(ORG_NAME);
      const calledKeyPair = selfIssueOrganisationCertificateParameters[1];
      const orgPrivateKeyBuffer = await kmsForKeys.getPrivateKeyRef(calledKeyPair.privateKey);
      const orgPublicKeyBuffer = await derSerialisePublicKey(calledKeyPair.publicKey);
      expect(orgPrivateKeyBuffer.toString()).toBe(orgPrivateKeyRef.toString())
      expect(orgPublicKeyBuffer.toString()).toBe(orgPublicKey.toString())
      expect(selfIssueOrganisationCertificateParameters[2]).toBeBetween(subSeconds(plus90Days, 20), addSeconds(plus90Days, 20));


      const issueMemberCertificateParameters = issueMemberCertificate.mock.calls[0];
      expect(issueMemberCertificateParameters[0]).toBe(MEMBER_NAME);
      expect((await derSerialisePublicKey(issueMemberCertificateParameters[1])).toString()).toBe(memberPublicKeyBuffer.toString());
      expect(issueMemberCertificateParameters[2]).toBe(selfIssueOrganisationCertificateResult);
      expect(issueMemberCertificateParameters[3]).toBe(calledKeyPair.privateKey);
      expect(issueMemberCertificateParameters[4].getTime()).toBe(selfIssueOrganisationCertificateParameters[2].getTime());

      expect(retrieveVeraDnssecChain).toHaveBeenCalledOnceWith(ORG_NAME);
      expect(serialiseMemberIdBundle).toHaveBeenCalledOnceWith(issueMemberCertificateResult, selfIssueOrganisationCertificateResult, retrieveVeraDnssecChainResult);
      expect(result.result).toBe(serialiseMemberIdBundleResult);


      });
    });
});

