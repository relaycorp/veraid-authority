import { Container, Service } from 'typedi';
import { DataSource } from 'typeorm';

import { OrganizationEntity } from './organization.entity';

@Service()
export default class OrganizationRepository {
  private dataSource: DataSource = Container.get('db');

  public async find(): Promise<OrganizationEntity[]> {
    return this.dataSource.getMongoRepository(OrganizationEntity).find()
  }
}
