import { Role } from './Member.model.js';
import type { MemberSchema } from './member.schema.js';

export interface MemberCreationResult {
  id: string;
}

export const ROLE_MAPPING: {
  [key in MemberSchema['role']]: Role;
} = {
  ORG_ADMIN: Role.ORG_ADMIN,
  REGULAR: Role.REGULAR,
} as const;

export const REVERSE_ROLE_MAPPING: {
  [key in Role]: MemberSchema['role'];
} = {
  [Role.ORG_ADMIN]: 'ORG_ADMIN',
  [Role.REGULAR]: 'REGULAR',
};
