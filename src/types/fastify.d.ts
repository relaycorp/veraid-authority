import { Connection } from 'mongoose';

declare module 'fastify' {
  export interface FastifyInstance {
    mongoose: Connection;

    /**
     * This decorator is only available in org-related routes in the API.
     *
     * Unfortunately, we couldn't declare this locally in our custom `FastifyInstance`, as that'd
     * break *many* Fastify types that hard-code the `FastifyInstance` type (e.g.,
     * `FastifyPluginCallback`).
     *
     * To add insult to injury, we have to declare it as `any` instead of `preParsingHookHandler`
     * because the latter would discard the types for all the request parameters (e.g.,
     * `request.params`) in the route because `preParsingHookHandler` doesn't offer a generic
     * parameter that honours such parameters.
     */
    requireUserToBeAdmin: any;
  }
}
