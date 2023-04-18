import { getModelForClass } from '@typegoose/typegoose';
import envVar from 'env-var';
import type { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import jwksPlugin from '../utilities/fastify/plugins/jwksAuthentication.js';
import { MemberModelSchema } from '../models/Member.model.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';

interface OrgRequestParams {
  readonly orgName?: string;
  readonly memberId?: string;
}

async function registerOrgAuth(fastify: FastifyInstance): Promise<void> {
  await fastify.register(jwksPlugin);

  fastify.addHook('onRequest', fastify.authenticate);

  fastify.addHook('onRequest', async (request, reply) => {
    const userName = (request.user as { sub: string }).sub;
    const userAwareLogger = request.log.child({ user: userName });
    const superAdmin = envVar.get('AUTHORITY_SUPERADMIN').asString();
    if (superAdmin === userName) {
      userAwareLogger.debug('Authorisation granted to super admin');
      return;
    }

    const { orgName, memberId } = request.params as OrgRequestParams;

    const memberModel = getModelForClass(MemberModelSchema, {
      existingConnection: fastify.mongoose,
    });
    const member = await memberModel.findOne({ orgName, memberId }).select('role');
    if (!member) {
      userAwareLogger.debug('Authorisation denied to non-org member');
      await reply.code(HTTP_STATUS_CODES.FORBIDDEN).send();
    }
  });
}

const orgAuthPlugin = fastifyPlugin(registerOrgAuth, { name: 'org-auth' });
export default orgAuthPlugin;
