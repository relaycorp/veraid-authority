import type { MemberSchema } from './services/schema/member.schema.js';
import { Role } from './models/Member.model.js';

export interface MemberCreationResult {
  id: string;
}

export const ROLE_MAPPING: {
  [key in MemberSchema['role']]: Role;
} = {
  ORG_ADMIN: Role.ORG_ADMIN,
  REGULAR: Role.REGULAR,
} as const;
