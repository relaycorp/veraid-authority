export enum JwtVerificationProblem {
  JWKS_RETRIEVAL_ERROR = 'https://veraid.net/problems/jwt-verification-jwks-retrieval-error',
  INVALID_JWT = 'https://veraid.net/problems/jwt-verification-invalid-jwt',
  EXPIRED_JWT = 'https://veraid.net/problems/jwt-verification-expired-jwt',
}
