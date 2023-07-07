import type { CloudEvent, EmitterFunction } from 'cloudevents';
import { makeEmitter } from '@relaycorp/cloudevents-transport';
import envVar from 'env-var';

import { DEFAULT_TRANSPORT } from './transport.js';

/**
 * Wrapper around CloudEvents Emitter.
 *
 * This initialises the underlying emitter lazily, to allow enough time for Knative Eventing to
 * patch the current container to inject the K_SINK environment variable.
 */
export class Emitter<Payload> {
  public static init(): Emitter<unknown> {
    const transport = envVar.get('CE_TRANSPORT').default(DEFAULT_TRANSPORT).asString();
    return new Emitter(transport);
  }

  protected emitterFunction: EmitterFunction | undefined;

  public constructor(public readonly transport: string) {}

  public async emit(event: CloudEvent<Payload>): Promise<void> {
    if (this.emitterFunction === undefined) {
      this.emitterFunction = await makeEmitter(this.transport);
    }
    await this.emitterFunction(event);
  }
}
