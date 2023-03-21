import type { Connection } from 'mongoose';
import type { BaseLogger } from 'pino';

import type { OrgSchema } from './services/schema/org.schema.js';
import { MemberAccessType } from './models/Org.model.js';

export interface ServiceOptions {
  readonly dbConnection: Connection;
  readonly logger: BaseLogger;
}

export interface OrgCreationResult {
  name: string;
}

export const MEMBER_ACCESS_TYPE_MAPPING: {
  [key in OrgSchema['memberAccessType']]: MemberAccessType;
} = {
  INVITE_ONLY: MemberAccessType.INVITE_ONLY,
  OPEN: MemberAccessType.OPEN,
} as const;

export const REVERSE_MEMBER_ACCESS_MAPPING: {
  [key in MemberAccessType]: OrgSchema['memberAccessType'];
} = {
  [MemberAccessType.INVITE_ONLY]: 'INVITE_ONLY',
  [MemberAccessType.OPEN]: 'OPEN',
};
