import { prop, modelOptions, Ref } from '@typegoose/typegoose';

import { Member } from '../members/Member.model.js';
import { BaseUuid4Model } from '../../utilities/BaseUuid4Model.js';

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
export class SignatureSpec extends BaseUuid4Model {
  @prop({ required: true })
  public orgName!: string;

  @prop({ required: true, ref: () => Member })
  public member!: Ref<Member>;

  @prop({ required: true })
  public auth!: OidcDiscoveryAuth;

  @prop({ required: true })
  public serviceOid!: string;

  @prop({ required: true, default: 3600 })
  public ttlSeconds!: number;

  @prop({ required: true })
  public plaintext!: Buffer;

  @prop()
  public readonly creationDate!: Date;
}
