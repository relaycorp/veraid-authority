import { randomUUID } from 'node:crypto';

import {
  MemberCreationCommand,
  MemberRole,
  SignatureSpecCreationCommand,
} from '@relaycorp/veraid-authority';
import { type Member, SignatureBundle } from '@relaycorp/veraid';

import { TEST_SERVICE_OID } from '../testUtils/stubs.js';
import { stringToArrayBuffer } from '../testUtils/buffer.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';

import { waitForServers } from './utils/wait.js';
import { makeClient } from './utils/api.js';
import { authenticate, AuthScope } from './utils/authServer.js';
import { TEST_ORG_NAME } from './utils/veraid.js';
import { createTestOrg } from './utils/testOrg.js';

const TEST_MEMBER_NAME = randomUUID();

async function createSignatureSpec(plaintext: ArrayBuffer): Promise<URL> {
  const superAdminClient = await makeClient(AuthScope.SUPER_ADMIN);

  const { members: membersEndpoint } = await createTestOrg(superAdminClient);

  const { signatureSpecs } = await superAdminClient.send(
    new MemberCreationCommand({
      endpoint: membersEndpoint,
      name: TEST_MEMBER_NAME,
      role: MemberRole.REGULAR,
    }),
  );

  const signatureSpecCommand = new SignatureSpecCreationCommand({
    endpoint: signatureSpecs,

    auth: {
      type: 'oidc-discovery',
      providerIssuerUrl: 'http://mock-authz-server:8080/default',
      jwtSubjectClaim: 'email',
      jwtSubjectValue: 'machine@cloud-provider.example',
    },

    serviceOid: TEST_SERVICE_OID,
    ttlSeconds: 300,
    plaintext,
  });

  const { exchangeUrl } = await superAdminClient.send(signatureSpecCommand);
  return new URL(exchangeUrl);
}

describe('Credentials Exchange API', () => {
  beforeAll(waitForServers);

  test('Should exchange JWT for signature bundle', async () => {
    const signaturePlaintext = stringToArrayBuffer('Hello world');
    const exchangeUrl = await createSignatureSpec(signaturePlaintext);
    const { parameters: jwt } = await authenticate(AuthScope.WORKLOAD, {
      audience: exchangeUrl.toString(),
    });

    const signatureBundleResponse = await fetch(exchangeUrl, {
      headers: new Headers([['Authorization', `Bearer ${jwt}`]]),
    });

    expect(signatureBundleResponse.status).toBe(HTTP_STATUS_CODES.OK);
    const signatureBundleBinary = await signatureBundleResponse.arrayBuffer();
    const signatureBundle = SignatureBundle.deserialise(signatureBundleBinary);
    const { member, plaintext } = await signatureBundle.verify(undefined, TEST_SERVICE_OID);
    expect(member).toMatchObject<Member>({
      organisation: TEST_ORG_NAME,
      user: TEST_MEMBER_NAME,
    });
    expect(Buffer.from(plaintext).equals(Buffer.from(signaturePlaintext))).toBeTrue();
  });
});
