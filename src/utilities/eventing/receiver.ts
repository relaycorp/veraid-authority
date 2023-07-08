import { makeReceiver } from '@relaycorp/cloudevents-transport';
import envVar from 'env-var';

import { DEFAULT_TRANSPORT } from './transport.js';

const transport = envVar.get('CE_TRANSPORT').default(DEFAULT_TRANSPORT).asString();
export const convertMessageToEvent = await makeReceiver(transport);
