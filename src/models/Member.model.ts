import { prop } from '@typegoose/typegoose';

export enum Role {
  ORG_ADMIN = 'org_admin',
  REGULAR = 'regular',
}

export class MemberModelSchema {
  @prop()
  public name?: string;

  @prop({ required: true, enum: Role })
  public role!: Role;

  @prop({ required: true })
  public orgName!: string;
}
