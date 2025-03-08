import { setTimeout } from 'node:timers/promises';

const READINESS_CHECK_TIMEOUT_MS = 500;
const READINESS_CHECK_INTERVAL_MS = 1000;
const READINESS_CHECK_MAX_ATTEMPTS = 30;

const HEALTHCHECK_URLS = [
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8082',
  'http://127.0.0.1:8083/default/.well-known/openid-configuration',
];

async function waitForServerToBeReady(url: string): Promise<void> {
  let attempts = 0;
  let lastError = '';

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

  throw new Error(`${url} not ready after ${checkTimeout}ms: ${lastError}`);
}

export async function waitForServers(): Promise<void> {
  await Promise.all(HEALTHCHECK_URLS.map(async (url) => waitForServerToBeReady(url)));
}
