---
permalink: /api
nav_order: 2
---
# Organisation Management API

The API server contains the RESTful API to manage VeraId organisations under the prefix `/orgs`.

## Authentication and authorisation

We use OAuth2 with JWKS to delegate authentication to an external identity provider. We require the JWT token to define the user's email address in the [OIDC `email` claim](https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims).

The API employs the following roles:

- Super admin. They can do absolutely anything on any organisation.
- Org admin. They can do anything within their own organisation.
- Org member. They can manage much of their own membership in their respective organisation.

Authorisation grant logs use the level `DEBUG` to minimise PII transmission and storage for legal/privacy reasons, whilst denial logs use the level `INFO` for auditing purposes.

## Endpoints

Unless otherwise specified, all inputs and outputs will be JSON serialised.

### Organisations

- `POST /orgs`: Create org.
  - Auth: Admin.
  - Input:
    - Name (e.g., `acme.com`).
    - [Awala endpoint middleware](https://github.com/relaycorp/relayverse/issues/28) URL (optional).
  - Output:
    - Org name.
    - Org public key.
    - TXT record RDATA with TTL override of 1 hour.
- `GET /orgs/{orgName}`: Get org.
  - Auth: Org admin.
  - Output:
    - URLs to the org's endpoint and direct descendants.
    - Org public key.
    - TXT record RDATA with TTL override of 1 hour.
- `PATCH /orgs/{orgName}`: Modify org.
  - Auth: Org admin.
  - Input: Same as `POST /orgs`, but org name can't be changed.
- `DELETE /orgs/{orgName}`: Delete org.
  - Auth: Org admin.

### Members

- `POST /orgs/{orgName}/members`: Create member.
  - Auth: Org admin.
  - Input:
    - Name (used in VeraId member certificates; `null` if member is a bot).
    - Email (optional; needed if they'll access this API, not needed if they'll use Awala).
    - Role: `org_admin` or `regular`.
  - Output:
    - URL to the new member on this API.
- `GET /orgs/{orgName}/members/{memberId}`: Get member.
  - Auth: Org admin.
- `PATCH /orgs/{orgName}/members/{memberId}`: Modify member.
  - Auth: Org admin.
  - Input: Same as in `POST /orgs/{orgName}/members`.
- `DELETE /orgs/{orgName}/members/{memberId}`: Delete member.
  - Auth: Org admin.

### Public Keys

- `POST /orgs/{orgName}/members/{memberId}/public-keys`: Register public key for member.
  - Auth: Org member.
  - Input:
    - The DER-encoded public key.
    - The OID for the service where the respective bundles will be valid (e.g., `1.2.3.4.5`).
  - Output: The URL for the new key.
- `DELETE /orgs/{orgName}/members/{memberId}/public-keys/{keyId}`: Unregister public key for member.
  - Auth: Org member.
  - Input: None.
  - Output: Nothing.
- `GET /orgs/{orgName}/members/{memberId}/public-keys/{keyId}/bundle`: Get VeraId Member Bundle for a given public key.
  - Auth: Org member.
  - Output: VeraId Member Bundle.
- `POST /orgs/{orgName}/members/{memberId}/public-key-import-tokens`: Generate single-use token to import a member public key.
  - Auth: Org member.
  - Input:
    - The OID for the service where the respective bundles will be valid (e.g., `1.2.3.4.5`).
  - Output: A single-use UUID4.

### Signature Specs

- `POST /orgs/{orgName}/members/{memberId}/signature-specs`: Create signature spec.
  - Auth: Org member.
  - Input:
    - `providerIssuerUrl`: URL to the OpenID provider's issuer URL (e.g., `https://accounts.google.com`).
    - `jwtSubjectField`: The field in the JWT that contains the subject.
    - `jwtSubjectValue`: The value of the subject field.
    - `serviceOid`: The OID for the service where the signature will be valid.
    - `ttlSeconds`: Time-to-live for the signature in seconds (default: 3600).
    - `plaintext`: The plaintext to be signed.
  - Output: URL to the new signature spec.
- `GET /orgs/{orgName}/members/{memberId}/signature-specs/{signatureSpecId}`: Get signature spec.
  - Auth: Org member.
  - Output: The signature spec details.
- `DELETE /orgs/{orgName}/members/{memberId}/signature-specs/{signatureSpecId}`: Delete signature spec.
  - Auth: Org member.
  - Output: Nothing (204 No Content).

See also the [Credentials Exchange API](./credentials.md).
