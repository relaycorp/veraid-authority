import { prop, modelOptions, index, Severity } from '@typegoose/typegoose';

import { JwksDocumentSchema } from './jwksDocument.schema.js';

@modelOptions({
  schemaOptions: {
    collection: 'cached_jwks',
  },
})
@index({ issuerUrl: 1 }, { unique: true })
@index({ expiry: 1 }, { expireAfterSeconds: 0 })
export class CachedJwks {
  @prop({
    required: true,
    type: String,
    get: (url: string) => new URL(url),
    set: (url: URL) => url.toString(),
  })
  public issuerUrl!: URL;

  @prop({ allowMixed: Severity.ALLOW, required: true })
  public document!: JwksDocumentSchema;

  @prop({ required: true })
  public expiry!: Date;
}
