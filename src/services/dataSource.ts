import { DataSource, type DataSourceOptions } from 'typeorm';
import { Container } from 'typedi';
import env from 'env-var';

import { OrganizationEntity } from '../entities/organization.entity.js';

export default async function initializeDataSource(): Promise<void> {
  const dataSourceOptions: DataSourceOptions = {
    url: env.get('DATA_URL').asString(),
    entities: [OrganizationEntity],
    useNewUrlParser: true,
    synchronize: true,
    logging: false,
    type: 'mongodb',
  };

  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  Container.set('db', dataSource);
}
