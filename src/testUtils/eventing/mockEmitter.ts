import { jest } from '@jest/globals';
import type { CloudEvent } from 'cloudevents';

import { Emitter } from '../../utilities/eventing/Emitter.js';

class MockEmitter extends Emitter<unknown> {
  private shouldThrowError: boolean = false;
  public constructor(private readonly events: CloudEvent[]) {
    super();
  }
  public setShouldThrowError(value: boolean) {
    this.shouldThrowError = value;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public override async emit(event: CloudEvent): Promise<void> {
    this.events.push(event);
    if(this.shouldThrowError){
      throw new Error("Error while processing event")
    }
  }
}

interface MockEmitterResult {
  getEvents: () => CloudEvent[];
  getEmitter: () => MockEmitter;
}

export function mockEmitter(): MockEmitterResult {
  const initMock = jest.spyOn(Emitter<unknown>, 'init');
  let events: CloudEvent[] = [];
  let emitter: MockEmitter;
  beforeEach(() => {
    const mock = new MockEmitter(events);
    emitter = mock;
    initMock.mockReturnValue(mock);
  });

  afterEach(() => {
    events = [];
  });

  afterAll(() => {
    initMock.mockRestore();
  });

  return {
    getEvents: () => events,
    getEmitter: () => emitter
  };
}
