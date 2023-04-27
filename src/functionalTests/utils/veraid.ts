const KMS_KEY_ID = '800d5768-3fd7-4edd-a4b8-4c81c3e4c147';

const ORG_PUBLIC_KEY_PEM = `
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw56WPubg54/O6kM9jnXdyYtri/JUN4h69Db
3Pw6Mw9vyRamJean4ISHTHUGo/ZJrqwQXUiOirbZ04Ve4Ngi8i8BUwPOa0goO8fuF8CgXnzZkzWq1FJ
LAPgteCTGc74yofai3zXtjAdMwjXXxUhx1cAulNfAivVMNhCrtOfIW8xDyOIHYeO+M6N4S6T7fCVmG+
e/jn2OxUxypFr27X2VLFX4YE5euvCP767hjQWa7mJYelLleORBkhozL6k499AQjRLhuCSl55LGMfdPA
Xv7Dz/QCnsa0JInvPKYDl6MNrxo84z9ti5T9tPnBdStXmMx3OT/8+oVsyO08IT0/xKoUJQIDAQAB`;

export const TEST_ORG_NAME = 'lib-testing.veraid.net';

export const ORG_PUBLIC_KEY_DER = Buffer.from(ORG_PUBLIC_KEY_PEM.replaceAll('\n', ''), 'base64');

export const ORG_PRIVATE_KEY_ARN = `arn:aws:kms:eu-west-2:111122223333:key/${KMS_KEY_ID}`;
