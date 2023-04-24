import { getModelForClass } from '@typegoose/typegoose';
import { addDays } from 'date-fns';
import {
  issueMemberCertificate,
  retrieveVeraDnssecChain,
  selfIssueOrganisationCertificate,
  serialiseMemberIdBundle,
} from '@relaycorp/veraid';

import type { Result } from './utilities/result.js';
import type { ServiceOptions } from './serviceTypes.js';
import { MemberPublicKeyModelSchema } from './models/MemberPublicKey.model.js';
import { MemberModelSchema } from './models/Member.model.js';
import { Kms } from './utilities/kms/Kms.js';
import { OrgModelSchema } from './models/Org.model.js';
import { derDeserialisePublicKey } from './utilities/webcrypto.js';
import { MemberBundleProblemType } from './MemberBundleProblemType.js';

export async function generateMemberBundle(
  publicKeyId: string,
  options: ServiceOptions,
): Promise<Result<ArrayBuffer, MemberBundleProblemType>> {

  // getMemberPublicKey required memberId as a parameter
  const memberPublicKeyModel = getModelForClass(MemberPublicKeyModelSchema, {
    existingConnection: options.dbConnection,
  });

  // getMember orgName is a required parameter
    const memberModel = getModelForClass(MemberModelSchema, {
      existingConnection: options.dbConnection,
    });

    // getOrg does not return privateKeyRef and publicKeyRef
    const orgModel = getModelForClass(OrgModelSchema, {
      existingConnection: options.dbConnection,
    });


  const memberPublicKey = await memberPublicKeyModel.findById(publicKeyId);
  if(!memberPublicKey){
    return {
      didSucceed: false,
      reason: MemberBundleProblemType.PUBLIC_KEY_NOT_FOUND
    }
  }
  const member = await memberModel.findById(memberPublicKey.memberId);
  if(!member){
    return {
      didSucceed: false,
      reason: MemberBundleProblemType.MEMBER_NOT_FOUND
    }
  }
  if(!member.name){
    return {
      didSucceed: false,
      reason: MemberBundleProblemType.MEMBER_NO_NAME
    }
  }

  const org = await orgModel.findOne({name: member.orgName});
  if(!org){
    return {
      didSucceed: false,
      reason: MemberBundleProblemType.ORG_NOT_FOUND
    }
  }
  let memberBundle: ArrayBuffer;
  try {
    const kms = await Kms.init();
    const orgPrivateKey = await kms.retrievePrivateKeyByRef(org.privateKeyRef);
    const orgPublicKey = await derDeserialisePublicKey(org.publicKey);
    const orgKeyPair : CryptoKeyPair = {
      privateKey: orgPrivateKey,
      publicKey: orgPublicKey
    };

    const memberCryptoPublicKey = await derDeserialisePublicKey(memberPublicKey.publicKey)

    const expiryDate = addDays(new Date(), 90);
    const orgCertificate = await selfIssueOrganisationCertificate(
      member.orgName,
      orgKeyPair,
      expiryDate,
    );

    const memberCertificate = await issueMemberCertificate(
      member.name,
      memberCryptoPublicKey,
      orgCertificate,
      orgPrivateKey,
      expiryDate,
    );

    const dnssecChain = await retrieveVeraDnssecChain(member.orgName);
    memberBundle = serialiseMemberIdBundle(memberCertificate, orgCertificate, dnssecChain);
  }catch (e){
    console.log(e);
    return {
      didSucceed: false,
      reason: MemberBundleProblemType.BUNDLE_GENERATION_ERROR
    }
  }

  return {
    didSucceed: true,
    result: memberBundle
  };
}
