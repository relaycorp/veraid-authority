import { prop, modelOptions, index } from '@typegoose/typegoose';

import { JwksDocumentSchema } from './jwksDocument.schema.js';

@modelOptions({
  schemaOptions: {
    collection: 'cached_jwks',
  },
})
@index({ issuerUrl: 1 }, { unique: true })
@index({ expiry: 1 }, { expireAfterSeconds: 0 })
export class CachedJwks {
  @prop({ required: true })
  public issuerUrl!: string;

  @prop({ required: true, type: Object })
  public document!: JwksDocumentSchema;

  @prop({ required: true })
  public expiry!: Date;
}
