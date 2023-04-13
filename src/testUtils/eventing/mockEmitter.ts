import { jest } from '@jest/globals';
import type { CloudEvent } from 'cloudevents';

import { Emitter } from '../../utilities/eventing/Emitter.js';

class MockEmitter extends Emitter {
  public constructor(private readonly events: CloudEvent[]) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public override async emit(event: CloudEvent): Promise<void> {
    this.events.push(event);
  }
}

export function mockEmitter(): () => CloudEvent[] {
  const initMock = jest.spyOn(Emitter, 'init');
  let events: CloudEvent[] = [];

  beforeEach(() => {
    const mock = new MockEmitter(events);
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
