import type { FromSchema } from 'json-schema-to-ts';

import { SERVICE_OID_REGEX } from '../../utilities/schemaValidation.js';

export const SIGNATURE_SPEC_SCHEMA = {
  type: 'object',

  properties: {
    openidProviderIssuerUrl: { type: 'string', format: 'uri' },
    jwtSubjectClaim: { type: 'string' },
    jwtSubjectValue: { type: 'string' },
    veraidServiceOid: { type: 'string', pattern: SERVICE_OID_REGEX },
    veraidSignatureTtlSeconds: { type: 'integer', minimum: 1, maximum: 3600 },
    veraidSignaturePlaintext: { type: 'string', maxLength: 1024 },
  },

  required: [
    'openidProviderIssuerUrl',
    'jwtSubjectClaim',
    'jwtSubjectValue',
    'veraidServiceOid',
    'veraidSignaturePlaintext',
  ],
} as const;

export type SignatureSpecSchema = FromSchema<
  typeof SIGNATURE_SPEC_SCHEMA,
  {
    deserialize: [{ pattern: { type: 'string'; format: 'uri' }; output: URL }];
  }
>;
