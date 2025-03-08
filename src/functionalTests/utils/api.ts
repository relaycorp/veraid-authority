import { AuthorityClient } from '@relaycorp/veraid-authority';

import { authenticate, type AuthScope } from './authServer.js';

export const API_URL = 'http://127.0.0.1:8080';

export async function makeClient(scope: AuthScope): Promise<AuthorityClient> {
  const authHeader = await authenticate(scope);
  return new AuthorityClient(API_URL, authHeader, {
    timeoutMs: 3000,
  });
}
