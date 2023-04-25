import type { CloudEvent } from 'cloudevents';

import type { SinkOptions } from './sinks/sinkTypes.js';

export type Sink = (event: CloudEvent<unknown>, options: SinkOptions) => Promise<void>;
