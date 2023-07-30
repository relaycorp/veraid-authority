import { type CloudEvent, HTTP } from 'cloudevents';

const POST_EVENT_TIMEOUT_MS = 3000;

export async function postEvent(event: CloudEvent<unknown>, url: string): Promise<Response> {
  const message = HTTP.binary(event);
  return fetch(url, {
    method: 'POST',
    headers: message.headers as HeadersInit,
    body: message.body as string,
    signal: AbortSignal.timeout(POST_EVENT_TIMEOUT_MS),
  });
}
