import { getModelForClass } from '@typegoose/typegoose';

import { MemberAccessType, OrgModelSchema } from './models/Org.model.js';
import { createOrg } from './org.js';
import type { OrgSchema } from './services/schema/org.schema.js';
import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging, type MockLogging } from './testUtils/logging.js';
import { requireSuccessfulResult } from './testUtils/result.js';
import { ORG_NAME, AWALA_ENDPOINT } from './testUtils/stubs.js';

describe('org', () => {
  const getConnection = setUpTestDbConnection();

  let mockLogging: MockLogging;
  beforeEach(() => {
    mockLogging = makeMockLogging();
  });

  test('Valid data should be stored', async () => {
    const connection = getConnection();
    const orgData: OrgSchema = {
      name: ORG_NAME,
      memberAccessType: 'INVITE_ONLY',
      awalaEndpoint: AWALA_ENDPOINT,
    };

    await createOrg(orgData, {
      dbConnection: connection,
      logger: mockLogging.logger,
    });

    const orgModel = getModelForClass(OrgModelSchema, {
      existingConnection: connection,
    });
    const dbResult = await orgModel.exists({
      name: ORG_NAME,
      memberAccessType: MemberAccessType.INVITE_ONLY,
      awalaEndpoint: AWALA_ENDPOINT,
    });
    expect(dbResult).not.toBeNull();
  });

  test('Valid data with non ASCII name be stored', async () => {
    const connection = getConnection();
    const nonAsciiName = 'はじめよう.みんな';
    const orgData: OrgSchema = {
      name: nonAsciiName,
      memberAccessType: 'INVITE_ONLY',
      awalaEndpoint: AWALA_ENDPOINT,
    };

    await createOrg(orgData, {
      dbConnection: connection,
      logger: mockLogging.logger,
    });

    const orgModel = getModelForClass(OrgModelSchema, {
      existingConnection: connection,
    });
    const dbResult = await orgModel.exists({
      name: nonAsciiName,
      memberAccessType: MemberAccessType.INVITE_ONLY,
      awalaEndpoint: AWALA_ENDPOINT,
    });
    expect(dbResult).not.toBeNull();
  });

  test('Valid data with non ASCII Awala endpoint be stored', async () => {
    const connection = getConnection();
    const nonAsciiAwalaEndpoint = 'はじめよう.みんな';
    const orgData: OrgSchema = {
      name: ORG_NAME,
      memberAccessType: 'INVITE_ONLY',
      awalaEndpoint: nonAsciiAwalaEndpoint,
    };

    await createOrg(orgData, {
      dbConnection: connection,
      logger: mockLogging.logger,
    });

    const orgModel = getModelForClass(OrgModelSchema, {
      existingConnection: connection,
    });
    const dbResult = await orgModel.exists({
      name: ORG_NAME,
      memberAccessType: 'INVITE_ONLY',
      awalaEndpoint: nonAsciiAwalaEndpoint,
    });
    expect(dbResult).not.toBeNull();
  });

  test('Returned id should match that of the database', async () => {
    const connection = getConnection();
    const orgData: OrgSchema = {
      name: ORG_NAME,
      memberAccessType: 'INVITE_ONLY',
      awalaEndpoint: AWALA_ENDPOINT,
    };

    const methodResult = await createOrg(orgData, {
      dbConnection: connection,
      logger: mockLogging.logger,
    });

    requireSuccessfulResult(methodResult);
    const orgModel = getModelForClass(OrgModelSchema, {
      existingConnection: connection,
    });
    const dbResult = await orgModel.findById(methodResult.result.id);
    expect(methodResult.result.id).toStrictEqual(dbResult?._id.toString());
  });
});
