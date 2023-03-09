import { prop } from '@typegoose/typegoose';

export enum MemberAccessType {
  'INVITE_ONLY' = 'INVITE_ONLY',
  'OPEN' = 'OPEN',
}

export class OrgModelSchema {
  @prop({ required: true, unique: true })
  public name!: string;

  @prop({ required: true, enum: MemberAccessType })
  public memberAccessType!: MemberAccessType;

  @prop()
  public awalaEndpoint?: string;
}
