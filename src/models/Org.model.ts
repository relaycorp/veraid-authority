import { prop } from '@typegoose/typegoose';

export class OrgModelSchema {
  @prop({ required: true, unique: true, index: true })
  public name!: string;

  @prop()
  public privateKeyRef!: Buffer;

  @prop()
  public publicKey!: Buffer;
}
