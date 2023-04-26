import { bufferToArrayBuffer } from '../utilities/buffer.js';

export function stringToArrayBuffer(string: string): ArrayBuffer {
  return bufferToArrayBuffer(Buffer.from(string));
}
