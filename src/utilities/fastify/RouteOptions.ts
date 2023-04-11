import type { RouteOptions as FastifyRouteOptions } from 'fastify';

export interface RouteOptions extends FastifyRouteOptions {
  prefix: string;
}
