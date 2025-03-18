import { prop, modelOptions } from '@typegoose/typegoose';

import { OidcDiscoveryAuth } from './OidcDiscoveryAuth.model.js';

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

  @prop({ required: true })
  public auth!: OidcDiscoveryAuth;

  @prop({ required: true })
  public veraidServiceOid!: string;

  @prop({ required: true, default: 3600 })
  public veraidSignatureTtlSeconds!: number;

  @prop({ required: true })
  public veraidSignaturePlaintext!: Buffer;

  @prop()
  public readonly creationDate!: Date;
}
