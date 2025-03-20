import { generateTxtRdata, VeraidDnssecChain } from '@relaycorp/veraid';
import {
  DnsClass,
  DnsRecord,
  MockChain,
  RrSet,
  SecurityStatus,
  type TrustAnchor,
} from '@relaycorp/dnssec';

import { ORG_NAME } from './stubs.js';
import { stringToArrayBuffer } from './buffer.js';

interface DnssecChainFixture {
  readonly chain: VeraidDnssecChain;
  readonly trustAnchors: readonly TrustAnchor[];
}

const ZONE_NAME = `${ORG_NAME}.`;
const RECORD_TTL = 42;
const RECORD_TTL_OVERRIDE_DAYS = 30;

const MOCK_CHAIN = await MockChain.generate(ZONE_NAME);

/**
 * @deprecated Use `generateVeraidDnssecChain` instead, and avoid mocking the chain retrieval.
 */
export const VERAID_DNSSEC_CHAIN = new VeraidDnssecChain(ORG_NAME, [stringToArrayBuffer(ORG_NAME)]);

export async function generateVeraidDnssecChain(
  orgPublicKey: CryptoKey,
): Promise<DnssecChainFixture> {
  const record = new DnsRecord(
    `_veraid.${ZONE_NAME}`,
    'TXT',
    DnsClass.IN,
    RECORD_TTL,
    await generateTxtRdata(orgPublicKey, RECORD_TTL_OVERRIDE_DAYS),
  );
  const rrset = RrSet.init(record.makeQuestion(), [record]);
  const { responses, trustAnchors } = MOCK_CHAIN.generateFixture(rrset, SecurityStatus.SECURE);
  const responsesSerialised = responses.map((response) => response.serialise());
  const chain = new VeraidDnssecChain(ORG_NAME, responsesSerialised);
  return { chain, trustAnchors };
}
