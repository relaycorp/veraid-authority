import type { CloudEventV1 } from 'cloudevents';

import type { ServiceOptions } from '../utilities/serviceTypes.js';

export type Sink = (event: CloudEventV1<any>, options: ServiceOptions) => Promise<void>;
