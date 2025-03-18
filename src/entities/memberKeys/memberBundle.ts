import { getModelForClass } from '@typegoose/typegoose';
import { addDays } from 'date-fns';
import { issueMemberCertificate, MemberIdBundle } from '@relaycorp/veraid';

import type { ServiceOptions } from '../../utilities/serviceTypes.js';
import { Member } from '../members/Member.model.js';
import { derDeserialisePublicKey } from '../../utilities/webcrypto.js';
import type { Result } from '../../utilities/result.js';
import type { MemberBundleRequest } from '../../servers/awala/awala.schema.js';
import { makeOrgChain } from '../organisations/orgChain.js';
import { OrgChainCreationProblem } from '../organisations/OrgChainCreationProblem.js';

import { MemberPublicKey } from './MemberPublicKey.model.js';
import { MemberBundleRequestModel } from './MemberBundleRequest.model.js';

export const MEMBER_CERTIFICATE_EXPIRY_DAYS = 90;

export interface BundleCreationFailure {
  didChainRetrievalFail: boolean;
}

export async function createMemberBundleRequest(
  requestData: MemberBundleRequest,
  options: ServiceOptions,
): Promise<Result<undefined, undefined>> {
  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModel, {
    existingConnection: options.dbConnection,
  });
  const memberPublicKeyModel = getModelForClass(MemberPublicKey, {
    existingConnection: options.dbConnection,
  });
  const publicKey = await memberPublicKeyModel.findById(requestData.publicKeyId);

  if (!publicKey) {
    options.logger.info(
      { memberPublicKeyId: requestData.publicKeyId },
      'Member public key not found',
    );
    return {
      didSucceed: false,
    };
  }

  await memberBundleRequestModel.updateOne(
    {
      publicKeyId: requestData.publicKeyId,
    },
    {
      publicKeyId: requestData.publicKeyId,
      memberBundleStartDate: new Date(requestData.memberBundleStartDate),
      signature: Buffer.from(requestData.signature, 'base64'),
      peerId: requestData.peerId,
      memberId: publicKey.memberId,
    },
    {
      upsert: true,
    },
  );

  options.logger.info(
    { memberPublicKeyId: requestData.publicKeyId },
    'Member bundle request created',
  );

  return {
    didSucceed: true,
  };
}

export async function generateMemberBundle(
  publicKeyId: string,
  options: ServiceOptions,
): Promise<Result<MemberIdBundle, BundleCreationFailure>> {
  const memberPublicKeyModel = getModelForClass(MemberPublicKey, {
    existingConnection: options.dbConnection,
  });

  const memberModel = getModelForClass(Member, {
    existingConnection: options.dbConnection,
  });

  const memberPublicKey = await memberPublicKeyModel.findById(publicKeyId);
  if (!memberPublicKey) {
    options.logger.info(
      {
        memberPublicKeyId: publicKeyId,
      },
      'Member public key not found',
    );
    return {
      didSucceed: false,

      context: {
        didChainRetrievalFail: false,
      },
    };
  }
  const member = await memberModel.findById(memberPublicKey.memberId);
  if (!member) {
    options.logger.info(
      {
        memberId: memberPublicKey.memberId,
      },
      'Member not found',
    );
    return {
      didSucceed: false,

      context: {
        didChainRetrievalFail: false,
      },
    };
  }

  const orgChainResult = await makeOrgChain(member.orgName, options);
  if (!orgChainResult.didSucceed) {
    const didChainRetrievalFail =
      orgChainResult.context === OrgChainCreationProblem.DNSSEC_CHAIN_RETRIEVAL_FAILED;
    return {
      didSucceed: false,
      context: { didChainRetrievalFail },
    };
  }

  const {
    dnssecChain,
    certificate: orgCertificate,
    privateKey: orgPrivateKey,
  } = orgChainResult.result;
  const memberCryptoPublicKey = await derDeserialisePublicKey(memberPublicKey.publicKey);

  const expiryDate = addDays(new Date(), MEMBER_CERTIFICATE_EXPIRY_DAYS);
  const memberCertificate = await issueMemberCertificate(
    member.name ?? undefined,
    memberCryptoPublicKey,
    orgCertificate,
    orgPrivateKey,
    expiryDate,
  );

  return {
    didSucceed: true,
    result: new MemberIdBundle(dnssecChain, orgCertificate, memberCertificate),
  };
}
