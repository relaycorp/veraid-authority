import { type CloudEvent, HTTP, type Message } from 'cloudevents';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { BaseLogger } from 'pino';

import { makeFastify } from '../utilities/fastify/server.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';
import type { PluginDone } from '../utilities/fastify/PluginDone.js';
import { BUNDLE_REQUEST_TRIGGER_TYPE } from '../events/bundleRequestTrigger.event.js';
import type { FastifyTypedInstance } from '../utilities/fastify/FastifyTypedInstance.js';
import { BUNDLE_REQUEST_TYPE } from '../events/bundleRequest.event.js';

import type { Sink } from './Sink.js';
import { QueueProblemType } from './QueueProblemType.js';
import triggerBundleRequest from './sinks/memberBundleRequestTrigger.sink.js';
import memberBundleRequest from './sinks/memberBundleRequest.sink.js';

const SINK_BY_TYPE: { [type: string]: Sink } = {
  [BUNDLE_REQUEST_TRIGGER_TYPE]: triggerBundleRequest,
  [BUNDLE_REQUEST_TYPE]: memberBundleRequest,
};

function makeQueueServerPlugin(
  server: FastifyTypedInstance,
  _opts: FastifyPluginOptions,
  done: PluginDone,
): void {
  server.removeAllContentTypeParsers();
  server.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, payload, next) => {
    next(null, payload);
  });

  server.get('/', async (_request, reply) => {
    await reply.status(HTTP_STATUS_CODES.OK).send('It works');
  });

  server.post('/', async (request, reply) => {
    const message: Message = { headers: request.headers, body: request.body };
    let event;
    try {
      event = HTTP.toEvent(message) as CloudEvent<unknown>;
    } catch {
      await reply
        .status(HTTP_STATUS_CODES.BAD_REQUEST)
        .send({ type: QueueProblemType.INVALID_EVENT });
      return;
    }

    const sink = SINK_BY_TYPE[event.type] as Sink | undefined;
    if (sink === undefined) {
      await reply
        .status(HTTP_STATUS_CODES.BAD_REQUEST)
        .send({ type: QueueProblemType.UNSUPPORTED_EVENT });
      return;
    }

    await sink(event, {
      logger: request.log,
      dbConnection: server.mongoose,
    });
    await reply.status(HTTP_STATUS_CODES.NO_CONTENT).send();
  });

  done();
}

export async function makeQueueServer(logger?: BaseLogger): Promise<FastifyInstance> {
  return makeFastify(makeQueueServerPlugin, logger);
}
