# VeraId Authority

VeraId Certificate Authority (CA) server.

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

You can find the URL to the HTTP server by running:

```
kn service describe veraid-authority -o url
```

## Architecture

This multi-tenant server will allow one or more organisations to manage their VeraId setup, and it'll also allow organisation members to claim and renew their VeraId Ids.

## Authentication

We'll use OAuth2 via the library [fastify-auth0-verify](https://github.com/nearform/fastify-auth0-verify) (which, despite the name, [is agnostic of Auth0](https://github.com/nearform/fastify-auth0-verify/issues/224)).

The API will use the following roles:

- Admin. They can do absolutely anything on any organisation.
- Org admin. They can do anything within their own organisation.
- Org member. They can manage much of their own membership in their respective organisation.

## HTTP Endpoints

It will support the following API endpoints, which are to be consumed by the VeraId CA Console (a CLI used by organisation admins) and VeraId signature producers (used by organisation members):

Unless otherwise specified, all inputs and outputs will be JSON serialised.

- `POST /orgs`: Create org.
  - Auth: Admin.
  - Input:
    - Name (e.g., `acme.com`).
    - Member access type (`invite-only` or `open`).
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
  - Output: Same as input to `POST /orgs/{orgName}/members`.
- `DELETE /orgs/{orgName}/members/{memberId}`: Delete member.
  - Auth: Org admin.
- `POST /orgs/{orgName}/members/{memberId}/public-keys`: Register public key for member.
  - Auth: Org member.
  - Input:
    - Content type: `application/vnd.etsi.tsl.der`.
    - Body: The DER-encoded public key.
  - Output: The URL for the new key.
- `DELETE /orgs/{orgName}/members/{memberId}/public-keys/{keyId}`: Unregister public key for member.
  - Auth: Org member.
  - Input: None.
  - Output: Nothing.
- `GET /orgs/{orgName}/members/{memberId}/public-keys/{keyId}/bundle`*: Get VeraId Member Bundle for a given public key.
  - Auth: Org member.
  - Input (query string):
    - `service`: The OID for the service where the bundle will be valid (e.g., `1.2.3.4.5`).
  - Output: VeraId Member Bundle.
- `POST /orgs/{orgName}/awala`: [Awala endpoint middleware](https://github.com/relaycorp/relayverse/issues/28) backend.
  - Auth: Awala Endpoint Middleware.
  - Awala service messages:
    - `MemberIdRequest`.
      - Input:
        - URL to public key (e.g., `/orgs/bbc.com/members/alice/public-keys/abcde`). Alternatively, the org name, member ID and key ID can be passed separately.
        - The OID for the service where the bundle will be valid (e.g., `1.2.3.4.5`).
        - The current timestamp.
        - The parameters above, digitally signed with the private key associated with the public key.
      - Output: VeraId Member Bundle.

\* We may skip this endpoint in v1 because the endpoint `POST /orgs/{orgName}/awala/` already supports this functionality.

This server will have the following background processes:

- [Awala endpoint middleware](https://github.com/relaycorp/relayverse/issues/28) backend. Used to respond to the requests made to `POST /orgs/{orgName}/awala/`.
