import type { CloudEventV1 } from 'cloudevents';

import type { ServiceOptions } from '../serviceTypes.js';
import type { Emitter } from '../utilities/eventing/Emitter.js';

export type Sink = (
  event: CloudEventV1<any>,
  ceEmitter: Emitter<unknown>,
  options: ServiceOptions,
) => Promise<void>;
