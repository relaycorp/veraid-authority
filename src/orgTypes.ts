import type { OrgSchema } from './schemas/org.schema.js';
import { MemberAccessType } from './models/Org.model.js';

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
