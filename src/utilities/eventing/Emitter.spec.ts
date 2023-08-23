import { jest } from '@jest/globals';
import { CloudEvent } from 'cloudevents';
import envVar from 'env-var';

import { mockSpy } from '../../testUtils/jest.js';
import { CE_CHANNEL, CE_ID, CE_SOURCE, CE_TRANSPORT } from '../../testUtils/eventing/stubs.js';
import { configureMockEnvVars } from '../../testUtils/envVars.js';

import { EmitterChannel } from './EmitterChannel.js';

const mockEmitterFunction = mockSpy(jest.fn());
jest.unstable_mockModule('@relaycorp/cloudevents-transport', () => ({
  makeEmitter: jest.fn<any>().mockReturnValue(mockEmitterFunction),
}));
// eslint-disable-next-line @typescript-eslint/naming-convention
const { Emitter } = await import('./Emitter.js');
const { makeEmitter: ceMakeEmitter } = await import('@relaycorp/cloudevents-transport');

describe('Emitter', () => {
  const channelEnvVarName = EmitterChannel.BACKGROUND_QUEUE;
  const baseEnvVars = { CE_TRANSPORT, [channelEnvVarName]: CE_CHANNEL };
  const mockEnvVars = configureMockEnvVars(baseEnvVars);

  beforeEach(() => {
    Emitter.clearCache();
  });

  describe('init', () => {
    test('Transport should be CE binary mode if CE_TRANSPORT unset', async () => {
      mockEnvVars({ ...baseEnvVars, CE_TRANSPORT: undefined });
      await Emitter.init(channelEnvVarName);

      expect(ceMakeEmitter).toHaveBeenCalledWith('ce-http-binary', expect.anything());
    });

    test('Transport should be taken from CE_TRANSPORT if present', async () => {
      await Emitter.init(channelEnvVarName);

      expect(ceMakeEmitter).toHaveBeenCalledWith(CE_TRANSPORT, expect.anything());
    });

    test('Channel should be taken from specified environment variable', async () => {
      await Emitter.init(channelEnvVarName);

      expect(ceMakeEmitter).toHaveBeenCalledWith(expect.anything(), CE_CHANNEL);
    });

    test('Error should be thrown if specified channel env var is missing', async () => {
      mockEnvVars({ ...baseEnvVars, [channelEnvVarName]: undefined });

      await expect(Emitter.init(channelEnvVarName)).rejects.toThrowWithMessage(
        envVar.EnvVarError,
        /CE_CHANNEL/u,
      );
    });

    test('Emitter should be cached', async () => {
      expect(ceMakeEmitter).toHaveBeenCalledTimes(0);
      await Emitter.init(channelEnvVarName);
      expect(ceMakeEmitter).toHaveBeenCalledTimes(1);

      await Emitter.init(channelEnvVarName);

      expect(ceMakeEmitter).toHaveBeenCalledTimes(1);
    });
  });

  describe('emit', () => {
    const event = new CloudEvent({ id: CE_ID, source: CE_SOURCE, type: 'type' });

    test('should call underlying emitter with event', async () => {
      const emitter = await Emitter.init(channelEnvVarName);

      await emitter.emit(event);

      expect(mockEmitterFunction).toHaveBeenCalledWith(event);
    });
  });
});
