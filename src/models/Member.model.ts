import { index, modelOptions, prop, Severity } from '@typegoose/typegoose';

export enum Role {
  ORG_ADMIN = 'org_admin',
  REGULAR = 'regular',
}

@modelOptions({ schemaOptions: { collection: 'members' } })
@index(
  { orgName: 1, name: 1 },
  { unique: true, partialFilterExpression: { name: { $type: 'string' } } },
)
export class MemberModelSchema {
  @prop({ default: null, allowMixed: Severity.ALLOW })
  public name!: string | null;

  @prop({ default: null, allowMixed: Severity.ALLOW })
  public email!: string | null;

  @prop({ required: true, enum: Role })
  public role!: Role;

  @prop({ required: true })
  public orgName!: string;
}
