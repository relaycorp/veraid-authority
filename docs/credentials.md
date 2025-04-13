---
permalink: /credentials
nav_order: 3
---
# Credentials Exchange API

The API server offers dedicated endpoints to exchange external credentials (e.g. JWTs) for VeraId credentials (e.g. organisation signatures) under the prefix `/credentials`.

## Authentication

We currently only offer one method of authentication:

### JWTs with OIDC Discovery

The client would present a JWT as a `Bearer` token in the `Authorization` request header, which the endpoint would verify against the OIDC provider's discovery endpoint specified in the credential exchange spec.

## Credentials

### Organisation Signatures

The endpoint `GET /credentials/signatureBundles/{specId}` will issue a VeraId organisation signature for the [signature spec](./api.md#signature-specs) referenced by `specId`, if the client authentication succeeds.

If successful, the response will be a VeraId Signature Bundle with content type `application/vnd.veraid.signature-bundle`. The expiry time of the signature bundle will be the lower of the signature spec's `ttlSeconds` and the JWT's `exp` claim.

To receive the signature bundle as base64-encoded text instead of binary, set the `Accept` header to `application/vnd.veraid.signature-bundle+base64`. The response will use this content type and return the bundle encoded as base64 text.

Alternatively, the client would return one of the following errors:

- 401 Unauthorized: If client authentication failed.
- 404 Not Found: If the signature spec is not found.
- 503 Service Unavailable: If the JWKS retrieval or DNSSEC chain retrieval fails; client may retry later.

### Organisation Signature Example

To enable a GCP service account to obtain VeraId organisation signatures, you could follow the following process:

1. Register the signature spec under the VeraId member to whom the signature will be attributed.

   For example, you could make the following request to enable the GCP service account `app@acme.iam.gserviceaccount.com` to obtain organisation signatures attributed to an `example.com` member and bound to the service `1.3.6.1.4.1.58708.1.1`, with the plaintext to be signed being `Hello world` (`SGVsbG8gd29ybGQ=` base64 encoded):

   ```http
   POST /orgs/example.com/members/123/signature-specs HTTP/1.1
   HOST: veraid-authority.example
   Authorization: Bearer <JWT>
   Content-Type: application/json

   {
     "auth": {
       "type": "oidc-discovery",
       "providerIssuerUrl": "https://accounts.google.com",
       "jwtSubjectClaim": "email",
       "jwtSubjectValue": "app@acme.iam.gserviceaccount.com"
     },
     "serviceOid": "1.3.6.1.4.1.58708.1.1",
     "ttlSeconds": 300,
     "plaintext": "SGVsbG8gd29ybGQ="
   }
   ```

   Upon successful creation of the signature spec, the response will be:

   ```json
   {
     "self": "/orgs/example.com/members/123/signature-specs/123",
     "exchangeUrl": "https://veraid-authority.example/credentials/signatureBundles/123"
   }
   ```

   Make sure to copy the `exchangeUrl` as it will be used in the next step.
2. Whenever your GCP workload (e.g. Cloud Run service) needs to obtain the organisation signature, it must first request a JWT from Google's OIDC provider and then exchange it for the organisation signature using the `exchangeUrl`.

   For example, you could make the following request to obtain a JWT from GCP, specifying the `exchangeUrl` as the `audience`:

   ```http
   GET /computeMetadata/v1/instance/service-accounts/default/token?audience=https%3A%2F%2Fveraid-authority.example%2Fcredentials%2FsignatureBundles%2F123 HTTP/1.1
   HOST: metadata.google.internal
   ```

   And finally make a `GET` request to the `exchangeUrl` using the output JWT as a `Bearer` token in the `Authorization` header. For example:

   ```http
   GET /credentials/signatureBundles/123 HTTP/1.1
   HOST: veraid-authority.example
   Authorization: Bearer <JWT>
   ```

   If successful, the response will be a VeraId Signature Bundle.

### Member Id Bundles

We don't currently support the exchange of Member Id Bundles. They can still be obtained from the Organisation Management API.