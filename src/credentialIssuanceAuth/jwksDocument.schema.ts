import type { FromSchema, JSONSchema } from 'json-schema-to-ts';

import { compileSchema } from '../utilities/ajv.js';

const JWKS_DOCUMENT_SCHEMA = {
  type: 'object',

  properties: {
    keys: {
      type: 'array',

      items: {
        type: 'object',
      },

      minItems: 1,
    },
  },

  required: ['keys'],
} as const satisfies JSONSchema;

export type JwksDocumentSchema = FromSchema<typeof JWKS_DOCUMENT_SCHEMA>;

export const validateJwksDocument = compileSchema(JWKS_DOCUMENT_SCHEMA);
