import { randomUUID } from 'node:crypto';

import {
  type ClientError,
  MemberCreationCommand,
  MemberKeyImportTokenCommand,
  MemberRole,
  OrgCreationCommand,
  type OrgCreationOutput,
  type AuthorityClient,
} from '@relaycorp/veraid-authority';
import { getModelForClass } from '@typegoose/typegoose';
import { createConnection } from 'mongoose';
import { CloudEvent } from 'cloudevents';
import { addMinutes, formatISO } from 'date-fns';

import type { MemberKeyImportRequest } from '../schemas/awala.schema.js';
import { Org } from '../models/Org.model.js';
import { generateKeyPair } from '../testUtils/webcrypto.js';
import { derSerialisePublicKey } from '../utilities/webcrypto.js';
import { AWALA_PEER_ID, TEST_SERVICE_OID } from '../testUtils/stubs.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';
import { CE_ID } from '../testUtils/eventing/stubs.js';
import { INCOMING_SERVICE_MESSAGE_TYPE } from '../events/incomingServiceMessage.event.js';

import { makeClient } from './utils/api.js';
import { ORG_PRIVATE_KEY_ARN, ORG_PUBLIC_KEY_DER, TEST_ORG_NAME } from './utils/veraid.js';
import { postEvent } from './utils/events.js';
import { AuthScope } from './utils/authServer.js';

const AWALA_SERVER_URL = 'http://127.0.0.1:8081';

const MONGODB_URI = 'mongodb://root:password123@localhost';

/**
 * Patch the specified org with the specified key pair.
 *
 * We need this horrendous hack because we need to use an existing key pair and the AWS KMS server
 * doesn't support importing asymmetric keys (only symmetric ones).
 */
async function patchOrgKeyPair(
  orgName: string,
  privateKeyRef: Buffer,
  publicKey: Buffer,
): Promise<void> {
  const connection = await createConnection(MONGODB_URI).asPromise();
  try {
    const orgModel = getModelForClass(Org, { existingConnection: connection });
    await orgModel.findOneAndUpdate({ name: orgName }, { privateKeyRef, publicKey });
  } finally {
    await connection.close();
  }
}

async function createTestOrg(client: AuthorityClient): Promise<OrgCreationOutput> {
  const command = new OrgCreationCommand({ name: TEST_ORG_NAME });

  let output: OrgCreationOutput;
  try {
    output = await client.send(command);
  } catch (err) {
    expect((err as ClientError).statusCode).toBe(HTTP_STATUS_CODES.CONFLICT);

    // The org already exists, but we don't have its URLs and the server doesn't return them
    // subsequently, so we have to hardcode them here.
    output = {
      self: `/orgs/${TEST_ORG_NAME}`,
      members: `/orgs/${TEST_ORG_NAME}/members`,
    };
  }

  await patchOrgKeyPair(TEST_ORG_NAME, Buffer.from(ORG_PRIVATE_KEY_ARN), ORG_PUBLIC_KEY_DER);

  return output;
}

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
  test('Claim key import token', async () => {
    const client = await makeClient(AuthScope.SUPER_ADMIN);

    // Create the necessary setup as an admin:
    const { members: membersEndpoint } = await createTestOrg(client);
    const keyImportTokenEndpoint = await createTestMember(membersEndpoint, client);
    const publicKeyImportToken = await createKeyImportToken(keyImportTokenEndpoint, client);

    // Claim the token as a member via Awala:
    const { publicKey: memberPublicKey } = await generateKeyPair();
    const event = await makeKeyImportEvent(memberPublicKey, publicKeyImportToken);
    const response = await postEvent(event, AWALA_SERVER_URL);

    expect(response.status).toBe(HTTP_STATUS_CODES.ACCEPTED);
  }, 15_000);
});
