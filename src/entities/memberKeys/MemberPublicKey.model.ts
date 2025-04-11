import { prop, modelOptions } from '@typegoose/typegoose';

import { BaseUuid4Model } from '../../utilities/BaseUuid4Model.js';

@modelOptions({
  schemaOptions: {
    collection: 'member_public_keys',

    timestamps: {
      createdAt: 'creationDate',
      updatedAt: false,
    },
  },
})
export class MemberPublicKey extends BaseUuid4Model {
  @prop({ required: true })
  public memberId!: string;

  @prop({ required: true })
  public serviceOid!: string;

  @prop({ required: true })
  public publicKey!: Buffer;

  @prop()
  public readonly creationDate!: Date;
}
