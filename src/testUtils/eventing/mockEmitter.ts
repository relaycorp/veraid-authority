import { jest } from '@jest/globals';
import type { CloudEvent } from 'cloudevents';

import { Emitter } from '../../utilities/eventing/Emitter.js';

import { CE_TRANSPORT } from './stubs.js';

class MockEmitter extends Emitter<unknown> {
  public readonly events: CloudEvent[] = [];

  public constructor() {
    super(CE_TRANSPORT);
  }

  public reset(): void {
    this.events.splice(0, this.events.length);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public override async emit(event: CloudEvent): Promise<void> {
    this.events.push(event);
  }
}

export function mockEmitter(): MockEmitter {
  const initMock = jest.spyOn(Emitter<unknown>, 'init');

  const emitter = new MockEmitter();

  beforeEach(() => {
    initMock.mockReturnValue(emitter);
  });

  afterEach(() => {
    emitter.reset();
  });

  afterAll(() => {
    initMock.mockRestore();
  });

  return emitter;
}
