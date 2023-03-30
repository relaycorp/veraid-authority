import { index, prop } from '@typegoose/typegoose';

export enum Role {
  ORG_ADMIN = 'org_admin',
  REGULAR = 'regular',
}

@index(
  { orgName: 1, name: 1 },
  { unique: true, partialFilterExpression: { name: { $exists: true } } },
)
export class MemberModelSchema {
  @prop({
    _id: true,
  })
  public id!: string;

  @prop()
  public name?: string;

  @prop()
  public email?: string;

  @prop({ required: true, enum: Role })
  public role!: Role;

  @prop({ required: true })
  public orgName!: string;
}
