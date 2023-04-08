import { prop, modelOptions } from '@typegoose/typegoose';

@modelOptions({
  schemaOptions: {
    timestamps: {
      createdAt: 'creationDate',
      updatedAt: false,
    },
  },
})
export class MemberPublicKeyModelSchema {
  @prop({ required: true })
  public memberId!: string;

  @prop({ required: true })
  public serviceOid!: string;

  @prop({ required: true })
  public publicKey!: Buffer;

  @prop()
  public readonly creationDate!: Date;
}
