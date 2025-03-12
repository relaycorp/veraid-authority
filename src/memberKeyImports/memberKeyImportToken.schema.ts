import type { FromSchema } from 'json-schema-to-ts';

import { SERVICE_OID_REGEX } from '../utilities/schemaValidation.js';

export const MEMBER_KEY_IMPORT_TOKEN_SCHEMA = {
  type: 'object',

  properties: {
    serviceOid: { type: 'string', pattern: SERVICE_OID_REGEX },
  },

  required: ['serviceOid'],
} as const;

export type MemberKeyImportTokenSchema = FromSchema<typeof MEMBER_KEY_IMPORT_TOKEN_SCHEMA>;
