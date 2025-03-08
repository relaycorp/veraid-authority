const POST_TIMEOUT_MS = 3000;

export type PostOptions = Omit<RequestInit, 'method'>;

export async function post(url: string, options: Partial<PostOptions> = {}): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(POST_TIMEOUT_MS),
    ...options,
  });
}
