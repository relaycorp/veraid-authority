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
export const ORG_SCHEMA_PATCH = {
  ...ORG_SCHEMA,
  required: [],
} as const;

export const orgSchemaMemberAccessTypes = ORG_SCHEMA.properties.memberAccessType.enum;
export type OrgSchemaMemberAccessType = (typeof orgSchemaMemberAccessTypes)[number];
export type OrgSchema = FromSchema<typeof ORG_SCHEMA>;
export type OrgSchemaPatch = FromSchema<typeof ORG_SCHEMA_PATCH>;
