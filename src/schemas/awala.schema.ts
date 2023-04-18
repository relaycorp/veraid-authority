import type { FromSchema } from 'json-schema-to-ts';

import { BASE_64_REGEX } from './validation.js';

export const MEMBER_BUNDLE_REQUEST_SCHEMA = {
  type: 'object',

  properties: {
    publicKeyId: { type: 'string' },
    memberBundleStartDate: { type: 'string', format: 'date-time' },
    signature: { type: 'string', pattern: BASE_64_REGEX },
    awalaPda: { type: 'string', pattern: BASE_64_REGEX },
  },

  required: ['publicKeyId', 'memberBundleStartDate', 'signature', 'awalaPda'],
} as const;

export const MEMBER_KEY_IMPORT_REQUEST_SCHEMA = {
  type: 'object',

  properties: {
    publicKeyImportToken: { type: 'string' },
    publicKey: { type: 'string' },
    awalaPda: { type: 'string', pattern: BASE_64_REGEX },
  },

  required: ['publicKeyImportToken', 'publicKey', 'awalaPda'],
} as const;

export type MemberBundleRequest = FromSchema<typeof MEMBER_BUNDLE_REQUEST_SCHEMA>;
export type MemberKeyImportRequest = FromSchema<typeof MEMBER_KEY_IMPORT_REQUEST_SCHEMA>;
