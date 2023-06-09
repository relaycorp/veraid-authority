export function bufferToArrayBuffer(buffer: Uint8Array): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

export function bufferToJson(buffer: Buffer): object | null {
  const jsonString = buffer.toString();
  try {
    return JSON.parse(jsonString) as object;
  } catch {
    return null;
  }
}
