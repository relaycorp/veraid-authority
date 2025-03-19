import { jest } from '@jest/globals';
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import { VeraidDnssecChain } from '@relaycorp/veraid';
import type { Connection } from 'mongoose';
import { addDays, setMilliseconds } from 'date-fns';

import { setUpTestDbConnection } from '../../testUtils/db.js';
import { makeMockLogging, partialPinoLog } from '../../testUtils/logging.js';
import { ORG_NAME } from '../../testUtils/stubs.js';
import type { ServiceOptions } from '../../utilities/serviceTypes.js';
import { derSerialisePublicKey } from '../../utilities/webcrypto.js';
import { mockKms } from '../../testUtils/kms/mockKms.js';
import { mockSpy } from '../../testUtils/jest.js';
import { requireFailureResult, requireSuccessfulResult } from '../../testUtils/result.js';
import { VERAID_DNSSEC_CHAIN } from '../../testUtils/veraid.js';

import { Org } from './Org.model.js';
import { makeOrgChain, ORG_CERTIFICATE_EXPIRY_DAYS } from './orgChain.js';
import { OrgChainCreationProblem } from './OrgChainCreationProblem.js';

describe('orgChain', () => {
  const getConnection = setUpTestDbConnection();
  const getMockKms = mockKms();

  const mockLogging = makeMockLogging();

  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let orgModel: ReturnModelType<typeof Org>;
  let orgPrivateKeyRef: Buffer;
  let orgPublicKey: Buffer;

  beforeEach(async () => {
    const { kms } = getMockKms();
    const { publicKey: orgPublicCryptoKey, privateKey: orgPrivateCryptoKey } =
      await kms.generateKeyPair();

    orgPrivateKeyRef = await kms.getPrivateKeyRef(orgPrivateCryptoKey);
    orgPublicKey = await derSerialisePublicKey(orgPublicCryptoKey);

    connection = getConnection();
    serviceOptions = {
      dbConnection: connection,
      logger: mockLogging.logger,
    };
    orgModel = getModelForClass(Org, {
      existingConnection: connection,
    });
  });

  describe('makeOrgChain', () => {
    const mockDnssecChainRetrieve = mockSpy(jest.spyOn(VeraidDnssecChain, 'retrieve'));
    beforeEach(() => {
      mockDnssecChainRetrieve.mockResolvedValue(VERAID_DNSSEC_CHAIN);
    });

    beforeEach(async () => {
      await orgModel.create({
        name: ORG_NAME,
        privateKeyRef: orgPrivateKeyRef,
        publicKey: orgPublicKey,
      });
    });

    test('Missing org should fail', async () => {
      const invalidOrgName = `not-${ORG_NAME}`;

      const result = await makeOrgChain(invalidOrgName, serviceOptions);

      requireFailureResult(result);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Org not found', { orgName: invalidOrgName }),
      );
    });

    describe('Self issued organisation certificate', () => {
      test('Should be issued with existing org name', async () => {
        const result = await makeOrgChain(ORG_NAME, serviceOptions);

        requireSuccessfulResult(result);
        const { certificate } = result.result;
        expect(certificate.commonName).toBe(ORG_NAME);
      });

      test('Should be issued with org private and public keys', async () => {
        const result = await makeOrgChain(ORG_NAME, serviceOptions);

        requireSuccessfulResult(result);
        const { certificate } = result.result;
        await expect(
          derSerialisePublicKey(await certificate.getPublicKey()),
        ).resolves.toStrictEqual(orgPublicKey);

        // Can't check the use of the private key per se, but we can check the certification path
        await expect(certificate.getCertificationPath([], [certificate])).resolves.toHaveLength(2);
      });

      test('Should be valid at the time of generation', async () => {
        const startDate = setMilliseconds(new Date(), 0);

        const result = await makeOrgChain(ORG_NAME, serviceOptions);

        requireSuccessfulResult(result);
        const { certificate } = result.result;
        expect(certificate.validityPeriod.start).toBeBetween(startDate, new Date());
      });

      test('Should expire in 90 days', async () => {
        const startDate = setMilliseconds(new Date(), 0);

        const result = await makeOrgChain(ORG_NAME, serviceOptions);

        requireSuccessfulResult(result);
        const { certificate } = result.result;
        expect(certificate.validityPeriod.end).toBeBetween(
          addDays(startDate, ORG_CERTIFICATE_EXPIRY_DAYS),
          addDays(new Date(), ORG_CERTIFICATE_EXPIRY_DAYS),
        );
      });
    });

    test('Should return the private key', async () => {
      const result = await makeOrgChain(ORG_NAME, serviceOptions);

      requireSuccessfulResult(result);
      const { kms } = getMockKms();
      const privateKeyRef = await kms.getPrivateKeyRef(result.result.privateKey);
      expect(privateKeyRef).toMatchObject(orgPrivateKeyRef);
    });

    describe('DNSSEC chain retrieval', () => {
      test('DNSSEC chain should be retrieved with org name', async () => {
        const result = await makeOrgChain(ORG_NAME, serviceOptions);

        requireSuccessfulResult(result);
        const { dnssecChain } = result.result;
        expect(dnssecChain.domainName).toBe(ORG_NAME);
      });

      test('Should report DNSSEC chain retrieval failure', async () => {
        const error = new Error('Oh noes');
        mockDnssecChainRetrieve.mockRejectedValueOnce(error);

        const result = await makeOrgChain(ORG_NAME, serviceOptions);

        requireFailureResult(result);
        expect(result.context).toBe(OrgChainCreationProblem.DNSSEC_CHAIN_RETRIEVAL_FAILED);
        expect(mockLogging.logs).toContainEqual(
          partialPinoLog('warn', 'Failed to retrieve DNSSEC chain', {
            orgName: ORG_NAME,
            err: expect.objectContaining({ message: error.message }),
          }),
        );
      });

      test('Should not initialise KMS when DNSSEC chain retrieval fails', async () => {
        const error = new Error('Oh noes');
        mockDnssecChainRetrieve.mockRejectedValueOnce(error);

        await makeOrgChain(ORG_NAME, serviceOptions);

        const { kmsInitMock } = getMockKms();
        expect(kmsInitMock).not.toHaveBeenCalled();
      });
    });
  });
});
