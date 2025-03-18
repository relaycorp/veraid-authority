import { prop } from '@typegoose/typegoose';

export class OidcDiscoveryAuth {
  @prop({
    required: true,
    type: String,
    get: (url: string) => new URL(url),
    set: (url: URL) => url.toString(),
  })
  public providerIssuerUrl!: URL;

  @prop({ required: true })
  public jwtSubjectClaim!: string;

  @prop({ required: true })
  public jwtSubjectValue!: string;
}
