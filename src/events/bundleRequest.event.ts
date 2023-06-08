import type { FromSchema } from 'json-schema-to-ts';

export const BUNDLE_REQUEST_TYPE = 'net.veraid.authority.member-bundle-request';

export const MEMBER_BUNDLE_REQUEST_PAYLOAD = {
  type: 'object',

  properties: {
    publicKeyId: { type: 'string' },
    peerId: { type: 'string' },
  },

  required: ['publicKeyId', 'peerId'],
} as const;

export type MemberBundleRequestPayload = FromSchema<typeof MEMBER_BUNDLE_REQUEST_PAYLOAD>;
