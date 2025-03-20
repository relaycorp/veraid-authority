import type { FromSchema, JSONSchema } from 'json-schema-to-ts';

export const MEMBER_SCHEMA = {
  type: 'object',

  properties: {
    name: { type: ['string', 'null'] },
    email: { type: ['string', 'null'], format: 'email' },

    role: {
      type: 'string',
      enum: ['ORG_ADMIN', 'REGULAR'],
    },
  },

  required: ['role'],
} as const satisfies JSONSchema;

export const PATCH_MEMBER_SCHEMA = {
  ...MEMBER_SCHEMA,
  required: [],
} as const satisfies JSONSchema;

export const memberSchemaRoles = MEMBER_SCHEMA.properties.role.enum;
export type MemberSchemaRole = (typeof memberSchemaRoles)[number];
export type MemberSchema = FromSchema<typeof MEMBER_SCHEMA>;
export type PatchMemberSchema = FromSchema<typeof PATCH_MEMBER_SCHEMA>;
