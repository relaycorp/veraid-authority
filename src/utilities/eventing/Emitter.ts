import type { CloudEvent, EmitterFunction } from 'cloudevents';
import { makeEmitter as ceMakeEmitter } from '@relaycorp/cloudevents-transport';
import envVar from 'env-var';

import { DEFAULT_TRANSPORT } from './transport.js';

export class Emitter<Payload> {
  public static async init(): Promise<Emitter<unknown>> {
    const transport = envVar.get('CE_TRANSPORT').default(DEFAULT_TRANSPORT).asString();
    const channel = envVar.get('K_SINK').required().asString();
    const emitterFunction = await ceMakeEmitter(transport, channel);
    return new Emitter(emitterFunction);
  }

  public constructor(protected readonly func: EmitterFunction) {}

  public async emit(event: CloudEvent<Payload>): Promise<void> {
    await this.func(event);
  }
}
