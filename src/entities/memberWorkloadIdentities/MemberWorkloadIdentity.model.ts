import { prop, modelOptions } from '@typegoose/typegoose';

@modelOptions({
  schemaOptions: {
    collection: 'member_workload_identities',

    timestamps: {
      createdAt: 'creationDate',
      updatedAt: false,
    },
  },
})
export class MemberWorkloadIdentity {
  @prop({ required: true })
  public memberId!: string;

  @prop({ required: true })
  public jwksUrl!: string;

  @prop({ required: true })
  public jwtSubjectField!: string;

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
