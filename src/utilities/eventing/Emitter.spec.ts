import { jest } from '@jest/globals';
import { CloudEvent } from 'cloudevents';
import envVar from 'env-var';

import { mockSpy } from '../../testUtils/jest.js';
import { K_SINK, CE_TRANSPORT } from '../../testUtils/eventing/stubs.js';
import { configureMockEnvVars } from '../../testUtils/envVars.js';

const mockEmitterFunction = mockSpy(jest.fn());
jest.unstable_mockModule('@relaycorp/cloudevents-transport', () => ({
  makeEmitter: jest.fn<any>().mockReturnValue(mockEmitterFunction),
}));
// eslint-disable-next-line @typescript-eslint/naming-convention
const { Emitter } = await import('./Emitter.js');
const { makeEmitter: ceMakeEmitter } = await import('@relaycorp/cloudevents-transport');

const CE_ID = 'ce-id';
const CE_SOURCE = 'https://example.com/ce-source';

describe('Emitter', () => {
  const baseEnvVars = { CE_TRANSPORT, K_SINK };
  const mockEnvVars = configureMockEnvVars(baseEnvVars);

  describe('init', () => {
    test('Transport should be CE binary mode if CE_TRANSPORT unset', async () => {
      mockEnvVars({ ...baseEnvVars, CE_TRANSPORT: undefined });
      await Emitter.init();

      expect(ceMakeEmitter).toHaveBeenCalledWith('ce-http-binary', expect.anything());
    });

    test('Transport should be taken from CE_TRANSPORT if present', async () => {
      await Emitter.init();

      expect(ceMakeEmitter).toHaveBeenCalledWith(CE_TRANSPORT, expect.anything());
    });

    test('Channel should be taken from K_SINK', async () => {
      await Emitter.init();

      expect(ceMakeEmitter).toHaveBeenCalledWith(expect.anything(), K_SINK);
    });

    test('Error should be thrown if K_SINK is missing', async () => {
      mockEnvVars({ ...baseEnvVars, K_SINK: undefined });

      await expect(Emitter.init()).rejects.toThrowWithMessage(envVar.EnvVarError, /K_SINK/u);
    });
  });

  describe('emit', () => {
    const event = new CloudEvent({ id: CE_ID, source: CE_SOURCE, type: 'type' });

    test('should call underlying emitter with event', async () => {
      const emitter = await Emitter.init();

      await emitter.emit(event);

      expect(mockEmitterFunction).toHaveBeenCalledWith(event);
    });
  });
});
