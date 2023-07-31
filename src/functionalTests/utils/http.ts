type PostOptions = Omit<Omit<RequestInit, 'method'>, 'signal'>;

const POST_TIMEOUT_MS = 3000;

export async function post(url: string, options: PostOptions): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(POST_TIMEOUT_MS),
    ...options,
  });
}
