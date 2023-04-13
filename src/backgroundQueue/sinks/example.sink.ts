import type { CloudEvent } from 'cloudevents';
import type { BaseLogger } from 'pino';

// eslint-disable-next-line @typescript-eslint/require-await
export default async function processExample(
  event: CloudEvent<unknown>,
  logger: BaseLogger,
): Promise<void> {
  // NB: A production-worthy implementation would do schema validation on `event.data` here.

  logger.info({ event: event.toJSON() }, 'Event processed');
}
