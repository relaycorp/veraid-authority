import { getModelForClass } from '@typegoose/typegoose';
import { addDays } from 'date-fns';
import {
  selfIssueOrganisationCertificate,
  VeraidDnssecChain,
  type Certificate,
} from '@relaycorp/veraid';

import type { ServiceOptions } from '../../utilities/serviceTypes.js';
import type { Result } from '../../utilities/result.js';
import { Kms } from '../../utilities/kms/Kms.js';
import { derDeserialisePublicKey } from '../../utilities/webcrypto.js';

import { OrgChainCreationProblem } from './OrgChainCreationProblem.js';
import { Org } from './Org.model.js';

export const ORG_CERTIFICATE_EXPIRY_DAYS = 90;

export interface OrgChain {
  readonly dnssecChain: VeraidDnssecChain;
  readonly certificate: Certificate;
  readonly privateKey: CryptoKey;
}

export async function makeOrgChain(
  orgName: string,
  options: ServiceOptions,
): Promise<Result<OrgChain, OrgChainCreationProblem>> {
  const orgModel = getModelForClass(Org, {
    existingConnection: options.dbConnection,
  });

  const org = await orgModel.findOne({ name: orgName });
  if (!org) {
    options.logger.info(
      {
        orgName,
      },
      'Org not found',
    );
    return {
      didSucceed: false,
      context: OrgChainCreationProblem.ORG_NOT_FOUND,
    };
  }

  let dnssecChain;
  try {
    dnssecChain = await VeraidDnssecChain.retrieve(orgName);
  } catch (err) {
    options.logger.warn(
      {
        orgName,
        err,
      },
      'Failed to retrieve DNSSEC chain',
    );
    return {
      didSucceed: false,
      context: OrgChainCreationProblem.DNSSEC_CHAIN_RETRIEVAL_FAILED,
    };
  }

  const kms = await Kms.init();
  const orgPrivateKey = await kms.retrievePrivateKeyByRef(org.privateKeyRef);
  const orgPublicKey = await derDeserialisePublicKey(org.publicKey);
  const orgKeyPair: CryptoKeyPair = {
    privateKey: orgPrivateKey,
    publicKey: orgPublicKey,
  };

  const expiryDate = addDays(new Date(), ORG_CERTIFICATE_EXPIRY_DAYS);
  const certificate = await selfIssueOrganisationCertificate(orgName, orgKeyPair, expiryDate);

  return {
    didSucceed: true,

    result: {
      dnssecChain,
      certificate,
      privateKey: orgPrivateKey,
    },
  };
}
