import { prop } from '@typegoose/typegoose';
import { ObjectId } from 'mongoose';

export class MemberPublicKeySchema {
  @prop({ required: true })
  public memberId!: ObjectId;

  @prop({ required: true })
  public publicKey!: string;

}
