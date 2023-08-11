import { type CloudEvent, HTTP } from 'cloudevents';

import { post } from './http.js';

export async function postEvent(event: CloudEvent<unknown>, url: string): Promise<Response> {
  const message = HTTP.binary(event);
  return post(url, {
    headers: message.headers as HeadersInit,
    body: message.body as string,
  });
}
