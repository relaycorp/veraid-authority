# Awala support

[Awala](https://awala.network) is a computer network where compatible apps can use the Internet when it's available, or switch to a fallback medium when it's unavailable. **VeraId Authority comes with built-in Awala support**, so that VeraId members can get their bundles with and without the Internet.

Support for Awala is disabled by default as our implementation requires the [Awala Endpoint Middleware](https://github.com/relaycorp/relayverse/issues/28). To enable it, once you have an instance of the middleware running in the local network, you simply need to set the URL to it in the environment variable `AWALA_MIDDLEWARE_ENDPOINT` in both the [API](./api-server.md) and [background queue](./queue-server.md) servers.

## Onboarding Awala users

The organisation admin must onboard every Awala user by generating a _member key import token_, and then sharing that token with the respective user. It's up to the [Awala service provider](https://awala.network/service-providers/) to define the transport to use to share the token.

This token can only be used once and it simply allows the user to import their public key, and subsequently receive member bundles. Said public key remains tied to the VeraId service specified by the organisation admin when the token was generated.

Refer to the [API documentation](./api-server.md) to learn how to use the endpoint `POST /orgs/:orgName/members/:memberId/public-key-import-tokens`, or refer to the [key import token command](https://docs.relaycorp.tech/veraid-authority-js/classes/MemberKeyImportTokenCommand.html) in the JS client.

## Awala service messages

Awala service providers building an integration with the Authority server MUST support the following messages.

### Member public key import

Your app MUST send a member public key import message in order to import the member's public key and request the first member bundle. This message MUST be a JSON-serialised document with the following attributes:

- `publicKeyImportToken`: The single-use token provided by the organisation admin.
- `publicKey`: The base64-encoded, ASN.1 DER serialisation of the member's public key.
- `awalaPda`: The Awala Parcel Delivery Authorisation (PDA) to be used to deliver the member bundle eventually.

This service message MUST use the content type `application/vnd.veraid.member-public-key-import`.

### Member bundle request

Your app MUST send a member bundle request to renew the member's existing bundle, and it MUST be a JSON-serialised document with the following attributes:

- `publicKeyId`: The id of the public key previously provided by the Authority server.
- `memberBundleStartDate`: The date by which the bundle should be issued and delivered.
- `awalaPda`: The Awala Parcel Delivery Authorisation (PDA) to be used to deliver the member bundle eventually.
- `signature`: The digital signature for the request, with the input being the other fields concatenated as follows: `publicKeyId || memberBundleStartDate || awalaPda`.

This service message MUST use the content type `application/vnd.veraid.member-bundle-request`.

### Member bundle

Your app MUST process incoming member bundle messages, which is a JSON document containing the following fields:

- `memberPublicKeyId`: The id of the public key that your app MUST use when requesting member bundles in the future. This is unique for every public key and never changes, so you only need to store it the first time you receive this message.
- `memberBundle`: The base64-encoded member bundle.

This service message uses the content type `application/vnd.veraid.member-bundle`.
