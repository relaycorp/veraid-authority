/**
 * Utilities related to MockServer and its client.
 */

export interface BinaryBody {
  readonly contentType: string;
  readonly base64Bytes: string;
}

export function jsonParseBinaryBody(body: BinaryBody, expectedContentType: string): unknown {
  expect(body.contentType).toBe(expectedContentType);
  const bodyBuffer = Buffer.from(body.base64Bytes, 'base64');
  return JSON.parse(bodyBuffer.toString());
}
