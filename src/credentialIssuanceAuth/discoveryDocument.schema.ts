import type { JSONSchema } from 'json-schema-to-ts';

import { compileSchema } from '../utilities/ajv.js';

const DISCOVERY_DOCUMENT_SCHEMA = {
  type: 'object',

  properties: {
    // eslint-disable-next-line @typescript-eslint/naming-convention, camelcase
    jwks_uri: { type: 'string' },
  },

  required: ['jwks_uri'],
} as const satisfies JSONSchema;

export const validateDiscoveryDocument = compileSchema(DISCOVERY_DOCUMENT_SCHEMA);
