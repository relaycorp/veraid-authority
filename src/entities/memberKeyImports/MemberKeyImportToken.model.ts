import { modelOptions, prop } from '@typegoose/typegoose';

import { BaseUuid4Model } from '../../utilities/BaseUuid4Model.js';

@modelOptions({
  schemaOptions: {
    collection: 'member_key_import_tokens',

    timestamps: {
      createdAt: 'creationDate',
      updatedAt: false,
    },
  },
})
export class MemberKeyImportToken extends BaseUuid4Model {
  @prop({ required: true })
  public memberId!: string;

  @prop({ required: true })
  public serviceOid!: string;
}
