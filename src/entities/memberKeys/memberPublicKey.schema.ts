import type { FromSchema, JSONSchema } from 'json-schema-to-ts';

import { SERVICE_OID_REGEX } from '../../utilities/schemaValidation.js';

export const MEMBER_PUBLIC_KEY_SCHEMA = {
  type: 'object',

  properties: {
    publicKey: { type: 'string' },
    serviceOid: { type: 'string', pattern: SERVICE_OID_REGEX },
  },

  required: ['serviceOid', 'publicKey'],
} as const satisfies JSONSchema;

export type MemberPublicKeySchema = FromSchema<typeof MEMBER_PUBLIC_KEY_SCHEMA>;
