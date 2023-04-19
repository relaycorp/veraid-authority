import { getModelForClass } from '@typegoose/typegoose';
import envVar from 'env-var';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyPlugin, { type PluginMetadata } from 'fastify-plugin';
import type { Connection } from 'mongoose';

import { MemberModelSchema, Role } from '../models/Member.model.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';
import type { Result } from '../utilities/result.js';
import type { PluginDone } from '../utilities/fastify/PluginDone.js';

interface OrgRequestParams {
  readonly orgName?: string;
  readonly memberId?: string;
}

interface AuthenticatedFastifyRequest extends FastifyRequest {
  user: { sub: string };
  isUserAdmin: boolean;
}

interface AuthorisationGrant {
  readonly isAdmin: boolean;
  readonly reason: string;
}

async function decideAuthorisation(
  userEmail: string,
  request: FastifyRequest,
  dbConnection: Connection,
  superAdmin?: string,
): Promise<Result<AuthorisationGrant, string>> {
  if (superAdmin === userEmail) {
    return { didSucceed: true, result: { reason: 'User is super admin', isAdmin: true } };
  }

  const { orgName, memberId } = request.params as OrgRequestParams;

  if (orgName === undefined) {
    return { didSucceed: false, reason: 'Non-super admin tries to access bulk org endpoint' };
  }

  const memberModel = getModelForClass(MemberModelSchema, {
    existingConnection: dbConnection,
  });
  const member = await memberModel.findOne({ orgName, memberId }).select(['role', 'email']);
  if (member === null) {
    return { didSucceed: false, reason: 'User is not a member of the org' };
  }
  if (member.role === Role.ORG_ADMIN) {
    return { didSucceed: true, result: { reason: 'User is org admin', isAdmin: true } };
  }

  if (memberId === undefined) {
    return { didSucceed: false, reason: 'User is not accessing a membership' };
  }

  if (member.email === userEmail) {
    return {
      didSucceed: true,
      result: { reason: 'User is accessing their own membership', isAdmin: false },
    };
  }

  return { didSucceed: false, reason: 'User is accessing different membership' };
}

async function denyAuthorisation(
  reason: string,
  reply: FastifyReply,
  request: AuthenticatedFastifyRequest,
) {
  const userEmail = request.user.sub;
  request.log.info({ userEmail, reason }, 'Authorisation denied');
  await reply.code(HTTP_STATUS_CODES.FORBIDDEN).send();
}

function registerOrgAuth(fastify: FastifyInstance, _opts: PluginMetadata, done: PluginDone): void {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.decorateRequest('isUserAdmin', false);

  fastify.addHook('onRequest', async (request, reply) => {
    const superAdmin = envVar.get('AUTHORITY_SUPERADMIN').asString();
    const userEmail = (request as AuthenticatedFastifyRequest).user.sub;
    const decision = await decideAuthorisation(userEmail, request, fastify.mongoose, superAdmin);
    const reason = decision.didSucceed ? decision.result.reason : decision.reason;
    if (decision.didSucceed) {
      (request as AuthenticatedFastifyRequest).isUserAdmin = decision.result.isAdmin;
      request.log.debug({ userEmail, reason }, 'Authorisation granted');
    } else {
      await denyAuthorisation(reason, reply, request as AuthenticatedFastifyRequest);
    }
  });

  done();
}

/**
 * Require the current user to be a super admin or an admin of the current org.
 *
 * This is defined as type `any` instead of `preParsingHookHandler` because the latter would
 * discard the types for all the request parameters (e.g., `request.params`) in the route, since
 * `preParsingHookHandler` doesn't offer a generic parameter that honours such parameters.
 */
const requireUserToBeAdmin: any = async (
  request: AuthenticatedFastifyRequest,
  reply: FastifyReply,
) => {
  if (!request.isUserAdmin) {
    await denyAuthorisation('User is not an admin', reply, request);
  }
};

const orgAuthPlugin = fastifyPlugin(registerOrgAuth, { name: 'org-auth' });
export default orgAuthPlugin;

export { requireUserToBeAdmin };
