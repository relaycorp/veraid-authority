---
permalink: /install
nav_order: 1
---
# Install

The servers that comprise the app are distributed in the same Docker image: [`ghcr.io/relaycorp/veraid-authority`](https://github.com/relaycorp/veraid-authority/pkgs/container/veraid-authority).

## Deploying the API server

The Docker container must use the image above and specify the following arguments:

- Command arguments: `api`. Do NOT specify a command.
- Environment variables: In addition to the common variables listed below, the following are used:
  - Authentication-related variables:
    - `OAUTH2_JWKS_URL` (required). The URL to the JWKS endpoint of the authorisation server.
    - Either `OAUTH2_TOKEN_ISSUER` or `OAUTH2_TOKEN_ISSUER_REGEX` (required). The (URL of the) authorisation server.
    - `OAUTH2_TOKEN_AUDIENCE` (required). The identifier of the current instance of this server (typically its public URL).
  - Authorisation-related variables:
    - `AUTHORITY_SUPERADMIN` (optional): The JWT _subject id_ of the super admin, which in this app we require it to be an email address. When unset, routes that require super admin role (e.g., `POST /orgs`) won't work by design. This is desirable in cases where an instance of this server will only ever support a handful of domain names (they could set the `AUTHORITY_SUPERADMIN`  to create the orgs, and then unset the super admin var).
  - `AWALA_MIDDLEWARE_ENDPOINT` (optional). If set, the [Awala integration](./awala.md) is enabled.

## Deploying the background queue

The Docker container must use the image above and specify the following arguments:

- Command arguments: `api`. Do NOT specify a command.
- Environment variables: In addition to the common variables listed below, the following are used:
  - `AWALA_MIDDLEWARE_ENDPOINT` (required). The URL to the Awala endpoint middleware.

## Common environment variables

All processes require the following variables:

- `AUTHORITY_VERSION` (required). The version of this server.
- DB connection variables:
  - `MONGODB_URI` (required): The URI to connect to MongoDB (e.g., `mongodb://localhost:27017/awala-endpoint`).
  - `MONGODB_DB` (optional): The name of the MongoDB database (e.g., `awala-endpoint`).
  - `MONGODB_USER` (optional): The username to connect to MongoDB (e.g., `alice`).
  - `MONGODB_PASSWORD` (optional): The password to connect to MongoDB (e.g., `s3cr3t`).
- KMS-related variables:
  - `KMS_ADAPTER` (required; e.g., `AWS`, `GCP`).
  - Any other variable required by the specific adapter in use. Refer to the [`@relaycorp/webcrypto-kms` documentation](https://www.npmjs.com/package/@relaycorp/webcrypto-kms).
- `CE_TRANSPORT` (default: `ce-http-binary`): The [`@relaycorp/cloudevents-transport`](https://www.npmjs.com/package/@relaycorp/cloudevents-transport) transport to use. Each transport has its own set of environment variables.

## Example with Knative

We use Knative to run the app in development and CI, so you can refer to [the Kubernetes resources in the repository](https://github.com/relaycorp/veraid-authority/tree/main/k8s) to see a fully-operation example.
