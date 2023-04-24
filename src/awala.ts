import { getModelForClass } from '@typegoose/typegoose';

import type { Result, SuccessfulResult } from './utilities/result.js';
import type { ServiceOptions } from './serviceTypes.js';
import type { MemberBundleRequest } from './schemas/awala.schema.js';
import { MemberBundleRequestModelSchema } from './models/MemberBundleRequest.model.js';
import { MemberPublicKeyModelSchema } from './models/MemberPublicKey.model.js';
import { addDays } from 'date-fns';
import {
  issueMemberCertificate,
  retrieveVeraDnssecChain,
  selfIssueOrganisationCertificate, serialiseMemberIdBundle,
} from '@relaycorp/veraid';
import { MemberModelSchema } from './models/Member.model.js';
import { Kms } from './utilities/kms/Kms.js';
import env from 'env-var';
import { OrgModelSchema } from './models/Org.model.js';
import { derDeserializePublicKey } from './utilities/derDeserialisePublicKey.js';

const awalaEndpoint = env.get('AWALA_MW').asString();


export async function createMemberBundleRequest(
  requestData: MemberBundleRequest,
  options: ServiceOptions,
): Promise<SuccessfulResult<undefined>> {
  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
    existingConnection: options.dbConnection,
  });
  await memberBundleRequestModel.updateOne(
    {
      publicKeyId: requestData.publicKeyId,
    },
    {
      publicKeyId: requestData.publicKeyId,
      memberBundleStartDate: new Date(requestData.memberBundleStartDate),
      signature: Buffer.from(requestData.signature, 'base64'),
      awalaPda: Buffer.from(requestData.awalaPda, 'base64'),
    },
    {
      upsert: true,
    },
  );

  options.logger.info({ publicKeyId: requestData.publicKeyId }, 'Member bundle request created');

  return {
    didSucceed: true,
  };
}
// string will be substituted with the actual error
export async function generateMemberBundle(
  publicKeyId: string,
  options: ServiceOptions,
): Promise<Result<ArrayBuffer, string>> {

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
      reason: "No member public key"
    }
  }

  const member = await memberModel.findById(memberPublicKey.memberId);
  if(!member){
    return {
      didSucceed: false,
      reason: "No member"
    }
  }
  if(!member.name){
    return {
      didSucceed: false,
      reason: "No member name"
    }
  }

  const org = await orgModel.findOne({name: member.orgName});
  if(!org){
    return {
      didSucceed: false,
      reason: "No org"
    }
  }

  const kms = await Kms.init();
  const orgPrivateKey = await kms.retrievePrivateKeyByRef(org.privateKeyRef);
  const orgPublicKey = await derDeserializePublicKey(org.publicKey);
  const orgKeyPair : CryptoKeyPair = {privateKey: orgPrivateKey, publicKey: orgPublicKey};

  const memberCryptoPublicKey = await derDeserializePublicKey(memberPublicKey.publicKey)

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

  const dnssecChain = await retrieveVeraDnssecChain(member.orgName, undefined);
  const memberBundle = serialiseMemberIdBundle(memberCertificate, orgCertificate, dnssecChain);

  return {
    didSucceed: true,
    result: memberBundle
  };
}


// string will be substituted with the actual error type
export async function postToAwala(data: unknown, awalaPda: string): Promise<Result<undefined, string>>{

  const pdaResponse = await fetch(awalaEndpoint, {
    method: "POST",
    headers: {'Content-Type' : 'application/awala-pda'},
    body: awalaPda,
  })
  const { recipientId } = await pdaResponse.json();

  if(!recipientId){
    return {
      didSucceed: false,
      reason: "could not extract recipient id"
    };
  }

  await fetch(awalaEndpoint, {
    body: data,
    headers: {
      'Content-Type': 'application/awala-parcel',
      'X-Awala-Recipient': recipientId
    }
  })

  return {
    didSucceed: true
  }
}

