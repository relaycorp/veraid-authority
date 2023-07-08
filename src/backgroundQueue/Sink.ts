import type { CloudEvent } from 'cloudevents';

import type { ServiceOptions } from '../serviceTypes.js';
import type { Emitter } from '../utilities/eventing/Emitter.js';

export type Sink = (
  event: CloudEvent<unknown>,
  ceEmitter: Emitter<unknown>,
  options: ServiceOptions,
) => Promise<void>;
