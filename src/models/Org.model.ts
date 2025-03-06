import { modelOptions, prop } from '@typegoose/typegoose';

@modelOptions({ schemaOptions: { collection: 'orgs' } })
export class Org {
  @prop({ required: true, unique: true, index: true })
  public name!: string;

  @prop()
  public privateKeyRef!: Buffer;

  @prop()
  public publicKey!: Buffer;
}
