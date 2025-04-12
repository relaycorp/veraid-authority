# VeraId Authority

VeraId Authority is a cloud-native, multi-tenant app that allows organisations to manage their [VeraId](https://veraid.net) members and the issuance of their respective Member Id Bundles.

It offers [built-in Awala support](./awala.md) so that members can get their bundles without the Internet.

## Architecture

The API server is the primary component of the app, offering the following RESTful APIs:

- [Organisation Management API](./api.md), to manage VeraId organisations and their members.
- [Credentials Exchange API](./credentials.md), to exchange external credentials (e.g. JWTs) for VeraId credentials (e.g. organisation signatures).

The app also uses the following backing services:

- [**MongoDB**](https://www.mongodb.com) 6 or newer.
- A **Key Management Service (KMS)** supported by [`@relaycorp/webcrypto-kms`](https://www.npmjs.com/package/@relaycorp/webcrypto-kms). Every organisation gets its own key pair. Operators are highly encouraged to use hardware security modules in production.
- Any **authorisation server** supporting JSON Web Key Sets (JWKS), such as Auth0.

When [Awala](https://awala.app/en/network/) support is required, the [background queue](./queue-server.md) and [Awala backend](./awala.md) servers must be deployed too.

To better understand where this server sits in the overall protocol, please refer to the [architecture of VeraId itself](https://veraid.net/architecture).

## Install

Refer to the [installation documentation](./install.md).

## Support

To ask questions about this app or VeraId in general, please go to [r/VeraId on Reddit](https://www.reddit.com/r/VeraId/).

To request features or report bugs on this app, please go to [our issue tracker on GitHub](https://github.com/relaycorp/veraid-authority/issues).

## Licence

This project is licensed under the [Business Source License](https://github.com/relaycorp/veraid-authority/blob/main/LICENSE).
