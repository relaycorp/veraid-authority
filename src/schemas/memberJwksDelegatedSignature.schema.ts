import type { FromSchema } from 'json-schema-to-ts';

import { SERVICE_OID_REGEX } from './validation.js';

// eslint-disable-next-line id-length
export const MEMBER_JWKS_DELEGATED_SIGNATURE_SCHEMA = {
  type: 'object',

  properties: {
    jwksUrl: { type: 'string' },
    jwtSubjectField: { type: 'string' },
    jwtSubjectValue: { type: 'string' },
    veraidServiceOid: { type: 'string', pattern: SERVICE_OID_REGEX },
    veraidSignatureTtlSeconds: { type: 'integer', minimum: 1, maximum: 3600 },
    veraidSignaturePlaintext: { type: 'string', maxLength: 1024 },
  },

  required: [
    'jwksUrl',
    'jwtSubjectField',
    'jwtSubjectValue',
    'veraidServiceOid',
    'veraidSignaturePlaintext',
  ],
} as const;

export type MemberJwksDelegatedSignatureSchema = FromSchema<
  typeof MEMBER_JWKS_DELEGATED_SIGNATURE_SCHEMA
>;
