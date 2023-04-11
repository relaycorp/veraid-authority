import { getModelForClass } from '@typegoose/typegoose';

import type { SuccessfulResult } from './utilities/result.js';
import type { ServiceOptions } from './serviceTypes.js';
import { MemberKeyImportTokenModelSchema } from './models/MemberKeyImportToken.model.js';
import type { MemberKeyImportTokenCreationResult } from './memberKeyImportTokenTypes.js';

export async function createMemberKeyImportToken(
  memberId: string,
  serviceOid: string,
  options: ServiceOptions,
): Promise<SuccessfulResult<MemberKeyImportTokenCreationResult>> {
  const memberKeyImportTokenModel = getModelForClass(MemberKeyImportTokenModelSchema, {
    existingConnection: options.dbConnection,
  });

  const memberKeyImportToken = await memberKeyImportTokenModel.create({
    memberId,
    serviceOid,
  });

  options.logger.info({ id: memberKeyImportToken.id }, 'Member key import token created');
  return {
    didSucceed: true,

    result: {
      id: memberKeyImportToken.id,
    },
  };
}
