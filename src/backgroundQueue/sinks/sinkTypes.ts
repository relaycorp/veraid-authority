import type { ServiceOptions } from '../../serviceTypes.js';

export interface SinkOptions extends ServiceOptions {
  readonly isPoHttpTlsRequired: boolean;
}
