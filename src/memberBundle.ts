import { getModelForClass } from '@typegoose/typegoose';
import { addDays } from 'date-fns';
import {
  issueMemberCertificate,
  retrieveVeraDnssecChain,
  selfIssueOrganisationCertificate,
  serialiseMemberIdBundle,
} from '@relaycorp/veraid';

import type { ServiceOptions } from './serviceTypes.js';
import { MemberPublicKeyModelSchema } from './models/MemberPublicKey.model.js';
import { MemberModelSchema } from './models/Member.model.js';
import { Kms } from './utilities/kms/Kms.js';
import { OrgModelSchema } from './models/Org.model.js';
import { derDeserialisePublicKey } from './utilities/webcrypto.js';
import { Result } from './utilities/result.js';

export async function generateMemberBundle(
  publicKeyId: string,
  options: ServiceOptions,
): Promise<Result<ArrayBuffer, {
  shouldRetry: boolean
}>> {
  const memberPublicKeyModel = getModelForClass(MemberPublicKeyModelSchema, {
    existingConnection: options.dbConnection,
  });

  const memberModel = getModelForClass(MemberModelSchema, {
    existingConnection: options.dbConnection,
  });

  const orgModel = getModelForClass(OrgModelSchema, {
    existingConnection: options.dbConnection,
  });

  const memberPublicKey = await memberPublicKeyModel.findById(publicKeyId);
  if (!memberPublicKey) {
    options.logger.info({
      publicKeyId
    }, 'Member public key not found');
    return {
      didSucceed: false,
      reason: {
        shouldRetry: false
      }
    };
  }
  const member = await memberModel.findById(memberPublicKey.memberId);
  if (!member) {
    options.logger.info({
      memberId: memberPublicKey.memberId
    }, 'Member not found');
    return {
      didSucceed: false,
      reason: {
        shouldRetry: false
      }
    };
  }

  const org = await orgModel.findOne({ name: member.orgName });
  if (!org) {
      options.logger.info({
        orgId: member.orgName
      }, 'Org not found');
      return {
        didSucceed: false,
        reason: {
          shouldRetry: false
        }
      };
  }

    const kms = await Kms.init();
    const orgPrivateKey = await kms.retrievePrivateKeyByRef(org.privateKeyRef);
    const orgPublicKey = await derDeserialisePublicKey(org.publicKey);
    const orgKeyPair: CryptoKeyPair = {
      privateKey: orgPrivateKey,
      publicKey: orgPublicKey,
    };

    const memberCryptoPublicKey = await derDeserialisePublicKey(memberPublicKey.publicKey);

    const expiryDate = addDays(new Date(), 90);
    const orgCertificate = await selfIssueOrganisationCertificate(
      member.orgName,
      orgKeyPair,
      expiryDate,
    );

    const memberCertificate = await issueMemberCertificate(
      member.name || undefined,
      memberCryptoPublicKey,
      orgCertificate,
      orgPrivateKey,
      expiryDate,
    );

  let dnssecChain
  try {
    dnssecChain = await retrieveVeraDnssecChain(member.orgName);
  } catch (err) {
    options.logger.warn({
      memberId: memberPublicKey.memberId,
      err
    }, 'Failed to retrieve dnssec chain');
    return {
      didSucceed: false,
      reason: {
        shouldRetry: true
      }
    };
  }
  const memberBundle = serialiseMemberIdBundle(memberCertificate, orgCertificate, dnssecChain);

  return {
    didSucceed: true,
    result: memberBundle
  }
}
