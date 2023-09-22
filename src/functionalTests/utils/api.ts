import { AuthorityClient } from '@relaycorp/veraid-authority';

import { getServiceUrl } from './knative.js';
import { authenticate, type AuthScope } from './authServer.js';

export const API_URL = await getServiceUrl('veraid-authority');

export async function makeClient(scope: AuthScope): Promise<AuthorityClient> {
  const authHeader = await authenticate(scope);
  return new AuthorityClient(API_URL, authHeader);
}
