import { prop } from '@typegoose/typegoose';

export enum MemberAccessType {
  INVITE_ONLY = 'inviteOnly',
  OPEN = 'open',
}

export class OrgModelSchema {
  @prop({ required: true, unique: true, index: true })
  public name!: string;

  @prop({ required: true, enum: MemberAccessType })
  public memberAccessType!: MemberAccessType;

  @prop()
  public awalaEndpoint?: string;
}
