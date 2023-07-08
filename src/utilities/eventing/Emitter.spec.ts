import { jest } from '@jest/globals';
import { CloudEvent } from 'cloudevents';

import { mockSpy } from '../../testUtils/jest.js';
import { CE_ID, CE_SOURCE, CE_TRANSPORT } from '../../testUtils/eventing/stubs.js';
import { configureMockEnvVars } from '../../testUtils/envVars.js';

const mockEmitterFunction = mockSpy(jest.fn());
jest.unstable_mockModule('@relaycorp/cloudevents-transport', () => ({
  makeEmitter: jest.fn<any>().mockReturnValue(mockEmitterFunction),
}));
// eslint-disable-next-line @typescript-eslint/naming-convention
const { Emitter } = await import('./Emitter.js');
const { makeEmitter } = await import('@relaycorp/cloudevents-transport');

describe('Emitter', () => {
  describe('init', () => {
    const mockEnvVars = configureMockEnvVars({ CE_TRANSPORT });

    test('Emitter function should not be initialised', () => {
      Emitter.init();

      expect(makeEmitter).not.toHaveBeenCalled();
    });

    test('Emitter should be output', () => {
      const emitter = Emitter.init();

      expect(emitter).toBeInstanceOf(Emitter);
    });

    test('Transport should be CE binary mode if CE_TRANSPORT unset', () => {
      mockEnvVars({ CE_TRANSPORT: undefined });

      const emitter = Emitter.init();

      expect(emitter.transport).toBe('ce-http-binary');
    });

    test('Transport name should be taken from CE_TRANSPORT', () => {
      const emitter = Emitter.init();

      expect(emitter.transport).toBe(CE_TRANSPORT);
    });
  });

  describe('emit', () => {
    const event = new CloudEvent({ id: CE_ID, source: CE_SOURCE, type: 'type' });

    test('Emitter function should be cached', async () => {
      const emitter = Emitter.init();

      await emitter.emit(event);
      await emitter.emit(event);

      expect(makeEmitter).toHaveBeenCalledTimes(1);
    });

    test('Specified transport should be used', async () => {
      const emitter = new Emitter(CE_TRANSPORT);

      await emitter.emit(event);

      expect(makeEmitter).toHaveBeenCalledWith(CE_TRANSPORT);
    });
  });
});
