import { emitterFor, type EmitterFunction, httpTransport } from 'cloudevents';
import envVar from 'env-var';

export function makeEmitterFromEnv(): EmitterFunction {
  const sinkUrl = envVar.get('K_SINK').required().asUrlString();
  const transport = httpTransport(sinkUrl);
  return emitterFor(transport);
}
