import { modelOptions, prop } from '@typegoose/typegoose';

@modelOptions({ schemaOptions: { collection: 'member_key_import_tokens' } })
export class MemberKeyImportTokenModelSchema {
  @prop({ required: true })
  public memberId!: string;

  @prop({ required: true })
  public serviceOid!: string;
}
