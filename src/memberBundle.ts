import { getModelForClass } from '@typegoose/typegoose';
import { addDays } from 'date-fns';
import {
  issueMemberCertificate,
  retrieveVeraDnssecChain,
  selfIssueOrganisationCertificate,
  serialiseMemberIdBundle,
} from '@relaycorp/veraid';
import type { BaseLogger } from 'pino';

import type { ServiceOptions } from './serviceTypes.js';
import { MemberPublicKeyModelSchema } from './models/MemberPublicKey.model.js';
import { MemberModelSchema } from './models/Member.model.js';
import { Kms } from './utilities/kms/Kms.js';
import { OrgModelSchema } from './models/Org.model.js';
import { derDeserialisePublicKey } from './utilities/webcrypto.js';
import type { Result } from './utilities/result.js';

const CERTIFICATE_EXPIRY_DAYS = 90;
interface BundleCreationInput {
  orgPrivateKeyRefBuffer: Buffer;
  orgPublicKeyBuffer: Buffer;
  memberPublicKey: Buffer;
  orgName: string;
  memberName?: string;
  memberPublicKeyId: string;
}

async function generateBundle(
  {
    orgPrivateKeyRefBuffer,
    orgPublicKeyBuffer,
    memberPublicKey,
    orgName,
    memberName,
    memberPublicKeyId,
  }: BundleCreationInput,
  logger: BaseLogger,
): Promise<ArrayBuffer | undefined> {
  let dnssecChain;
  try {
    dnssecChain = await retrieveVeraDnssecChain(orgName);
  } catch (err) {
    logger.warn(
      {
        memberPublicKeyId,
        err,
      },
      'Failed to retrieve DNSSEC chain',
    );
    return undefined;
  }

  const kms = await Kms.init();
  const orgPrivateKey = await kms.retrievePrivateKeyByRef(orgPrivateKeyRefBuffer);
  const orgPublicKey = await derDeserialisePublicKey(orgPublicKeyBuffer);
  const orgKeyPair: CryptoKeyPair = {
    privateKey: orgPrivateKey,
    publicKey: orgPublicKey,
  };

  const memberCryptoPublicKey = await derDeserialisePublicKey(memberPublicKey);

  const expiryDate = addDays(new Date(), CERTIFICATE_EXPIRY_DAYS);
  const orgCertificate = await selfIssueOrganisationCertificate(orgName, orgKeyPair, expiryDate);

  const memberCertificate = await issueMemberCertificate(
    memberName,
    memberCryptoPublicKey,
    orgCertificate,
    orgPrivateKey,
    expiryDate,
  );

  return serialiseMemberIdBundle(memberCertificate, orgCertificate, dnssecChain);
}

export async function generateMemberBundle(
  publicKeyId: string,
  options: ServiceOptions,
): Promise<
  Result<
    ArrayBuffer,
    {
      shouldRetry: boolean;
    }
  >
> {
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
    options.logger.info(
      {
        publicKeyId,
      },
      'Member public key not found',
    );
    return {
      didSucceed: false,

      context: {
        shouldRetry: false,
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
        shouldRetry: false,
      },
    };
  }

  const org = await orgModel.findOne({ name: member.orgName });
  if (!org) {
    options.logger.info(
      {
        orgName: member.orgName,
      },
      'Org not found',
    );
    return {
      didSucceed: false,

      context: {
        shouldRetry: false,
      },
    };
  }

  const memberBundle = await generateBundle(
    {
      orgPrivateKeyRefBuffer: org.privateKeyRef,
      orgPublicKeyBuffer: org.publicKey,
      memberPublicKey: memberPublicKey.publicKey,
      orgName: org.name,
      memberName: member.name ?? undefined,
      memberPublicKeyId: publicKeyId,
    },
    options.logger,
  );

  if (!memberBundle) {
    return {
      didSucceed: false,

      context: {
        shouldRetry: true,
      },
    };
  }
  return {
    didSucceed: true,
    result: memberBundle,
  };
}
