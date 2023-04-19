export const MEMBER_KEY_IMPORT_TYPE = 'net.veraid.authority.member-public-key-import';

export interface MemberKeyImportPayload {
  publicKeyId: string;
  awalaPda: string;
}
