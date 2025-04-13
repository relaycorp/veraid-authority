---
permalink: /awala
nav_order: 5
---
# Awala support

[Awala](https://awala.app/en/network/) is a computer network where compatible apps can use the Internet when it's available, or switch to a fallback medium when it's unavailable. **VeraId Authority comes with built-in Awala support**, so that VeraId members can get their bundles with and without the Internet.

VeraId Authority offloads all the Awala-related cryptography and networking to the [Awala Internet Endpoint](https://docs.relaycorp.tech/awala-endpoint-internet/), which requires the deployment of an additional [backend server](./install.md#deploying-the-awala-backend). Note that this backend exposes an endpoint that processes [incoming service messages from the Awala Internet Endpoint](https://docs.relaycorp.tech/awala-endpoint-internet/integration#incoming-service-messages).

## Onboarding Awala users

The organisation admin must onboard every Awala user by generating a _member key import token_, and then sharing that token with the respective user. It's up to the [Awala service provider](https://awala.app/en/network/software-vendors/) to define the transport to use to share the token.

This token can only be used once, and it simply allows the user to import their public key and subsequently receive member bundles. Said public key remains tied to the VeraId service specified by the organisation admin when the token was generated.

Refer to the [API documentation](./api-server.md) to learn how to use the endpoint `POST /orgs/:orgName/members/:memberId/public-key-import-tokens`, or refer to the [key import token command](https://docs.relaycorp.tech/veraid-authority-js/classes/MemberKeyImportTokenCommand.html) in the JS client.

## Awala service messages

Awala service providers building an integration with the Authority server MUST support the following messages.

### Member public key import

Your app MUST send a member public key import message in order to import the member's public key and request the first member bundle. This message MUST be a JSON-serialised document with the following attributes:

- `publicKeyImportToken`: The single-use token provided by the organisation admin.
- `publicKey`: The base64-encoded, ASN.1 DER serialisation of the member's public key.

This service message MUST use the content type `application/vnd.veraid-authority.member-public-key-import`.

### Member bundle request

Your app MUST send a member bundle request to renew the member's existing bundle, and it MUST be a JSON-serialised document with the following attributes:

- `publicKeyId`: The id of the public key previously provided by the Authority server.
- `memberBundleStartDate`: The date by which the bundle should be issued and delivered.
- `signature`: The digital signature for the request, with the input being the other fields concatenated as follows: `publicKeyId || memberBundleStartDate`.
- `peerId`: The Awala peer id of the sender.

This service message MUST use the content type `application/vnd.veraid-authority.member-bundle-request`.

A successful request will schedule the issuance and delivery of a member id bundle. Any public key must have a maximum of 1 request at any time, so if we get a duplicate, we should replace the old request with the new one.

### Member bundle

Your app MUST process incoming member bundle messages, which is a JSON document containing the following fields:

- `memberPublicKeyId`: The id of the public key that your app MUST use when requesting member bundles in the future. This is unique for every public key and never changes, so you only need to store it the first time you receive this message.
- `memberBundle`: The base64-encoded member bundle.

This service message uses the content type `application/vnd.veraid.member-bundle`.
