import { jest } from '@jest/globals';
import type { CloudEvent } from 'cloudevents';

import { Emitter } from '../../utilities/eventing/Emitter.js';

class MockEmitter extends Emitter<unknown> {
  public readonly events: CloudEvent<unknown>[] = [];

  public constructor() {
    // eslint-disable-next-line @typescript-eslint/require-await
    super(async (event) => {
      this.events.push(event);
    });
  }

  public reset(): void {
    this.events.splice(0, this.events.length);
  }
}

export function mockEmitter(): MockEmitter {
  const initMock = jest.spyOn(Emitter<unknown>, 'init');

  const emitter = new MockEmitter();

  beforeAll(() => {
    initMock.mockResolvedValue(emitter);
  });

  afterEach(() => {
    emitter.reset();
  });

  afterAll(() => {
    initMock.mockRestore();
  });

  return emitter;
}
