import { AuthorityClient } from '@relaycorp/veraid-authority';

import { getServiceUrl } from './knative.js';
import { authenticate } from './authServer.js';

export const SUPER_ADMIN_EMAIL = 'admin@veraid.example';
export const API_URL = await getServiceUrl('veraid-authority');

export async function makeClient(userEmail: string): Promise<AuthorityClient> {
  const authHeader = await authenticate(userEmail);
  return new AuthorityClient(API_URL, authHeader);
}
