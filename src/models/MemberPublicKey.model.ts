import { prop } from '@typegoose/typegoose';

export class MemberPublicKeyModelSchema {
  @prop({ required: true })
  public memberId!: string;

  @prop({ required: true })
  public oid!: string;

  @prop({ required: true })
  public publicKey!: string;
}
