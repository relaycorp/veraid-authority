import { prop } from '@typegoose/typegoose';

export class OrgModelSchema {
  @prop({ required: true, unique: true, index: true })
  public name!: string;

  @prop()
  public awalaEndpoint?: string;

  @prop()
  public privateKeyRef!: Buffer;

  @prop()
  public publicKey!: Buffer;
}
