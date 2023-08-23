import { jest } from '@jest/globals';
import type { CloudEvent } from 'cloudevents';

import { Emitter } from '../../utilities/eventing/Emitter.js';
import type { EmitterChannel } from '../../utilities/eventing/EmitterChannel.js';

// eslint-disable-next-line @typescript-eslint/require-await
const NO_OP_FUNCTION = async (): Promise<void> => undefined;

class MockEmitter extends Emitter<unknown> {
  public readonly events: CloudEvent[] = [];

  public constructor() {
    super(NO_OP_FUNCTION);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public override async emit(event: CloudEvent): Promise<void> {
    this.events.push(event);
  }
}

export function mockEmitters(): (channelEnvVar: EmitterChannel) => CloudEvent[] {
  const initMock = jest.spyOn(Emitter<unknown>, 'init');

  const emitters = new Map<EmitterChannel, MockEmitter>();

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/require-await
    initMock.mockImplementation(async (channelEnvVar: EmitterChannel) => {
      const cachedEmitter = emitters.get(channelEnvVar);
      if (cachedEmitter) {
        return cachedEmitter;
      }

      const emitter = new MockEmitter();
      emitters.set(channelEnvVar, emitter);
      return emitter;
    });
  });

  afterEach(() => {
    emitters.clear();
  });

  afterAll(() => {
    initMock.mockRestore();
  });

  return (channelEnvVar) => emitters.get(channelEnvVar)?.events ?? [];
}
