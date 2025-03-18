import { prop, modelOptions } from '@typegoose/typegoose';

@modelOptions({
  schemaOptions: {
    collection: 'signature_specs',

    timestamps: {
      createdAt: 'creationDate',
      updatedAt: false,
    },
  },
})
export class SignatureSpec {
  @prop({ required: true })
  public memberId!: string;

  @prop({
    required: true,
    type: String,
    get: (url: string) => new URL(url),
    set: (url: URL) => url.toString(),
  })
  public openidProviderIssuerUrl!: URL;

  @prop({ required: true })
  public jwtSubjectClaim!: string;

  @prop({ required: true })
  public jwtSubjectValue!: string;

  @prop({ required: true })
  public veraidServiceOid!: string;

  @prop({ required: true, default: 3600 })
  public veraidSignatureTtlSeconds!: number;

  @prop({ required: true })
  public veraidSignaturePlaintext!: Buffer;

  @prop()
  public readonly creationDate!: Date;
}
