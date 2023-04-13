import { type CloudEvent, emitterFor, type EmitterFunction, httpTransport } from 'cloudevents';
import envVar from 'env-var';

function makeEmitterFunction() {
  const sinkUrl = envVar.get('K_SINK').required().asUrlString();
  const transport = httpTransport(sinkUrl);
  return emitterFor(transport);
}

/**
 * Wrapper around CloudEvents Emitter.
 *
 * This initialises the underlying emitter lazily, to allow enough time for Knative Eventing to
 * patch the current container to inject the K_SINK environment variable.
 */
export class Emitter {
  public static init(): Emitter {
    // No processing needed, but this is implemented as a static method to facilitate unit testing
    return new Emitter();
  }

  protected emitterFunction: EmitterFunction | undefined;

  public async emit(event: CloudEvent): Promise<void> {
    if (this.emitterFunction === undefined) {
      this.emitterFunction = makeEmitterFunction();
    }
    await this.emitterFunction(event);
  }
}
