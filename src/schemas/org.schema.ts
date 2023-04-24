import type { FromSchema } from 'json-schema-to-ts';

export const ORG_SCHEMA = {
  type: 'object',

  properties: {
    name: { type: 'string' },
  },

  required: ['name'],
} as const;
export const ORG_SCHEMA_PATCH = {
  ...ORG_SCHEMA,
  required: [],
} as const;

export type OrgSchema = FromSchema<typeof ORG_SCHEMA>;
export type OrgSchemaPatch = FromSchema<typeof ORG_SCHEMA_PATCH>;
