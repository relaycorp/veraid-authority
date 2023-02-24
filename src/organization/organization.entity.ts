import { Entity, type ObjectID, ObjectIdColumn, Column } from 'typeorm'

@Entity()
export class OrganizationEntity {
  @ObjectIdColumn()
  id!: ObjectID

  @Column()
  name!: string
}
