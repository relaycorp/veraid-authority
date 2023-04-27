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

import type { MemberKeyImportRequest } from '../schemas/awala.schema.js';
import { OrgModelSchema } from '../models/Org.model.js';
import { generateKeyPair } from '../testUtils/webcrypto.js';
import { derSerialisePublicKey } from '../utilities/webcrypto.js';
import { TEST_SERVICE_OID } from '../testUtils/stubs.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';

import { connectToClusterService } from './utils/kubernetes.js';
import { makeClient, SUPER_ADMIN_EMAIL } from './utils/api.js';
import { ORG_PRIVATE_KEY_ARN, ORG_PUBLIC_KEY_DER, TEST_ORG_NAME } from './utils/veraid.js';
import { KEY_IMPORT_CONTENT_TYPE, postAwalaMessage, STUB_AWALA_PDA } from './utils/awala.js';

const CLIENT = await makeClient(SUPER_ADMIN_EMAIL);

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

describe('E2E', () => {
  test('Get member bundle via Awala', async () => {
    const { members: membersEndpoint } = await createTestOrg();

    const { publicKeyImportTokens: keyImportTokenEndpoint } = await CLIENT.send(
      new MemberCreationCommand({
        endpoint: membersEndpoint,
        role: MemberRole.REGULAR,
      }),
    );

    const keyImportCommand = new MemberKeyImportTokenCommand({
      endpoint: keyImportTokenEndpoint,
      serviceOid: TEST_SERVICE_OID,
    });
    const { token: publicKeyImportToken } = await CLIENT.send(keyImportCommand);

    const memberKeyPair = await generateKeyPair();
    const publicKeyDer = await derSerialisePublicKey(memberKeyPair.publicKey);
    const importMessage: MemberKeyImportRequest = {
      publicKey: publicKeyDer.toString('base64'),
      awalaPda: STUB_AWALA_PDA.toString('base64'),
      publicKeyImportToken,
    };
    const response = await postAwalaMessage(KEY_IMPORT_CONTENT_TYPE, JSON.stringify(importMessage));
    expect(response.status).toBe(HTTP_STATUS_CODES.ACCEPTED);
  });
});
