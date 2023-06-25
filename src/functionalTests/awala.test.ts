import { randomUUID } from 'node:crypto';

import {
  MemberCreationCommand,
  MemberKeyImportTokenCommand,
  MemberRole,
  OrgCreationCommand,
  type OrgCreationOutput,
  ServerError,
} from '@relaycorp/veraid-authority';
import { getModelForClass } from '@typegoose/typegoose';
import { createConnection } from 'mongoose';
import { CloudEvent } from 'cloudevents';
import { addMinutes, formatISO } from 'date-fns';

import type { MemberKeyImportRequest } from '../schemas/awala.schema.js';
import { OrgModelSchema } from '../models/Org.model.js';
import { generateKeyPair } from '../testUtils/webcrypto.js';
import { derSerialisePublicKey } from '../utilities/webcrypto.js';
import { AWALA_PEER_ID, TEST_SERVICE_OID } from '../testUtils/stubs.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';
import { CE_ID } from '../testUtils/eventing/stubs.js';
import { INCOMING_SERVICE_MESSAGE_TYPE } from '../events/incomingServiceMessage.event.js';

import { connectToClusterService } from './utils/kubernetes.js';
import { makeClient, SUPER_ADMIN_EMAIL } from './utils/api.js';
import { ORG_PRIVATE_KEY_ARN, ORG_PUBLIC_KEY_DER, TEST_ORG_NAME } from './utils/veraid.js';
import { getServiceUrl } from './utils/knative.js';
import { postEvent } from './utils/events.js';

const CLIENT = await makeClient(SUPER_ADMIN_EMAIL);

const AWALA_SERVER_URL = await getServiceUrl('veraid-authority-awala');

const MONGODB_PORT = 27_017;
const MONGODB_LOCAL_BASE_URI = 'mongodb://root:password123@localhost';

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
  await connectToClusterService('mongodb', MONGODB_PORT, async (localPort) => {
    const connection = createConnection(`${MONGODB_LOCAL_BASE_URI}:${localPort}`);
    try {
      const orgModel = getModelForClass(OrgModelSchema, { existingConnection: connection });
      await orgModel.findOneAndUpdate({ name: orgName }, { privateKeyRef, publicKey });
    } finally {
      await connection.close();
    }
  });
}

async function createTestOrg(): Promise<OrgCreationOutput> {
  const command = new OrgCreationCommand({ name: TEST_ORG_NAME });

  let output: OrgCreationOutput;
  try {
    output = await CLIENT.send(command);
  } catch (err) {
    expect(err).toBeInstanceOf(ServerError);

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

async function createTestMember(membersEndpoint: string) {
  const memberName = randomUUID();
  const command = new MemberCreationCommand({
    endpoint: membersEndpoint,
    role: MemberRole.REGULAR,
    name: memberName,
  });
  const { publicKeyImportTokens: keyImportTokenEndpoint } = await CLIENT.send(command);
  return keyImportTokenEndpoint;
}

async function createKeyImportToken(endpoint: string) {
  const command = new MemberKeyImportTokenCommand({ endpoint, serviceOid: TEST_SERVICE_OID });
  const { token: publicKeyImportToken } = await CLIENT.send(command);
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
    datacontenttype: 'application/vnd.veraid.member-public-key-import',
    data: importRequest,
  });
}

describe('Awala', () => {
  test('Claim key import token', async () => {
    // Create the necessary setup as an admin:
    const { members: membersEndpoint } = await createTestOrg();
    const keyImportTokenEndpoint = await createTestMember(membersEndpoint);
    const publicKeyImportToken = await createKeyImportToken(keyImportTokenEndpoint);

    // Claim the token as a member via Awala:
    const { publicKey: memberPublicKey } = await generateKeyPair();
    const event = await makeKeyImportEvent(memberPublicKey, publicKeyImportToken);
    const response = await postEvent(event, AWALA_SERVER_URL);

    expect(response.status).toBe(HTTP_STATUS_CODES.ACCEPTED);
  });
});
