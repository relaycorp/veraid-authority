import { type CloudEvent, HTTP } from 'cloudevents';

import { post, type PostOptions } from './http.js';

export async function postEvent(
  event: CloudEvent<unknown>,
  url: string,
  options: Partial<PostOptions> = {},
): Promise<Response> {
  const message = HTTP.binary(event);
  return post(url, {
    headers: message.headers as HeadersInit,
    body: message.body as string,
    ...options,
  });
}
