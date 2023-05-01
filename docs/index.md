# VeraId Authority

VeraId Authority is a cloud-native app that allows organisations to manage their [VeraId](https://veraid.net) members and the issuance of their respective Member Bundles (which they'd subsequently use to produce VeraId signatures).

It offers [built-in Awala support](./awala.md) so that members can get their bundles with or without the Internet.

## Architecture

This is a multi-tenant app that comprises the following web servers:

- [API server](./api-server.md): This is a RESTful API to manage VeraId organisations and exposes an endpoint needed by the Awala integration (if enabled).
- [Background queue](./queue-server.md). This is a [CloudEvents](https://cloudevents.io) server that processes events in the background.

The app also uses the following backing services:

- [**MongoDB**](https://www.mongodb.com) 6 or newer.
- A **Key Management Service (KMS)** supported by [`@relaycorp/webcrypto-kms`](https://www.npmjs.com/package/@relaycorp/webcrypto-kms). Every organisation gets its own key pair. Operators are highly encouraged to use hardware security modules in production.
- Any **authorisation server** supporting JSON Web Key Sets (JWKS), such as Auth0.
- Any [Knative Eventing broker](https://knative.dev/docs/eventing/brokers/), such as RabbitMQ or Google PubSub.

To better understand where this server sits in the overall protocol, please refer to the [architecture of VeraId itself](https://veraid.net/architecture).

## Install

Refer to the [installation documentation](./install.md).

## Support

To ask questions about this app or VeraId in general, please go to [r/VeraId on Reddit](https://www.reddit.com/r/VeraId/).

To request features or report bugs on this app, please go to [our issue tracker on GitHub](https://github.com/relaycorp/veraid-authority/issues).
