import { jest } from '@jest/globals';

import { AWALA_PDA } from './testUtils/stubs.js';
import { postToAwala } from './awala.js';
import { mockSpy } from './testUtils/jest.js';
import { AWALA_MIDDLEWARE_ENDPOINT } from './testUtils/eventing/stubs.js';
import { requireFailureResult } from './testUtils/result.js';

describe('postToAwala', () => {
  const mockFetch = mockSpy(jest.spyOn(global, 'fetch'));
  const testAwalaEndpoint: URL = new URL(AWALA_MIDDLEWARE_ENDPOINT);
  const testRecipientId = 'TEST_RECIPIENT_ID';
  const contentTypeHeaderName = 'content-type';
  const awalaRecipientHeaderName = 'X-Awala-Recipient';
  const awalaPostData = 'Test data';

  describe('Success path', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ recipientId: testRecipientId })));
    });

    describe('Should make authorization request', () => {
      test('Endpoint should be taken from parameter', async () => {
        await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

        expect(mockFetch).toHaveBeenNthCalledWith(1, testAwalaEndpoint, expect.anything());
      });

      test('Method should be POST', async () => {
        await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

        expect(mockFetch).toHaveBeenNthCalledWith(
          1,
          expect.anything(),
          expect.objectContaining({
            method: 'POST',
          }),
        );
      });

      test('Content type should be application/vnd+relaycorp.awala.pda-path', async () => {
        await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

        expect(mockFetch).toHaveBeenNthCalledWith(
          1,
          expect.anything(),
          expect.objectContaining({
            headers: { [contentTypeHeaderName]: 'application/vnd+relaycorp.awala.pda-path' },
          }),
        );
      });

      test('Body should be Awala PDA', async () => {
        await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

        expect(mockFetch).toHaveBeenNthCalledWith(
          1,
          expect.anything(),
          expect.objectContaining({
            body: AWALA_PDA,
          }),
        );
      });
    });

    describe('Should post data to awala', () => {
      test('Endpoint should be taken from parameter', async () => {
        await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

        expect(mockFetch).toHaveBeenNthCalledWith(2, testAwalaEndpoint, expect.anything());
      });

      test('Method should be POST', async () => {
        await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          expect.anything(),
          expect.objectContaining({
            method: 'POST',
          }),
        );
      });

      test('Content type should be application/vnd.veraid.member-bundle', async () => {
        await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          expect.anything(),
          expect.objectContaining({
            headers: expect.objectContaining({
              [contentTypeHeaderName]: 'application/vnd.veraid.member-bundle',
            }),
          }),
        );
      });

      test('Headers should include X-Awala-Recipient with recipient id', async () => {
        await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          expect.anything(),
          expect.objectContaining({
            headers: expect.objectContaining({
              [awalaRecipientHeaderName]: testRecipientId,
            }),
          }),
        );
      });

      test('Body should be taken form parameter', async () => {
        await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          expect.anything(),
          expect.objectContaining({
            body: awalaPostData,
          }),
        );
      });
    });

    test('Should return success', async () => {
      const result = await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

      expect(result.didSucceed).toBeTrue();
    });
  });

  test('Missing recipient id from Awala response should not post data', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({})));

    const awalaResponse = await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

    requireFailureResult(awalaResponse);
    expect(awalaResponse.reason).toBe('Recipient id was missing from Awala PDA import response');
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
