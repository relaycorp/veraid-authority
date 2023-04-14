import type { CloudEvent } from 'cloudevents';
import type { BaseLogger } from 'pino';

export type Sink = (event: CloudEvent<unknown>, logger: BaseLogger) => Promise<void>;
