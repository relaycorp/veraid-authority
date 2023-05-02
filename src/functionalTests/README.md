# Functional test suite

As functional tests, the tests in this directory must adhere to the following constraints:

- The app must be tested over the network.
- Backing services shouldn't be accessed from the tests, except for:
  - Auth server: to obtain a valid access token.
  - Any service that we must mock with [MockServer](https://mock-server.com).
- The executed code must not count towards the **unit** test coverage.

## End-to-end tests

The end-to-end tests are runs with a **real** VeraId organisation (`lib-testing.veraid.net`), which is used in all functional and integration tests in the project. Consequently, its private key is publicly available, but the VeraId TXT record locks it to the test service, so it has no validity in any other context.
