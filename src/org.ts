import type { Connection } from 'mongoose';

import type { OrgSchema } from './services/schema/org.schema.js';
import type { Result } from './utilities/result.js';

interface ServiceOptions {
  readonly dbConnection: Connection;
}

interface OrgCreationResult {
  id: string;
}

export async function createOrg(
  _orgData: OrgSchema,
  _options: ServiceOptions,
): Promise<Result<OrgCreationResult>> {
  return {
    didSucceed: true,

    result: {
      id: 'test',
    },
  };
}
