import type { FromSchema } from 'json-schema-to-ts';

export const MEMBER_SCHEMA = {
  type: 'object',

  properties: {
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },

    role: {
      type: 'string',
      enum: ['ORG_ADMIN', 'REGULAR'],
    },
  },

  required: ['role'],
} as const;

export const memberSchemaRoles = MEMBER_SCHEMA.properties.role.enum;
export type MemberSchemaRole = (typeof memberSchemaRoles)[number];
export type MemberSchema = FromSchema<typeof MEMBER_SCHEMA>;
