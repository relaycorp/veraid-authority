import { jest } from '@jest/globals';
import { CloudEvent } from 'cloudevents';
import envVar from 'env-var';

import { configureMockEnvVars } from '../../testUtils/envVars.js';
import { mockSpy } from '../../testUtils/jest.js';
import { CE_ID, CE_SOURCE, K_SINK } from '../../testUtils/eventing/stubs.js';

enum CloudEventMode {
  BINARY = 'binary',
}
const mockEmitterFunction = mockSpy(jest.fn());
const mockTransport = Symbol('mockTransport');
jest.unstable_mockModule('cloudevents', () => ({
  emitterFor: jest.fn<any>().mockReturnValue(mockEmitterFunction),
  httpTransport: jest.fn<any>().mockReturnValue(mockTransport),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Mode: CloudEventMode,
}));
// eslint-disable-next-line @typescript-eslint/naming-convention
const { Emitter } = await import('./Emitter.js');
const { emitterFor, httpTransport } = await import('cloudevents');

describe('Emitter', () => {
  describe('initFromEnv', () => {
    test('Emitter function should not be initialised', () => {
      Emitter.init();

      expect(emitterFor).not.toHaveBeenCalled();
    });

    test('Transport should not be initialised', () => {
      Emitter.init();

      expect(httpTransport).not.toHaveBeenCalled();
    });

    test('Emitter should be output', () => {
      const emitter = Emitter.init();

      expect(emitter).toBeInstanceOf(Emitter);
    });
  });

  describe('emit', () => {
    const mockEnvVars = configureMockEnvVars({ K_SINK });

    const event = new CloudEvent({ id: CE_ID, source: CE_SOURCE, type: 'type' });

    test('K_SINK should be defined', async () => {
      mockEnvVars({ K_SINK: undefined });
      const emitter = Emitter.init();

      await expect(emitter.emit(event)).rejects.toThrowWithMessage(envVar.EnvVarError, /K_SINK/u);
    });

    test('K_SINK should be a URL', async () => {
      mockEnvVars({ K_SINK: 'not a URL' });
      const emitter = Emitter.init();

      await expect(emitter.emit(event)).rejects.toThrowWithMessage(envVar.EnvVarError, /K_SINK/u);
    });

    test('K_SINK should be used in HTTP transport', async () => {
      const emitter = Emitter.init();

      await emitter.emit(event);

      expect(httpTransport).toHaveBeenCalledWith(K_SINK);
    });

    test('Emitter should use HTTP transport', async () => {
      const emitter = Emitter.init();

      await emitter.emit(event);

      expect(emitterFor).toHaveBeenCalledWith(mockTransport, expect.anything());
    });

    test('Emitter should use binary mode', async () => {
      const emitter = Emitter.init();

      await emitter.emit(event);

      expect(emitterFor).toHaveBeenCalledWith(expect.anything(), { mode: 'binary' });
    });

    test('Emitter function should be cached', async () => {
      const emitter = Emitter.init();

      await emitter.emit(event);
      await emitter.emit(event);

      expect(emitterFor).toHaveBeenCalledTimes(1);
    });

    test('Transport should be cached', async () => {
      const emitter = Emitter.init();

      await emitter.emit(event);
      await emitter.emit(event);

      expect(httpTransport).toHaveBeenCalledTimes(1);
    });
  });
});
