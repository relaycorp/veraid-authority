import { Column, Entity } from 'typeorm';

@Entity()
export default class OrganizationEntity {
  @Column({ type: 'varchar' })
  name!: string;
}
