---
permalink: /install
nav_order: 1
---
# Install

The servers that comprise the app are distributed in the same Docker image: [`ghcr.io/relaycorp/veraid-authority`](https://github.com/relaycorp/veraid-authority/pkgs/container/veraid-authority).

If you're deploying the app to Google Cloud Platform, you should use the official module [`relaycorp/veraid-authority/google`](https://registry.terraform.io/modules/relaycorp/veraid-authority/google/latest) and skip the rest of this document.

## Deploying the API server

The Docker container must use the image above and specify the following arguments:

- Command arguments: `api`. Do NOT specify a command.
- Environment variables: In addition to the common variables listed below, the following are used:
  - Authentication-related variables:
    - `OAUTH2_JWKS_URL` (required). The URL to the JWKS endpoint of the authorisation server.
    - Either `OAUTH2_TOKEN_ISSUER` or `OAUTH2_TOKEN_ISSUER_REGEX` (required). The (URL of the) authorisation server.
    - `OAUTH2_TOKEN_AUDIENCE` (required). The comma-separated identifier(s) of the current instance of this server (typically its public URL).
  - Authorisation-related variables:
    - `AUTHORITY_SUPERADMIN` (optional): The JWT _subject id_ of the super admin, which in this app we require it to be an email address. When unset, routes that require super admin role (e.g., `POST /orgs`) won't work by design. This is desirable in cases where an instance of this server will only ever support a handful of domain names (they could set the `AUTHORITY_SUPERADMIN`  to create the orgs, and then unset the super admin var).

## Deploying the background queue

The Docker container must use the image above and specify the following arguments:

- Command arguments: `queue`. Do NOT specify a command.
- Environment variables: The [common](#common-environment-variables) and [CloudEvents](#cloudevents-environment-variables) variables (both `CE_CHANNEL_AWALA_OUTGOING_MESSAGES` and `CE_CHANNEL_BACKGROUND_QUEUE`).

## Deploying the Awala backend

The Docker container must use the image above and specify the following arguments:

- Command arguments: `awala`. Do NOT specify a command.
- Environment variables: The [common](#common-environment-variables) variables and the [CloudEvents](#cloudevents-environment-variables) variable `CE_CHANNEL_AWALA_OUTGOING_MESSAGES`.

[Learn more about Awala support](./awala.md).

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
- Logging-related variables:
  - `LOG_TARGET` (optional): The [`@relaycorp/pino-cloud`](https://www.npmjs.com/package/@relaycorp/pino-cloud) target (e.g., `gcp`).
  - `LOG_LEVEL` (default: `info`): The [`pino` log level](https://github.com/pinojs/pino/blob/master/docs/api.md#levels).

## CloudEvents environment variables

[`@relaycorp/cloudevents-transport`](https://www.npmjs.com/package/@relaycorp/cloudevents-transport) configuration:

- `CE_TRANSPORT` (default: `ce-http-binary`): The transport to use.
- One or more of the following variables (refer to the specific process above):
  - `CE_CHANNEL_AWALA_OUTGOING_MESSAGES`: The transport channel to use for outgoing Awala service messages.
  - `CE_CHANNEL_BACKGROUND_QUEUE`: The transport channel to use for the background queue.
## Example with Knative

We use Knative to run the app in development and CI, so you can refer to [the Kubernetes resources in the repository](https://github.com/relaycorp/veraid-authority/tree/main/k8s) to see a fully-operation example.
