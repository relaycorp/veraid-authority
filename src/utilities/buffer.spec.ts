import { bufferToArrayBuffer } from './buffer.js';

describe('bufferToArrayBuffer', () => {
  test('Buffer should be converted to ArrayBuffer', () => {
    const array = [1, 2, 3];
    const buffer = Buffer.from(array);

    const arrayBuffer = bufferToArrayBuffer(buffer);

    const arrayBufferView = new Uint8Array(arrayBuffer);
    expect(arrayBufferView).toStrictEqual(new Uint8Array(array));
  });
});
