import { mockServerClient, type Expectation, type HttpResponse } from 'mockserver-client';
import type { MockServerClient } from 'mockserver-client/mockServerClient.js';

import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import { VeraidContentType } from '../../utilities/veraid.js';

import { connectToClusterService } from './kubernetes.js';
import { sleep } from './time.js';
import { getServiceActiveRevision } from './knative.js';

const SERVICE_PORT = 80;

const PORT_FORWARDING_DELAY_MS = 400;

const EXPECTATIONS: Expectation[] = [
  {
    httpRequest: {
      method: 'POST',
      path: '/',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      headers: { 'Content-Type': VeraidContentType.MEMBER_BUNDLE },
    },

    httpResponse: {
      statusCode: HTTP_STATUS_CODES.ACCEPTED,
    },
  },
];

type Command = (client: MockServerClient) => Promise<unknown>;

async function connectToMockServer(command: Command): Promise<void> {
  const revision = await getServiceActiveRevision('mock-awala-middleware');
  const serviceName = `${revision}-private`;
  await connectToClusterService(serviceName, SERVICE_PORT, async (localPort) => {
    await sleep(PORT_FORWARDING_DELAY_MS);

    const client = mockServerClient('127.0.0.1', localPort);
    await command(client);
  });
}

async function getMockAwalaMiddlewareRequests(): Promise<HttpResponse[]> {
  let requests: HttpResponse[] | undefined;
  await connectToMockServer(async (client) => {
    requests = await client.retrieveRecordedRequests({ path: '/' });
  });

  if (requests === undefined) {
    throw new Error('Failed to retrieve Awala Middleware requests');
  }
  return requests;
}

export async function mockAwalaMiddleware(): Promise<void> {
  await connectToMockServer(async (client) => {
    await client.reset();
    await client.mockAnyResponse(EXPECTATIONS);
  });
}

export async function getMockRequestsByContentType(contentType: string): Promise<HttpResponse[]> {
  const requests = await getMockAwalaMiddlewareRequests();
  return requests.filter((req) => {
    if (!req.headers) {
      return [];
    }
    const headers = req.headers as { [key: string]: string[] };
    const contentTypes = headers['Content-Type'];
    return contentTypes.find((reqContentType: string) => reqContentType === contentType);
  });
}
