export const BUNDLE_REQUEST_TYPE = 'net.veraid.authority.member-bundle-request';

export interface MemberBundleRequestPayload {
  publicKeyId: string;
  awalaPda: string;
}
