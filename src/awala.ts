import type { Result } from './utilities/result.js';

const contentTypeHeaderName = 'content-type';
const awalaRecipientHeaderName = 'X-Awala-Recipient';

export async function postToAwala(
  data: BodyInit,
  awalaPda: string,
  awalaMiddlewareUrl: URL,
): Promise<Result<undefined, string>> {
  const pdaResponse = await fetch(awalaMiddlewareUrl, {
    method: 'POST',
    headers: { [contentTypeHeaderName]: 'application/vnd+relaycorp.awala.pda-path' },
    body: awalaPda,
  });
  const { recipientId } = (await pdaResponse.json()) as {
    recipientId: string;
  };

  if (!recipientId) {
    return {
      didSucceed: false,
      reason: 'Recipient id was missing from Awala PDA import response',
    };
  }

  await fetch(awalaMiddlewareUrl, {
    body: data,
    method: 'POST',

    headers: {
      [contentTypeHeaderName]: 'application/vnd.veraid.member-bundle',
      [awalaRecipientHeaderName]: recipientId,
    },
  });

  return {
    didSucceed: true,
  };
}
