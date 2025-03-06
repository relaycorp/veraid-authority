# VeraId Authority

This is a multi-tenant, cloud-native app that allows organisations to manage their [VeraId](https://veraid.net) members and the issuance of their respective Member Bundles (which they'd subsequently use to produce VeraId signatures).

## Installation and usage

Documentation for operators and API client implementers is available on [docs.relaycorp.tech](https://docs.relaycorp.tech/veraid-authority/).

## Development

This app requires the following system dependencies:

- Node.js 18.
- Docker and Docker Compose.

To start the app, simply run:

```
docker compose up -d
```

### Automated testing

The unit test suite can be run with the standard `npm test`.

If you'd like to run some tests against the real instance of the app, the simplest way to do that is to add/modify [functional tests](./src/functionalTests) and then run `npm run test:integration` (alternatively, you can use your IDE to only run the test you're interested in).

### Manual testing

If for whatever reason you want to manually test the app, you can access the services at:

- API server: http://localhost:8080
- Awala service: http://localhost:8083
- Queue service: http://localhost:8084
- Mock authorization server: http://localhost:8081
- Mock Awala middleware: http://localhost:8082
- MongoDB: localhost:27017

To make authenticated requests to the API server, you need to get an access token from the mock authorisation server first. For example, to get an access token for the super admin (`admin@veraid.example`) using the OAuth2 client credentials flow, run:

```http
POST http://localhost:8081/default/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=admin@veraid.example&client_secret=s3cr3t
```

You can then make authenticated requests to the API server by setting the `Authorization` header to `Bearer <access_token>`.

## Contributions

We love contributions! If you haven't contributed to a Relaycorp project before, please take a minute to [read our guidelines](https://github.com/relaycorp/.github/blob/master/CONTRIBUTING.md) first.
