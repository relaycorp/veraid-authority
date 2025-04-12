---
permalink: /background-queue
nav_order: 4
---
# Background queue

This is a [CloudEvents](https://cloudevents.io) server that processes events in the background. As of this writing, this server is only needed when the Awala integration is enabled.

## Periodic jobs

The frequency is to be determined by the operator of the app.

- Member bundle scheduler (CloudEvents type `net.veraid.authority.member-bundle-request-trigger`). Retrieves all the bundles that should be issued in the next 24 hours, and publishes a `member-bundle-request` event for each entry.

## Events

All events are JSON-serialised.

- `net.veraid.authority.member-bundle-request`: A member bundle has been requested. Payload: the id of the public key.
