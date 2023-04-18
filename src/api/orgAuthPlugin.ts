import { getModelForClass } from '@typegoose/typegoose';
import envVar from 'env-var';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import type { Connection } from 'mongoose';

import jwksPlugin from '../utilities/fastify/plugins/jwksAuthentication.js';
import { MemberModelSchema, Role } from '../models/Member.model.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';
import type { Result } from '../utilities/result.js';

interface OrgRequestParams {
  readonly orgName?: string;
  readonly memberId?: string;
}

type AuthorisationDecision = Result<string, string>;

async function decideAuthorisation(
  userEmail: string,
  request: FastifyRequest,
  dbConnection: Connection,
  superAdmin?: string,
): Promise<AuthorisationDecision> {
  if (superAdmin === userEmail) {
    return { didSucceed: true, result: 'User is super admin' };
  }

  const { orgName, memberId } = request.params as OrgRequestParams;

  if (orgName === undefined) {
    return { didSucceed: false, reason: 'Non-super admin tries to access bulk org endpoint' };
  }

  const memberModel = getModelForClass(MemberModelSchema, {
    existingConnection: dbConnection,
  });
  const member = await memberModel.findOne({ orgName, memberId }).select('role');
  if (member === null) {
    return { didSucceed: false, reason: 'User is not a member of the org' };
  }
  if (member.role === Role.ORG_ADMIN) {
    return { didSucceed: true, result: 'User is org admin' };
  }

  if (memberId === undefined) {
    return { didSucceed: false, reason: 'User is not accessing their own membership' };
  }

  if (member.email === userEmail) {
    return { didSucceed: true, result: 'User is accessing their own membership' };
  }

  return { didSucceed: false, reason: 'User is accessing different membership' };
}

async function registerOrgAuth(fastify: FastifyInstance): Promise<void> {
  await fastify.register(jwksPlugin);

  fastify.addHook('onRequest', fastify.authenticate);

  fastify.addHook('onRequest', async (request, reply) => {
    const superAdmin = envVar.get('AUTHORITY_SUPERADMIN').asString();
    const userEmail = (request.user as { sub: string }).sub;
    const decision = await decideAuthorisation(userEmail, request, fastify.mongoose, superAdmin);
    const reason = decision.didSucceed ? decision.result : decision.reason;
    const contextAwareLogger = request.log.child({ userEmail, reason });
    if (decision.didSucceed) {
      contextAwareLogger.debug('Authorisation granted');
    } else {
      contextAwareLogger.info('Authorisation denied');
      await reply.code(HTTP_STATUS_CODES.FORBIDDEN).send();
    }
  });
}

const orgAuthPlugin = fastifyPlugin(registerOrgAuth, { name: 'org-auth' });
export default orgAuthPlugin;
