import {
  type ClientError,
  OrgCreationCommand,
  type OrgCreationOutput,
  type AuthorityClient,
} from '@relaycorp/veraid-authority';
import { getModelForClass } from '@typegoose/typegoose';
import { createConnection, type ConnectOptions } from 'mongoose';

import { Org } from '../../entities/organisations/Org.model.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';

import { TEST_ORG_NAME, ORG_PRIVATE_KEY_ARN, ORG_PUBLIC_KEY_DER } from './veraid.js';

const MONGODB_URI = 'mongodb://root:password123@127.0.0.1:27017/endpoint';
const TIMEOUT_CONFIG: ConnectOptions = {
  appName: 'functional-tests',
  authSource: 'admin',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  connectTimeoutMS: 10_000,
  maxPoolSize: 1,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  serverSelectionTimeoutMS: 10_000,
};

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
  const connection = await createConnection(MONGODB_URI, TIMEOUT_CONFIG).asPromise();
  try {
    const orgModel = getModelForClass(Org, { existingConnection: connection });
    await orgModel.findOneAndUpdate({ name: orgName }, { privateKeyRef, publicKey });
  } finally {
    await connection.close();
  }
}

export async function createTestOrg(client: AuthorityClient): Promise<OrgCreationOutput> {
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
