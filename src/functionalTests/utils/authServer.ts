import { stringify } from 'node:querystring';

import type { AuthorizationHeader } from '@relaycorp/veraid-authority';

import { HTTP_STATUS_CODES } from '../../utilities/http.js';

import { getServiceUrl } from './knative.js';

const AUTH_SERVER_URL = await getServiceUrl('mock-authz-server');
const AUTH_ENDPOINT_URL = `${AUTH_SERVER_URL}/default/token`;

export async function authenticate(clientId: string): Promise<AuthorizationHeader> {
  const body = {
    // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
    grant_type: 'client_credentials',
    // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
    client_id: clientId,
    // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
    client_secret: 's3cr3t',
  };
  const response = await fetch(AUTH_ENDPOINT_URL, {
    method: 'POST',
    headers: new Headers([['Content-Type', 'application/x-www-form-urlencoded']]),
    body: stringify(body),
  });
  expect(response.status).toBe(HTTP_STATUS_CODES.OK);
  const { token_type: scheme, access_token: parameters } = await response.json();
  return { scheme, parameters };
}
