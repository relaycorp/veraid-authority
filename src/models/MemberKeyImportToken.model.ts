import { prop } from '@typegoose/typegoose';

export class MemberKeyImportTokenModelSchema {
  @prop({ required: true })
  public memberId!: string;

  @prop({ required: true })
  public serviceOid!: string;
}
