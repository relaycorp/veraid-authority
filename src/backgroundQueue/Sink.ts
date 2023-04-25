import type { CloudEvent } from 'cloudevents';

import { SinkOptions } from './sinks/sinkTypes.js';

export type Sink = (event: CloudEvent<unknown>, options: SinkOptions) => Promise<void>;
