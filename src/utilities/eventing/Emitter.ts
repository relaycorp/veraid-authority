import {
  type CloudEvent,
  emitterFor,
  type EmitterFunction,
  httpTransport,
  Mode,
} from 'cloudevents';
import envVar from 'env-var';

function makeEmitterFunction() {
  const sinkUrl = envVar.get('K_SINK').required().asUrlString();
  const transport = httpTransport(sinkUrl);
  return emitterFor(transport, { mode: Mode.BINARY });
}

/**
 * Wrapper around CloudEvents Emitter.
 *
 * This initialises the underlying emitter lazily, to allow enough time for Knative Eventing to
 * patch the current container to inject the K_SINK environment variable.
 */
export class Emitter<Payload> {
  public static init(): Emitter<unknown> {
    // No processing needed, but this is implemented as a static method to facilitate unit testing
    return new Emitter();
  }

  protected emitterFunction: EmitterFunction | undefined;

  public async emit(event: CloudEvent<Payload>): Promise<void> {
    if (this.emitterFunction === undefined) {
      this.emitterFunction = makeEmitterFunction();
    }
    await this.emitterFunction(event);
  }
}
