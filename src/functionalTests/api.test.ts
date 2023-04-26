import { randomUUID } from 'node:crypto';

import {
  AuthorityClient,
  ClientError,
  MemberCreationCommand,
  MemberPublicKeyImportCommand,
  MemberRole,
  OrgCreationCommand,
} from '@relaycorp/veraid-authority';

import { HTTP_STATUS_CODES } from '../utilities/http.js';
import { MEMBER_EMAIL, TEST_SERVICE_OID } from '../testUtils/stubs.js';
import { generateKeyPair } from '../testUtils/webcrypto.js';
import { derSerialisePublicKey } from '../utilities/webcrypto.js';

import { authenticate } from './utils/authentication.js';
import { getServiceUrl } from './utils/knative.js';

const SUPER_ADMIN_EMAIL = 'admin@veraid.example';

const API_URL = await getServiceUrl('veraid-authority');

async function makeClient(userEmail: string): Promise<AuthorityClient> {
  const authHeader = await authenticate(userEmail);
  return new AuthorityClient(API_URL, authHeader);
}

function generateOrgName(): string {
  return `${randomUUID()}.example`;
}

describe('API', () => {
  test('Healthcheck should return 2XX response', async () => {
    const response = await fetch(API_URL);

    expect(response.status).toBe(200);
  });

  describe('Orgs', () => {
    describe('Authentication', () => {
      test('Anonymous request to should be refused', async () => {
        const response = await fetch(`${API_URL}/orgs`, { method: 'POST' });

        expect(response.status).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
      });

      test('Invalid access token should be refused', async () => {
        const client = new AuthorityClient(API_URL, { scheme: 'Foo', parameters: 'Bar' });
        const command = new OrgCreationCommand({ name: generateOrgName() });

        await expect(client.send(command)).rejects.toThrowWithMessage(
          ClientError,
          /refused access token/u,
        );
      });
    });

    test('Create org as super admin', async () => {
      const client = await makeClient(SUPER_ADMIN_EMAIL);
      const command = new OrgCreationCommand({ name: generateOrgName() });

      await expect(client.send(command)).toResolve();
    });

    test('Create org admin as super admin', async () => {
      const client = await makeClient(SUPER_ADMIN_EMAIL);
      const { members: membersEndpoint } = await client.send(
        new OrgCreationCommand({ name: generateOrgName() }),
      );

      const orgAdminCreationCommand = new MemberCreationCommand({
        endpoint: membersEndpoint,
        role: MemberRole.ORG_ADMIN,
      });
      await expect(client.send(orgAdminCreationCommand)).toResolve();
    });

    test('Create member as org admin', async () => {
      const superAdminClient = await makeClient(SUPER_ADMIN_EMAIL);
      const { members: membersEndpoint } = await superAdminClient.send(
        new OrgCreationCommand({ name: generateOrgName() }),
      );
      await superAdminClient.send(
        new MemberCreationCommand({
          endpoint: membersEndpoint,
          role: MemberRole.ORG_ADMIN,
          email: MEMBER_EMAIL,
        }),
      );

      const orgAdminClient = await makeClient(MEMBER_EMAIL);
      const memberCreationCommand = new MemberCreationCommand({
        endpoint: membersEndpoint,
        role: MemberRole.REGULAR,
      });
      await expect(orgAdminClient.send(memberCreationCommand)).toResolve();
    });

    test('Import public key as regular org member', async () => {
      const superAdminClient = await makeClient(SUPER_ADMIN_EMAIL);
      const { members: membersEndpoint } = await superAdminClient.send(
        new OrgCreationCommand({ name: generateOrgName() }),
      );
      const { publicKeys: publicKeysEndpoint } = await superAdminClient.send(
        new MemberCreationCommand({
          endpoint: membersEndpoint,
          role: MemberRole.REGULAR,
          email: MEMBER_EMAIL,
        }),
      );

      const memberClient = await makeClient(MEMBER_EMAIL);
      const { publicKey } = await generateKeyPair();
      const keyImportCommand = new MemberPublicKeyImportCommand({
        endpoint: publicKeysEndpoint,
        publicKeyDer: await derSerialisePublicKey(publicKey),
        serviceOid: TEST_SERVICE_OID,
      });
      await expect(memberClient.send(keyImportCommand)).toResolve();
    });
  });
});
