import { CloudEvent } from 'cloudevents';
import { jest } from '@jest/globals';

import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import { CE_SOURCE } from '../../testUtils/eventing/stubs.js';
import { postEvent } from '../../testUtils/eventing/cloudEvents.js';
import {
  BUNDLE_REQUEST_TYPE,
  type MemberBundleRequestPayload,
} from '../../events/bundleRequest.event.js';
import { AWALA_PDA, MEMBER_PUBLIC_KEY_MONGO_ID } from '../../testUtils/stubs.js';
import { mockSpy } from '../../testUtils/jest.js';
import { Result } from '../../utilities/result.js';
import { EnvVarSet } from '../../testUtils/envVars.js';
import { ServiceOptions } from '../../serviceTypes.js';
import { BaseLogger } from 'pino';
import { Connection } from 'mongoose';
import { getModelForClass, ReturnModelType } from '@typegoose/typegoose';
import { MemberBundleRequestModelSchema } from '../../models/MemberBundleRequest.model.js';
import { partialPinoLog } from '../../testUtils/logging.js';


const mockPostToAwala = mockSpy(
  jest.fn<() => Promise<Result<undefined, string>>>(),
);
jest.unstable_mockModule('../../awala.js', () => ({
  postToAwala: mockPostToAwala,
  createMemberBundleRequest: jest.fn()
}))

const mockgGenerateMemberBundle = mockSpy(
  jest.fn<() => Promise<
    Result<
      ArrayBuffer,
      {
        shouldRetry: boolean;
      }
    >
  >>(),
);

jest.unstable_mockModule('../../memberBundle.js', () => ({
  generateMemberBundle: mockgGenerateMemberBundle,
}))


const { setUpTestQueueServer } = await import('../../testUtils/queueServer.js');

describe('memberBundleIssuance', () => {

  const getTestServerFixture = setUpTestQueueServer();
  let server: FastifyTypedInstance;
  let envVars: EnvVarSet;
  let logger: BaseLogger;
  let logs: object[];
  let dbConnection: Connection;
  let memberBundleRequestModel: ReturnModelType<typeof MemberBundleRequestModelSchema>;

  beforeEach(() => {
    ({ server, envVars, logs, logger,dbConnection } = getTestServerFixture());
    memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
      existingConnection: dbConnection,
    });

  });

  test('Bundle shoudl be generated and sent to awala', async () => {
    console.log(memberBundleRequestModel);
    const memberBundle = new ArrayBuffer(1);
    const triggerEvent = new CloudEvent<MemberBundleRequestPayload>({
      id: MEMBER_PUBLIC_KEY_MONGO_ID,
      source: CE_SOURCE,
      type: BUNDLE_REQUEST_TYPE,
      data: {
        awalaPda: AWALA_PDA,
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID
      }
    });
    mockgGenerateMemberBundle.mockResolvedValueOnce({
      didSucceed: true,
      result: memberBundle
    });
    mockPostToAwala.mockResolvedValueOnce({
      didSucceed: true
    })

    await postEvent(triggerEvent, server);

    expect(mockgGenerateMemberBundle).toHaveBeenCalledOnceWith(MEMBER_PUBLIC_KEY_MONGO_ID, expect.objectContaining<ServiceOptions>({
      logger,
      dbConnection
    }))
    expect(mockPostToAwala).toHaveBeenCalledOnceWith(
      expect.toSatisfy<ArrayBuffer>((arrayBuffer) => Buffer.from(memberBundle).equals(Buffer.from(arrayBuffer))),
      AWALA_PDA,
      new URL(envVars.AWALA_MIDDLEWARE_ENDPOINT!)
    )
    expect(logs).toContainEqual(
      partialPinoLog('debug', 'Sending member bundle to Awala', { eventId: MEMBER_PUBLIC_KEY_MONGO_ID, memberPublicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID }),
    );
  });
});
