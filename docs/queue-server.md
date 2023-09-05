---
permalink: /background-queue
nav_order: 3
---
# Background queue

This is a [CloudEvents](https://cloudevents.io) server that processes events in the background. As of this writing, this server is only needed when the Awala integration is enabled.

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
  - Outcome: Same as in `member-bundle-issuer`, but the payload to be posted to the Awala Endpoint Middleware should be a JSON document (content type `application/vnd.veraid-authority.member-public-key-import-ack`) with the following fields:
    - The id for the member public key. This is to be passed in subsequent `MemberBundleRequest` messages.
    - The VeraId Member Bundle (base64-encoded).
