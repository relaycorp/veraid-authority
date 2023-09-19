import { modelOptions, prop } from '@typegoose/typegoose';

@modelOptions({ schemaOptions: { collection: 'member_bundle_requests' } })
export class MemberBundleRequestModelSchema {
  @prop({ required: true, unique: true })
  public publicKeyId!: string;

  @prop({ required: true })
  public memberId!: string;

  @prop({ required: true })
  public memberBundleStartDate!: Date;

  @prop({ required: true })
  public signature!: Buffer;

  @prop({ required: true })
  public peerId!: string;
}
