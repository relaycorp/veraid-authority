import type { FastifyInstance } from 'fastify';
import type { BaseLogger } from 'pino';

import { makeFastify } from '../../utilities/fastify/server.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import { BUNDLE_REQUEST_TRIGGER_TYPE } from '../../events/bundleRequestTrigger.event.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import { BUNDLE_REQUEST_TYPE } from '../../events/bundleRequest.event.js';
import { convertMessageToEvent } from '../../utilities/eventing/receiver.js';
import registerHealthCheck from '../../utilities/fastify/plugins/healthCheck.js';

import type { Sink } from './Sink.js';
import { QueueProblem } from './QueueProblem.js';
import triggerBundleRequest from './sinks/memberBundleRequestTrigger.sink.js';
import memberBundleRequest from './sinks/memberBundleRequest.sink.js';

const SINK_BY_TYPE: { [type: string]: Sink } = {
  [BUNDLE_REQUEST_TRIGGER_TYPE]: triggerBundleRequest,
  [BUNDLE_REQUEST_TYPE]: memberBundleRequest,
};

async function makeQueueServerPlugin(server: FastifyTypedInstance): Promise<void> {
  server.removeAllContentTypeParsers();
  server.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, payload, next) => {
    next(null, payload);
  });

  await server.register(registerHealthCheck);

  server.post('/', async (request, reply) => {
    let event;
    try {
      event = convertMessageToEvent(request.headers, request.body as Buffer);
    } catch (err) {
      request.log.info({ err }, 'Refusing invalid event');
      await reply.status(HTTP_STATUS_CODES.BAD_REQUEST).send({ type: QueueProblem.INVALID_EVENT });
      return;
    }

    const sink = SINK_BY_TYPE[event.type] as Sink | undefined;
    if (sink === undefined) {
      request.log.info({ eventType: event.type }, 'Refusing unsupported event type');
      await reply
        .status(HTTP_STATUS_CODES.BAD_REQUEST)
        .send({ type: QueueProblem.UNSUPPORTED_EVENT });
      return;
    }

    await sink(event, { logger: request.log, dbConnection: server.mongoose });
    await reply.status(HTTP_STATUS_CODES.NO_CONTENT).send();
  });
}

export async function makeQueueServer(logger?: BaseLogger): Promise<FastifyInstance> {
  return makeFastify(makeQueueServerPlugin, logger);
}
