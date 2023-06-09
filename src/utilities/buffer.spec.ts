import { bufferToArrayBuffer, bufferToJson } from './buffer.js';

describe('bufferToArrayBuffer', () => {
  test('Buffer should be converted to ArrayBuffer', () => {
    const array = [1, 2, 3];
    const buffer = Buffer.from(array);

    const arrayBuffer = bufferToArrayBuffer(buffer);

    const arrayBufferView = new Uint8Array(arrayBuffer);
    expect(arrayBufferView).toStrictEqual(new Uint8Array(array));
  });
});

describe('bufferToJson', () => {
  test('Buffer should be converted to object', () => {
    const json = {
      test: 1,
    };
    const jsonString = JSON.stringify(json);
    const buffer = Buffer.from(jsonString);

    const result = bufferToJson(buffer);

    expect(result).toStrictEqual(json);
  });

  test('Invalid json should return null', () => {
    const buffer = Buffer.from('INVALID_JSON');

    const result = bufferToJson(buffer);

    expect(result).toBeNull();
  });
});
