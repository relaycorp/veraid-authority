import { type CloudEvent, emitterFor, type EmitterFunction, httpTransport } from 'cloudevents';
import envVar from 'env-var';

export class Emitter {
  public static initFromEnv(): Emitter {
    const sinkUrl = envVar.get('K_SINK').required().asUrlString();
    const transport = httpTransport(sinkUrl);
    return new Emitter(emitterFor(transport));
  }

  protected constructor(private readonly emitter: EmitterFunction) {}

  public async emit(event: CloudEvent): Promise<void> {
    await this.emitter(event);
  }
}
