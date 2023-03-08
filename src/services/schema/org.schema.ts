export const ORG_SCHEMA = {
  type: 'object',

  properties: {
    name: { type: 'string' },

    memberAccessType: {
      type: 'string',
      enum: ['INVITE_ONLY', 'OPEN'],
    },

    awalaInternetEndpoint: { type: 'string' },
  },

  required: ['name', 'memberAccessType'],
} as const;
