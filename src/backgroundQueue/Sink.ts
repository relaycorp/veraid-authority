import type { CloudEvent } from 'cloudevents';

import type { ServiceOptions } from '../serviceTypes.js';

export type Sink = (event: CloudEvent<unknown>, options: ServiceOptions) => Promise<void>;
