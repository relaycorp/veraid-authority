import type { FromSchema } from 'json-schema-to-ts';

const ORG_READ_SCHEMA = {
  type: 'object',

  properties: {
    name: { type: 'string' },
    publicKey: { type: 'string' },
  },

  required: ['name', 'publicKey'],
} as const;
export const ORG_CREATION_SCHEMA = {
  type: 'object',

  properties: {
    name: { type: 'string' },
  },

  required: ['name'],
} as const;
export const ORG_PATCH_SCHEMA = {
  ...ORG_CREATION_SCHEMA,
  required: [],
} as const;

export type OrgReadSchema = FromSchema<typeof ORG_READ_SCHEMA>;
export type OrgCreationSchema = FromSchema<typeof ORG_CREATION_SCHEMA>;
export type OrgPatchSchema = FromSchema<typeof ORG_PATCH_SCHEMA>;
