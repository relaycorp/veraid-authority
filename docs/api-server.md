---
permalink: /api
nav_order: 2
---
# API server

This server exposes a RESTful API to manage VeraId organisations and the endpoint needed by the Awala integration (if enabled).

## Authentication and authorisation

We use OAuth2 with JWKS to delegate authentication to an external identity provider. We require the JWT token to define the user's email address in the [OIDC `email` claim](https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims).

The API employs the following roles:

- Super admin. They can do absolutely anything on any organisation.
- Org admin. They can do anything within their own organisation.
- Org member. They can manage much of their own membership in their respective organisation.

Authorisation grant logs use the level `DEBUG` to minimise PII transmission and storage for legal/privacy reasons, whilst denial logs use the level `INFO` for auditing purposes.

## HTTP Endpoints

It will support the following API endpoints, which are to be consumed by the VeraId CA Console (a CLI used by organisation admins) and VeraId signature producers (used by organisation members):

Unless otherwise specified, all inputs and outputs will be JSON serialised.

- `POST /orgs`: Create org.
  - Auth: Admin.
  - Input:
    - Name (e.g., `acme.com`).
    - [Awala endpoint middleware](https://github.com/relaycorp/relayverse/issues/28) URL (optional).
  - Output:
    - VeraId TXT record.
- `GET /orgs/{orgName}`: Get org.
  - Auth: Org admin.
  - Output: Same as input to `POST /orgs`.
- `PATCH /orgs/{orgName}`: Modify org.
  - Auth: Org admin.
  - Input: Same as `POST /orgs`, but org name can't be changed.
- `DELETE /orgs/{orgName}`: Delete org.
  - Auth: Org admin.
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
- `POST /awala`: [Awala endpoint middleware](https://github.com/relaycorp/relayverse/issues/28) backend.
  - Auth: Awala Endpoint Middleware.
  - HTTP response: `202 Accepted` (no content) if the input was valid and the request was successfully processed, or `400 Bad Request` if the input was invalid.
  - Awala service messages:
    - `MemberBundleRequest`.
      - HTTP request body (JSON, with content type `application/vnd.veraid-authority.member-bundle-request`):
        - The id for the respective member public key.
        - The future start date of the bundle. (Bundles will be issued at that time or later, but never before)
        - Digital signature for the parameters above, produced with the private key associated with the public key.
        - The Awala Parcel Delivery Authorisation (PDA).
      - Successful outcome: Create new DB record to **schedule** the issuance and delivery of a member id bundle. This DB record will contain the data in the request.
        - Any public key must have a maximum of 1 request at any time, so if we get a duplicate, we should replace the old request with the new one.
    - `MemberPublicKeyImport`.
      - Payload (JSON, with content type `application/vnd.veraid-authority.member-public-key-import`):
        - The single-use import token.
        - The DER-encoded public key.
        - The Awala Parcel Delivery Authorisation (PDA).
      - Successful outcome:
        1. Same processing as in `POST /orgs/{orgName}/members/{memberId}/public-keys` (i.e., key gets imported).
        2. Publish `member-public-key-import` event.
