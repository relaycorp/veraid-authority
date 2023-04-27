# VeraId Authority

VeraId Certificate Authority (CA) server.

## Environment variables

All processes require the following variables:

- `AUTHORITY_VERSION` (required). The version of this server.
- `K_SINK` (required). The URL to the Knative Eventing endpoint where events should be published.
- `MONGODB_URI` (required).
- KMS-related variables:
  - `KMS_ADAPTER` (required; e.g., `AWS`, `GCP`).
  - Any other variable required by the specific adapter in use. Refer to the [`@relaycorp/webcrypto-kms` documentation](https://www.npmjs.com/package/@relaycorp/webcrypto-kms).

The API server additionally uses the following variables:

- Authentication-related variables:
  - `OAUTH2_JWKS_URL` (required). The URL to the JWKS endpoint of the authorisation server.
  - Either `OAUTH2_TOKEN_ISSUER` or `OAUTH2_TOKEN_ISSUER_REGEX` (required). The (URL of the) authorisation server.
  - `OAUTH2_TOKEN_AUDIENC[example.sink.spec.ts](src%2FbackgroundQueue%2Fsinks%2Fexample.sink.spec.ts)E` (required). The identifier of the current instance of this server (typically its public URL).
- Authorisation-related variables:
  - `AUTHORITY_SUPERADMIN` (optional): The JWT _subject id_ of the super admin, which in this app we require it to be an email address. When unset, routes that require super admin role (e.g., `POST /orgs`) won't work by design. This is desirable in cases where an instance of this server will only ever support a handful of domain names (they could set the `AUTHORITY_SUPERADMIN`  to create the orgs, and then unset the super admin var).

The background queue server additionally uses the following variables:

- `AWALA_MIDDLEWARE_ENDPOINT` (required). The URL to the Awala endpoint middleware.

## Development

This app requires the following system dependencies:

- Node.js 18.
- Kubernetes 1.22+ (we recommend [Minikube](https://minikube.sigs.k8s.io/docs/start/) with Docker).
- [Knative](https://knative.dev/docs/install/quickstart-install/#install-the-knative-cli) v1.9+.
- [Skaffold](https://skaffold.dev/docs/install/) v2.1+.

To start the app, simply run:

```
skaffold dev
```

You can find the URL to the HTTP servers by running:

```
kn service list
```

To make authenticated requests to the API server, you need to get an access token from the mock authorisation server first. For example, to get an access token for the super admin (`admin@veraid.example`), run:

```http
### Authenticate with authorisation server (client credentials)
POST http://mock-authz-server.default.10.103.177.106.sslip.io/default/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=admin@veraid.example&client_secret=s3cr3t
```

You can then make authenticated requests to the API server by setting the `Authorization` header to `Bearer <access_token>`.

## Architecture

This multi-tenant server will allow one or more organisations to manage their VeraId setup, and it'll also allow organisation members to claim and renew their VeraId Ids.

## API

### Authentication and authorisation

We use OAuth2 with JWKS to delegate authentication to an external identity provider. We require the JWT token's `sub` claim to be the email address of the user.

The API employs the following roles:

- Super admin. They can do absolutely anything on any organisation.
- Org admin. They can do anything within their own organisation.
- Org member. They can manage much of their own membership in their respective organisation.

Authorisation grant logs use the level `DEBUG` to minimise PII transmission and storage for legal/privacy reasons, whilst denial logs use the level `INFO` for auditing purposes.

### HTTP Endpoints

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
- `GET /orgs/{orgName}/members/{memberId}/public-keys/{keyId}/bundle`*: Get VeraId Member Bundle for a given public key.
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
      - HTTP request body (JSON, with content type `application/vnd.veraid.member-bundle-request`):
        - The id for the respective member public key.
        - The future start date of the bundle. (Bundles will be issued at that time or later, but never before)
        - Digital signature for the parameters above, produced with the private key associated with the public key.
        - The Awala Parcel Delivery Authorisation (PDA).
      - Successful outcome: Create new DB record to **schedule** the issuance and delivery of a member id bundle. This DB record will contain the data in the request.
        - Any public key must have a maximum of 1 request at any time, so if we get a duplicate, we should replace the old request with the new one.
    - `MemberPublicKeyImport`.
      - Payload (JSON, with content type `application/vnd.veraid.member-public-key-import`):
        - The single-use import token.
        - The DER-encoded public key.
        - The Awala Parcel Delivery Authorisation (PDA).
      - Successful outcome:
        1. Same processing as in `POST /orgs/{orgName}/members/{memberId}/public-keys` (i.e., key gets imported).
        2. Publish `member-public-key-import` event.

\* We may skip this endpoint in v1 because the endpoint `POST /awala/` already supports this functionality.

## Periodic jobs

The frequency is to be determined by the operator of the app.

- Member bundle scheduler (every minute in development). Retrieves all the bundles that should be issued in the next 24 hours, and does the following:
  1. Checks the signature, and ignores the request if the signature is invalid.
  2. Publishes a `member-bundle-request` event for each entry (deleting the DB record upon publishing the event).

## Events

All events are JSON-serialised.

- `member-bundle-request`: A member bundle has been requested. Payload:
  - Globally-unique id for the public key.
  - Awala PDA.
- `member-public-key-import`: A member public key has just been imported. Payload: Same as `member-bundle-request` (coincidentally; they could diverge in the future).

## Event consumers

The events above are consumed by the following Knative Eventing sinks:

- `member-bundle-issuer`:
  - Event triggers: `member-bundle-request`.
  - Outcome:
    1. Post Awala PDA to Awala Endpoint Middleware, and extract the Awala recipient address from the response (to be used later).
    2. Generate VeraId Member Bundle.
    3. Post bundle to Awala recipient via the Awala Endpoint Middleware.
- `member-public-key-import-ack`:
  - Event triggers: `member-public-key-import`.
  - Outcome: Same as in `member-bundle-issuer`, but the payload to be posted to the Awala Endpoint Middleware should be a JSON document (content type `application/vnd.veraid.member-public-key-import-ack`) with the following fields:
    - The id for the member public key. This is to be passed in subsequent `MemberBundleRequest` messages.
    - The VeraId Member Bundle (base64-encoded).
