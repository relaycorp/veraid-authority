import type { FromSchema } from 'json-schema-to-ts';

import { BASE_64_REGEX } from '../schemas/validation.js';

export const MEMBER_KEY_IMPORT_TYPE = 'net.veraid.authority.member-public-key-import';

export const MEMBER_KEY_IMPORT_PAYLOAD = {
  type: 'object',

  properties: {
    publicKeyId: { type: 'string' },
    awalaPda: { type: 'string', pattern: BASE_64_REGEX },
  },

  required: ['publicKeyId', 'awalaPda'],
} as const;

export type MemberKeyImportPayload = FromSchema<typeof MEMBER_KEY_IMPORT_PAYLOAD>;
