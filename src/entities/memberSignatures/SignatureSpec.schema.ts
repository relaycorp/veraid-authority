import type { FromSchema } from 'json-schema-to-ts';

import { SERVICE_OID_REGEX } from '../../utilities/schemaValidation.js';

export const SIGNATURE_SPEC_SCHEMA = {
  type: 'object',

  properties: {
    auth: {
      type: 'object',

      properties: {
        type: { type: 'string', enum: ['oidc-discovery'] },
        openidProviderIssuerUrl: { type: 'string', format: 'uri' },
        jwtSubjectClaim: { type: 'string' },
        jwtSubjectValue: { type: 'string' },
      },

      required: ['type', 'openidProviderIssuerUrl', 'jwtSubjectClaim', 'jwtSubjectValue'],
    },

    veraidServiceOid: { type: 'string', pattern: SERVICE_OID_REGEX },
    veraidSignatureTtlSeconds: { type: 'integer', minimum: 1, maximum: 3600 },
    veraidSignaturePlaintext: { type: 'string', maxLength: 1024 },
  },

  required: ['auth', 'veraidServiceOid', 'veraidSignaturePlaintext'],
} as const;

export type SignatureSpecSchema = FromSchema<
  typeof SIGNATURE_SPEC_SCHEMA,
  {
    deserialize: [{ pattern: { type: 'string'; format: 'uri' }; output: URL }];
  }
>;
