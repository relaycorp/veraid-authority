import { API_URL } from './api.js';

export const STUB_AWALA_PDA = Buffer.from('This is supposed to be a PDA');

export const KEY_IMPORT_CONTENT_TYPE = 'application/vnd.veraid.member-public-key-import';

export async function postAwalaMessage(contentType: string, body: BodyInit): Promise<Response> {
  return fetch(`${API_URL}/awala`, {
    method: 'POST',
    headers: new Headers([['Content-Type', contentType]]),
    body,
  });
}
