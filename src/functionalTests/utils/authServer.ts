import { stringify } from 'node:querystring';

import type { AuthorizationHeader } from '@relaycorp/veraid-authority';

import { HTTP_STATUS_CODES } from '../../utilities/http.js';

import { post } from './http.js';

const AUTH_SERVER_URL = 'http://127.0.0.1:8083';
const AUTH_ENDPOINT_URL = `${AUTH_SERVER_URL}/default/token`;

// `Host` request header must match the host that Authority will use to access the OAuth2 server.
// This ensures that the `iss` claim in the JWT will match the expected issues.
const HOST_HEADER = 'mock-authz-server:8080';

export enum AuthScope {
  SUPER_ADMIN = 'super-admin',
  USER = 'user',
  WORKLOAD = 'workload',
}

export async function authenticate(
  scope: AuthScope,
  extraBodyFields: { [key: string]: string } = {},
): Promise<AuthorizationHeader> {
  const body = {
    // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
    grant_type: 'client_credentials',
    // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
    client_id: scope,
    // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
    client_secret: 's3cr3t',
    scope: 'default',
    ...extraBodyFields,
  };
  const response = await post(AUTH_ENDPOINT_URL, {
    headers: new Headers([
      ['Content-Type', 'application/x-www-form-urlencoded'],
      ['Host', HOST_HEADER],
    ]),

    body: stringify(body),
  });
  expect(response.status).toBe(HTTP_STATUS_CODES.OK);
  const { token_type: scheme, access_token: parameters } = await response.json();
  return { scheme, parameters };
}
