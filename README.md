# VeraId Authority

This is a multi-tenant, cloud-native app that allows organisations to manage their [VeraId](https://veraid.net) members and the issuance of their respective Member Bundles (which they'd subsequently use to produce VeraId signatures).

## Installation and usage

Documentation for operators and API client implementers is available on [docs.relaycorp.tech](https://docs.relaycorp.tech/veraid-authority/).

## Development

This app requires the following system dependencies:

- Node.js 18.
- Kubernetes 1.22+ (we strongly recommend [Minikube](https://minikube.sigs.k8s.io/docs/start/) with Docker).
- [Knative](https://knative.dev/docs/install/quickstart-install/#install-the-knative-cli) v1.9+.
- [Skaffold](https://skaffold.dev/docs/install/) v2.1+.

To start the app, simply get Skaffold to deploy the [relevant Kubernetes resources](./k8s) by running:

```
skaffold dev
```

### Automated testing

The unit test suite can be run with the standard `npm test`.

If you'd like to run some tests against the real instance of the app managed by Skaffold, the simplest way to do that is to add/modify [functional tests](./src/functionalTests) and then run `npm run test:integration` (alternatively, you can use your IDE to only run the test you're interested in).

### Manual testing

If for whatever reason you want to manually test the app, you first need to get the local URLs to the services by running:

```
kn service list
```

To make authenticated requests to the API server, you need to get an access token from the mock authorisation server first. For example, to get an access token for the super admin (`admin@veraid.example`) using the OAuth2 client credentials flow, run:

```http
POST http://mock-authz-server.default.10.103.177.106.sslip.io/default/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=admin@veraid.example&client_secret=s3cr3t
```

You can then make authenticated requests to the API server by setting the `Authorization` header to `Bearer <access_token>`.

## Contributions

We love contributions! If you haven't contributed to a Relaycorp project before, please take a minute to [read our guidelines](https://github.com/relaycorp/.github/blob/master/CONTRIBUTING.md) first.
