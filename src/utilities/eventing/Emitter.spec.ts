import { jest } from '@jest/globals';
import { CloudEvent } from 'cloudevents';
import envVar from 'env-var';

import { configureMockEnvVars } from '../../testUtils/envVars.js';
import { CE_SOURCE, K_SINK } from '../../testUtils/eventing.js';
import { mockSpy } from '../../testUtils/jest.js';

const mockEmitter = mockSpy(jest.fn());
const mockTransport = Symbol('mockTransport');
jest.unstable_mockModule('cloudevents', () => ({
  emitterFor: jest.fn<any>().mockReturnValue(mockEmitter),
  httpTransport: jest.fn<any>().mockReturnValue(mockTransport),
}));
// eslint-disable-next-line @typescript-eslint/naming-convention
const { Emitter } = await import('./Emitter.js');
const { emitterFor, httpTransport } = await import('cloudevents');

describe('Emitter', () => {
  describe('initFromEnv', () => {
    const mockEnvVars = configureMockEnvVars({ K_SINK });

    test('K_SINK should be defined', () => {
      mockEnvVars({ K_SINK: undefined });

      expect(() => Emitter.initFromEnv()).toThrowWithMessage(envVar.EnvVarError, /K_SINK/u);
    });

    test('K_SINK should be a URL', () => {
      mockEnvVars({ K_SINK: 'not a URL' });

      expect(() => Emitter.initFromEnv()).toThrowWithMessage(envVar.EnvVarError, /K_SINK/u);
    });

    test('K_SINK should be used in HTTP transport', () => {
      Emitter.initFromEnv();

      expect(httpTransport).toHaveBeenCalledWith(K_SINK);
    });

    test('Emitter should use HTTP transport', () => {
      Emitter.initFromEnv();

      expect(emitterFor).toHaveBeenCalledWith(mockTransport);
    });

    test('CloudEvents Emitter should be used', async () => {
      const emitter = Emitter.initFromEnv();
      const event = new CloudEvent({ id: 'id', source: CE_SOURCE, type: 'type' });

      await emitter.emit(event);

      expect(mockEmitter).toHaveBeenCalledWith(event);
    });
  });
});
