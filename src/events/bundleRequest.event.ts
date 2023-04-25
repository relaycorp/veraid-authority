import { BASE_64_REGEX } from '../schemas/validation.js';
import { FromSchema } from 'json-schema-to-ts';

export const BUNDLE_REQUEST_TYPE = 'net.veraid.authority.member-bundle-request';

export const MEMBER_BUNDLE_REQUEST_PAYLOAD_SCHEMA = {
  type: 'object',
  properties: {
    publicKeyId: { type: 'string' },
    awalaPda: { type: 'string', pattern: BASE_64_REGEX },
  },
  required: ['publicKeyId', 'awalaPda'],
} as const;


export type MemberBundleRequestPayload = FromSchema<typeof MEMBER_BUNDLE_REQUEST_PAYLOAD_SCHEMA>;
