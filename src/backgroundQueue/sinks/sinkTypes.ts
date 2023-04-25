import { ServiceOptions } from '../../serviceTypes.js';

export interface SinkOptions extends ServiceOptions{
  readonly awalaMiddlewareEndpoint: URL;
}
