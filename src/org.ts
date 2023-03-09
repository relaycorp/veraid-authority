import { getModelForClass } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import type { Logger } from 'pino';

import { OrgModelSchema } from './models/Org.model.js';
import type { OrgSchema } from './services/schema/org.schema.js';
import type { Result } from './utilities/result.js';

interface ServiceOptions {
  readonly dbConnection: Connection;
  readonly logger: Logger;
}

interface OrgCreationResult {
  id: string;
}

export async function createOrg(
  _orgData: OrgSchema,
  _options: ServiceOptions,
): Promise<Result<OrgCreationResult>> {
  const orgModel = getModelForClass(OrgModelSchema, {
    existingConnection: _options.dbConnection,
  });

  const org = await orgModel.create(_orgData);

  return {
    didSucceed: true,

    result: {
      id: org.id,
    },
  };
}
