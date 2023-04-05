import { prop } from '@typegoose/typegoose';
import { Types } from 'mongoose';

export class MemberPublicKeyModelSchema {
  @prop({ required: true })
  public memberId!: Types.ObjectId;

  @prop({ required: true })
  public publicKey!: string;

}
