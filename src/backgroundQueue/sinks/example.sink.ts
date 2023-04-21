import type { CloudEvent } from 'cloudevents';
import { ServiceOptions } from '../../serviceTypes.js';

// eslint-disable-next-line @typescript-eslint/require-await
export default async function processExample(
  event: CloudEvent<unknown>,
  options: ServiceOptions,
): Promise<void> {
  // NB: A production-worthy implementation would do schema validation on `event.data` here.

  options.logger.info({ event: event.toJSON() }, 'Event processed');
}
