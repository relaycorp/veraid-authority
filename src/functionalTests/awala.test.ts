import { randomUUID } from 'node:crypto';

import {
  MemberCreationCommand,
  MemberKeyImportTokenCommand,
  MemberRole,
  type AuthorityClient,
} from '@relaycorp/veraid-authority';
import { CloudEvent } from 'cloudevents';
import { addMinutes, formatISO } from 'date-fns';

import type { MemberKeyImportRequest } from '../servers/awala/awala.schema.js';
import { generateKeyPair } from '../testUtils/webcrypto.js';
import { derSerialisePublicKey } from '../utilities/webcrypto.js';
import { AWALA_PEER_ID, TEST_SERVICE_OID } from '../testUtils/stubs.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';
import { CE_ID } from '../testUtils/eventing/stubs.js';
import { INCOMING_SERVICE_MESSAGE_TYPE } from '../events/incomingServiceMessage.event.js';

import { makeClient } from './utils/api.js';
import { postEvent } from './utils/events.js';
import { AuthScope } from './utils/authServer.js';
import { waitForServers } from './utils/wait.js';
import { createTestOrg } from './utils/testOrg.js';

const AWALA_SERVER_URL = 'http://127.0.0.1:8081';

async function createTestMember(membersEndpoint: string, client: AuthorityClient): Promise<string> {
  const memberName = randomUUID();
  const command = new MemberCreationCommand({
    endpoint: membersEndpoint,
    role: MemberRole.REGULAR,
    name: memberName,
  });
  const { publicKeyImportTokens: keyImportTokenEndpoint } = await client.send(command);
  return keyImportTokenEndpoint;
}

async function createKeyImportToken(endpoint: string, client: AuthorityClient): Promise<string> {
  const command = new MemberKeyImportTokenCommand({ endpoint, serviceOid: TEST_SERVICE_OID });
  const { token: publicKeyImportToken } = await client.send(command);
  return publicKeyImportToken;
}

async function makeKeyImportEvent(memberPublicKey: CryptoKey, publicKeyImportToken: string) {
  const publicKeyDer = await derSerialisePublicKey(memberPublicKey);
  const importRequest: MemberKeyImportRequest = {
    publicKey: publicKeyDer.toString('base64'),
    publicKeyImportToken,
  };
  const now = new Date();
  return new CloudEvent({
    id: CE_ID,
    source: AWALA_PEER_ID,
    type: INCOMING_SERVICE_MESSAGE_TYPE,
    subject: 'https://relaycorp.tech/awala-endpoint-internet',
    time: formatISO(now),
    expiry: formatISO(addMinutes(now, 1)),
    datacontenttype: 'application/vnd.veraid-authority.member-public-key-import',
    data: importRequest,
  });
}

describe('Awala', () => {
  beforeAll(waitForServers);

  test('Claim key import token', async () => {
    const client = await makeClient(AuthScope.SUPER_ADMIN);

    // Create the necessary setup as an admin:
    const { members: membersEndpoint } = await createTestOrg(client);
    const keyImportTokenEndpoint = await createTestMember(membersEndpoint, client);
    const publicKeyImportToken = await createKeyImportToken(keyImportTokenEndpoint, client);

    // Claim the token as a member via Awala:
    const { publicKey: memberPublicKey } = await generateKeyPair();
    const event = await makeKeyImportEvent(memberPublicKey, publicKeyImportToken);
    const response = await postEvent(event, AWALA_SERVER_URL, {
      signal: AbortSignal.timeout(10_000),
    });

    expect(response.status).toBe(HTTP_STATUS_CODES.ACCEPTED);
  }, 45_000);
});
