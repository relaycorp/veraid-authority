import { randomUUID } from 'node:crypto';

import { prop } from '@typegoose/typegoose';

export class BaseUuid4Model {
  @prop({ required: true, default: () => randomUUID() })
  // eslint-disable-next-line @typescript-eslint/naming-convention
  public _id!: string;
}
