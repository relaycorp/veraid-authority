import type { FromSchema } from 'json-schema-to-ts';

export const MEMBER_PUBLIC_KEY_SCHEMA = {
  type: 'object',

  properties: {
    publicKey: { type: 'string' },
    serviceOid: { type: 'string', pattern: '^(?:[0-9]+\\.)*[0-9]+$' },
  },

  required: ['serviceOid', 'publicKey'],
} as const;

export type MemberPublicKeySchema = FromSchema<typeof MEMBER_PUBLIC_KEY_SCHEMA>;
