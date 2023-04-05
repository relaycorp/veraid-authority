import type { FromSchema } from 'json-schema-to-ts';

export const MEMBER_PUBLIC_KEY_SCHEMA = {
  type: 'object',

  properties: {
    publicKey: { type: 'string' },
    oid: {type: 'string'},
  },

  required: ['oid', 'publicKey'],
} as const;


export type MemberPublicKeySchema = FromSchema<typeof MEMBER_PUBLIC_KEY_SCHEMA>;

