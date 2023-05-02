import type { Result } from './utilities/result.js';
import { VeraidContentType } from './utilities/veraid.js';
import { AwalaContentType } from './utilities/awala.js';

const contentTypeHeaderName = 'content-type';
const awalaRecipientHeaderName = 'X-Awala-Recipient';

export async function postToAwala(
  data: BodyInit,
  awalaPda: string,
  awalaMiddlewareUrl: URL,
): Promise<Result<undefined, string>> {
  const pdaResponse = await fetch(awalaMiddlewareUrl, {
    method: 'POST',
    headers: { [contentTypeHeaderName]: AwalaContentType.PDA },
    body: awalaPda,
  });
  const { recipientId } = (await pdaResponse.json()) as {
    recipientId: string;
  };

  if (!recipientId) {
    return {
      didSucceed: false,
      context: 'Recipient id was missing from Awala PDA import response',
    };
  }

  await fetch(awalaMiddlewareUrl, {
    body: data,
    method: 'POST',

    headers: {
      [contentTypeHeaderName]: VeraidContentType.MEMBER_BUNDLE,
      [awalaRecipientHeaderName]: recipientId,
    },
  });

  return {
    didSucceed: true,
  };
}
