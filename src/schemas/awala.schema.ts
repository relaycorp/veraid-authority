import type { FromSchema } from 'json-schema-to-ts';

import { compileSchema } from '../utilities/ajv.js';

import { BASE_64_REGEX } from './validation.js';

const MEMBER_BUNDLE_REQUEST_SCHEMA = {
  type: 'object',

  properties: {
    publicKeyId: { type: 'string' },
    memberBundleStartDate: { type: 'string', format: 'date-time' },
    signature: { type: 'string', pattern: BASE_64_REGEX },
    peerId: { type: 'string', minLength: 1 },
  },

  required: ['publicKeyId', 'memberBundleStartDate', 'signature', 'peerId'],
} as const;

const MEMBER_KEY_IMPORT_REQUEST_SCHEMA = {
  type: 'object',

  properties: {
    publicKeyImportToken: { type: 'string' },
    publicKey: { type: 'string' },
  },

  required: ['publicKeyImportToken', 'publicKey'],
} as const;

export type MemberBundleRequest = FromSchema<typeof MEMBER_BUNDLE_REQUEST_SCHEMA>;
export const isMemberBundleRequest = compileSchema(MEMBER_BUNDLE_REQUEST_SCHEMA);

export type MemberKeyImportRequest = FromSchema<typeof MEMBER_KEY_IMPORT_REQUEST_SCHEMA>;
export const isMemberKeyImportRequest = compileSchema(MEMBER_KEY_IMPORT_REQUEST_SCHEMA);
