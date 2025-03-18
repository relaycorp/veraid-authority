import { jest } from '@jest/globals';
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import {
  type Certificate,
  selfIssueOrganisationCertificate,
  VeraidDnssecChain,
} from '@relaycorp/veraid';
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
import type { MemberBundleRequest } from '../../servers/awala/awala.schema.js';
import type { OrgChain } from '../organisations/orgChain.js';
import { OrgChainCreationProblem } from '../organisations/OrgChainCreationProblem.js';
import { mockSpy } from '../../testUtils/jest.js';
import type { Result } from '../../utilities/result.js';

import { MemberPublicKey } from './MemberPublicKey.model.js';
import { MemberBundleRequestModel } from './MemberBundleRequest.model.js';

const mockMakeOrgChain = mockSpy(
  jest.fn<() => Promise<Result<OrgChain, OrgChainCreationProblem>>>(),
);
jest.unstable_mockModule('../organisations/orgChain.js', () => ({
  makeOrgChain: mockMakeOrgChain,
}));

const { generateMemberBundle, createMemberBundleRequest } = await import('./memberBundle.js');

const { publicKey: MEMBER_PUBLIC_KEY } = await generateKeyPair();
const MEMBER_PUBLIC_KEY_BUFFER = await derSerialisePublicKey(MEMBER_PUBLIC_KEY);

const getConnection = setUpTestDbConnection();
const getMockKms = mockKms();

const mockLogging = makeMockLogging();

let connection: Connection;
let serviceOptions: ServiceOptions;
let memberModel: ReturnModelType<typeof Member>;
let memberPublicKeyModel: ReturnModelType<typeof MemberPublicKey>;
beforeEach(() => {
  connection = getConnection();
  serviceOptions = {
    dbConnection: connection,
    logger: mockLogging.logger,
  };
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
  let request: MemberBundleRequest;
  beforeEach(async () => {
    memberBundleRequestModel = getModelForClass(MemberBundleRequestModel, {
      existingConnection: connection,
    });

    memberPublicKey = await memberPublicKeyModel.create({
      memberId: MEMBER_ID,
      serviceOid: TEST_SERVICE_OID,
      publicKey: MEMBER_PUBLIC_KEY_BUFFER,
    });

    futureTimestamp = addSeconds(new Date(), 5).toISOString();
    request = {
      publicKeyId: memberPublicKey._id.toString(),
      memberBundleStartDate: futureTimestamp,
      peerId: AWALA_PEER_ID,
      signature: SIGNATURE,
    };
  });

  test('Valid data should be accepted and stored', async () => {
    const result = await createMemberBundleRequest(request, serviceOptions);

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

    await createMemberBundleRequest(request, serviceOptions);
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
      ...request,
      memberId: MEMBER_ID,
    });

    await createMemberBundleRequest(request, serviceOptions);

    const countResult = await memberBundleRequestModel.count({
      publicKeyId: memberPublicKey._id.toString(),
    });
    expect(countResult).toBe(1);
  });

  test('Non existing public key id should be refused', async () => {
    const result = await createMemberBundleRequest(
      {
        ...request,
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
  const mockDnssecChain = new VeraidDnssecChain(ORG_NAME, [stringToArrayBuffer(ORG_NAME)]);
  let orgModel: ReturnModelType<typeof Org>;
  let orgPrivateKeyRef: Buffer;
  let orgPublicKeyDer: Buffer;
  let orgCertificate: Certificate;
  let memberPublicKeyId: string;
  beforeEach(async () => {
    const { kms } = getMockKms();
    const orgKeyPair = await kms.generateKeyPair();

    orgPrivateKeyRef = await kms.getPrivateKeyRef(orgKeyPair.privateKey);
    orgPublicKeyDer = await derSerialisePublicKey(orgKeyPair.publicKey);
    const expiryDate = addDays(new Date(), 91); // To check member certificate is capped at 90d
    orgCertificate = await selfIssueOrganisationCertificate(ORG_NAME, orgKeyPair, expiryDate);

    orgModel = getModelForClass(Org, {
      existingConnection: connection,
    });
    await orgModel.create({
      name: ORG_NAME,
      privateKeyRef: orgPrivateKeyRef,
      publicKey: orgPublicKeyDer,
    });

    const member = await memberModel.create({
      orgName: ORG_NAME,
      name: MEMBER_NAME,
      role: Role.REGULAR,
    });

    const memberPublicKey = await memberPublicKeyModel.create({
      memberId: member.id,
      publicKey: MEMBER_PUBLIC_KEY_BUFFER,
      serviceOid: TEST_SERVICE_OID,
    });
    memberPublicKeyId = memberPublicKey._id.toString();

    mockMakeOrgChain.mockResolvedValue({
      didSucceed: true,

      result: {
        dnssecChain: mockDnssecChain,
        certificate: orgCertificate,
        privateKey: orgKeyPair.privateKey,
      },
    });
  });

  test('Should call generate org chain with correct org name and service options', async () => {
    await generateMemberBundle(memberPublicKeyId, serviceOptions);

    expect(mockMakeOrgChain).toHaveBeenCalledWith(ORG_NAME, serviceOptions);
  });

  test('Should propagate chain retrieval failure', async () => {
    mockMakeOrgChain.mockResolvedValue({
      didSucceed: false,
      context: OrgChainCreationProblem.DNSSEC_CHAIN_RETRIEVAL_FAILED,
    });

    const result = await generateMemberBundle(memberPublicKeyId, serviceOptions);

    requireFailureResult(result);
    expect(result.context.didChainRetrievalFail).toBeTrue();
  });

  test('Should propagate org not found failure', async () => {
    mockMakeOrgChain.mockResolvedValue({
      didSucceed: false,
      context: OrgChainCreationProblem.ORG_NOT_FOUND,
    });

    const result = await generateMemberBundle(memberPublicKeyId, serviceOptions);

    requireFailureResult(result);
    expect(result.context.didChainRetrievalFail).toBeFalse();
  });

  describe('Issued Member Certificate', () => {
    test('Should be issued using the correct member name', async () => {
      const result = await generateMemberBundle(memberPublicKeyId, serviceOptions);

      requireSuccessfulResult(result);
      const { memberCertificate } = result.result;
      expect(memberCertificate.commonName).toBe(MEMBER_NAME);
    });

    test('Should be issued with member public key', async () => {
      const result = await generateMemberBundle(memberPublicKeyId, serviceOptions);

      requireSuccessfulResult(result);
      const { memberCertificate } = result.result;
      await expect(
        derSerialisePublicKey(await memberCertificate.getPublicKey()),
      ).resolves.toStrictEqual(MEMBER_PUBLIC_KEY_BUFFER);
    });

    test('Should be issued with org certificate', async () => {
      const result = await generateMemberBundle(memberPublicKeyId, serviceOptions);

      requireSuccessfulResult(result);
      const { memberCertificate } = result.result;
      await expect(
        memberCertificate.getCertificationPath([], [orgCertificate]),
      ).resolves.toHaveLength(2);
    });

    test('Should be valid at the time of generation', async () => {
      const startDate = setMilliseconds(new Date(), 0);

      const result = await generateMemberBundle(memberPublicKeyId, serviceOptions);

      requireSuccessfulResult(result);
      const { memberCertificate } = result.result;
      expect(memberCertificate.validityPeriod.start).toBeBetween(startDate, new Date());
    });

    test('Should expire in 90 days', async () => {
      const startDate = setMilliseconds(new Date(), 0);

      const result = await generateMemberBundle(memberPublicKeyId, serviceOptions);

      requireSuccessfulResult(result);
      const { memberCertificate } = result.result;
      expect(memberCertificate.validityPeriod.end).toBeBetween(
        addDays(startDate, 90),
        addDays(new Date(), 90),
      );
    });
  });

  test('Member bundle for member without name should output bot certificate', async () => {
    const botMember = await memberModel.create({
      orgName: ORG_NAME,
      role: Role.REGULAR,
    });
    const botPublicKey = await memberPublicKeyModel.create({
      memberId: botMember.id,
      publicKey: MEMBER_PUBLIC_KEY_BUFFER,
      serviceOid: TEST_SERVICE_OID,
    });

    const result = await generateMemberBundle(botPublicKey._id.toString(), serviceOptions);

    requireSuccessfulResult(result);
    const { memberCertificate } = result.result;
    expect(memberCertificate.commonName).toBe('@');
  });

  test('Invalid member public key should fail', async () => {
    const result = await generateMemberBundle(MEMBER_PUBLIC_KEY_MONGO_ID, serviceOptions);

    requireFailureResult(result);
    expect(result.context.didChainRetrievalFail).not.toBeTrue();
    expect(mockLogging.logs).toContainEqual(
      partialPinoLog('info', 'Member public key not found', {
        memberPublicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      }),
    );
  });

  test('Missing member should fail', async () => {
    const { _id: missingMemberPublicKeyId } = await memberPublicKeyModel.create({
      memberId: MEMBER_ID,
      publicKey: MEMBER_PUBLIC_KEY_BUFFER,
      serviceOid: TEST_SERVICE_OID,
    });

    const result = await generateMemberBundle(missingMemberPublicKeyId.toString(), serviceOptions);

    requireFailureResult(result);
    expect(result.context.didChainRetrievalFail).not.toBeTrue();
    expect(mockLogging.logs).toContainEqual(
      partialPinoLog('info', 'Member not found', { memberId: MEMBER_ID }),
    );
  });
});
