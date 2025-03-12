import type { FromSchema } from 'json-schema-to-ts';

import { SERVICE_OID_REGEX } from '../../utilities/schemaValidation.js';

export const MEMBER_WORKLOAD_IDENTITY_SCHEMA = {
  type: 'object',

  properties: {
    openidProviderIssuerUrl: { type: 'string' },
    jwtSubjectField: { type: 'string' },
    jwtSubjectValue: { type: 'string' },
    veraidServiceOid: { type: 'string', pattern: SERVICE_OID_REGEX },
    veraidSignatureTtlSeconds: { type: 'integer', minimum: 1, maximum: 3600 },
    veraidSignaturePlaintext: { type: 'string', maxLength: 1024 },
  },

  required: [
    'openidProviderIssuerUrl',
    'jwtSubjectField',
    'jwtSubjectValue',
    'veraidServiceOid',
    'veraidSignaturePlaintext',
  ],
} as const;

export type MemberWorkloadIdentitySchema = FromSchema<typeof MEMBER_WORKLOAD_IDENTITY_SCHEMA>;
