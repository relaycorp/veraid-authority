import { setTimeout } from 'node:timers/promises';

type PostOptions = Omit<Omit<RequestInit, 'method'>, 'signal'>;

const POST_TIMEOUT_MS = 3000;

const READINESS_CHECK_TIMEOUT_MS = 500;
const READINESS_CHECK_INTERVAL_MS = 1000;
const READINESS_CHECK_MAX_ATTEMPTS = 10;

export async function post(url: string, options: PostOptions): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(POST_TIMEOUT_MS),
    ...options,
  });
}

export function waitForServerToBeReady(url: string): void {
  const hookTimeout =
    (READINESS_CHECK_INTERVAL_MS + READINESS_CHECK_TIMEOUT_MS) * READINESS_CHECK_MAX_ATTEMPTS;

  beforeAll(async () => {
    let attempts = 0;
    let lastError: string | undefined;
    while (attempts < READINESS_CHECK_MAX_ATTEMPTS) {
      attempts += 1;
      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(url, {
          signal: AbortSignal.timeout(READINESS_CHECK_TIMEOUT_MS),
        });
        if (response.ok) {
          return;
        }
        lastError = `HTTP ${response.status}`;
      } catch (error) {
        lastError = (error as Error).message;
      }

      // eslint-disable-next-line no-await-in-loop
      await setTimeout(READINESS_CHECK_INTERVAL_MS);
    }

    const checkTimeout = READINESS_CHECK_INTERVAL_MS * READINESS_CHECK_MAX_ATTEMPTS;
    throw new Error(`${url} not ready after ${checkTimeout}ms`, { cause: lastError });
  }, hookTimeout);
}
