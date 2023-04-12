import { jest } from '@jest/globals';
import envVar from 'env-var';

import { configureMockEnvVars } from '../testUtils/envVars.js';

const mockEmitter = Symbol('mockEmitter');
const mockTransport = Symbol('mockTransport');
jest.unstable_mockModule('cloudevents', () => ({
  emitterFor: jest.fn<any>().mockReturnValue(mockEmitter),
  httpTransport: jest.fn<any>().mockReturnValue(mockTransport),
}));
const { makeEmitterFromEnv } = await import('./knativeEventing.js');
const { emitterFor, httpTransport } = await import('cloudevents');

const K_SINK = 'https://example.com/sink';

describe('makeEmitterFromEnv', () => {
  const mockEnvVars = configureMockEnvVars({ K_SINK });

  test('K_SINK should be defined', () => {
    mockEnvVars({ K_SINK: undefined });

    expect(makeEmitterFromEnv).toThrowWithMessage(envVar.EnvVarError, /K_SINK/u);
  });

  test('K_SINK should be a URL', () => {
    mockEnvVars({ K_SINK: 'not a URL' });

    expect(makeEmitterFromEnv).toThrowWithMessage(envVar.EnvVarError, /K_SINK/u);
  });

  test('K_SINK should be used in HTTP transport', () => {
    makeEmitterFromEnv();

    expect(httpTransport).toHaveBeenCalledWith(K_SINK);
  });

  test('Emitter should use HTTP transport', () => {
    makeEmitterFromEnv();

    expect(emitterFor).toHaveBeenCalledWith(mockTransport);
  });

  test('Emitter should be returned', () => {
    expect(makeEmitterFromEnv()).toBe(mockEmitter);
  });
});
