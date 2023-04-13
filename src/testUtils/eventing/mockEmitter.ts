import { jest } from '@jest/globals';
import type { CloudEvent } from 'cloudevents';

import { Emitter } from '../../utilities/eventing/Emitter.js';

class MockEmitter extends Emitter {
  public static init<InitPayload>(events: CloudEvent<InitPayload>[]): MockEmitter {
    const emitter = (event: CloudEvent<InitPayload>) => {
      events.push(event);
    };
    return new MockEmitter(emitter as () => Promise<void>);
  }
}

export function mockEmitter(): () => CloudEvent[] {
  const initMock = jest.spyOn(Emitter, 'initFromEnv');
  let events: CloudEvent[] = [];

  beforeEach(() => {
    const mock = MockEmitter.init(events);
    initMock.mockReturnValue(mock);
  });

  afterEach(() => {
    events = [];
  });

  afterAll(() => {
    initMock.mockRestore();
  });

  return () => events;
}
