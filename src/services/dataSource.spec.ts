import type { DataSource, DataSourceOptions } from 'typeorm';
import { Container } from 'typedi';
import env from 'env-var';

import { OrganizationEntity } from '../organization/organization.entity.js';

import initializeDataSource from './dataSource.js';

const { configureMockEnvVars } = await import('../testUtils/envVars.js');

describe('initializeDataSource', () => {
  const mongoUrl = env.get('MONGO_URL').asString();
  configureMockEnvVars({ DATA_URL: mongoUrl });

  afterEach(async () => {
    const dataSource: DataSource = Container.get('db');
    await dataSource.destroy();
    await Container.set('db', undefined);
  });

  test('Data source key should be registered', async () => {
    expect(Container.has('db')).toBeFalse();

    await initializeDataSource();

    expect(Container.has('db')).toBeTrue();
  });

  test('Data source should be initialized', async () => {
    await initializeDataSource();
    const dataSource: DataSource = Container.get('db');
    expect(dataSource.isInitialized).toBeTrue();
    expect(dataSource.options).toMatchObject<Partial<DataSourceOptions>>({
      url: mongoUrl,
      entities: [OrganizationEntity],
      useNewUrlParser: true,
      synchronize: true,
      logging: false,
      type: 'mongodb',
    });
  });
});
