import type { FromSchema } from 'json-schema-to-ts';

export const ORG_SCHEMA = {
  type: 'object',

  properties: {
    name: { type: 'string' },

    memberAccessType: {
      type: 'string',
      enum: ['INVITE_ONLY', 'OPEN'],
    },

    awalaEndpoint: { type: 'string' },
  },

  required: ['name', 'memberAccessType'],
} as const;

export type OrgSchema = FromSchema<typeof ORG_SCHEMA>;
