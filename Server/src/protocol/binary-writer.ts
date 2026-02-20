import { uuidToBytes } from '../utils/uuid.js';

export class BinaryWriter {
  private chunks: ArrayBuffer[] = [];
  private totalSize = 0;

  get size(): number {
    return this.totalSize;
  }

  writeUint8(value: number): this {
    const buf = new ArrayBuffer(1);
    new DataView(buf).setUint8(0, value);
    this.chunks.push(buf);
    this.totalSize += 1;
    return this;
  }

  writeUint16(value: number): this {
    const buf = new ArrayBuffer(2);
    new DataView(buf).setUint16(0, value, true); // Little Endian
    this.chunks.push(buf);
    this.totalSize += 2;
    return this;
  }

  writeUint32(value: number): this {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setUint32(0, value, true);
    this.chunks.push(buf);
    this.totalSize += 4;
    return this;
  }

  writeInt32(value: number): this {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setInt32(0, value, true);
    this.chunks.push(buf);
    this.totalSize += 4;
    return this;
  }

  writeInt64(value: bigint): this {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigInt64(0, value, true);
    this.chunks.push(buf);
    this.totalSize += 8;
    return this;
  }

  writeUint64(value: bigint): this {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigUint64(0, value, true);
    this.chunks.push(buf);
    this.totalSize += 8;
    return this;
  }

  writeFloat32(value: number): this {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, value, true);
    this.chunks.push(buf);
    this.totalSize += 4;
    return this;
  }

  writeFloat64(value: number): this {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, value, true);
    this.chunks.push(buf);
    this.totalSize += 8;
    return this;
  }

  writeUUID(uuid: string): this {
    const bytes = uuidToBytes(uuid);
    this.chunks.push(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    this.totalSize += 16;
    return this;
  }

  writeBytes(bytes: Uint8Array | ArrayBuffer): this {
    const buffer = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    this.chunks.push(buffer);
    this.totalSize += buffer.byteLength;
    return this;
  }

  writeString(str: string): this {
    const encoded = new TextEncoder().encode(str);
    this.writeUint16(encoded.length);
    this.writeBytes(encoded);
    return this;
  }

  toArrayBuffer(): ArrayBuffer {
    const result = new Uint8Array(this.totalSize);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    return result.buffer;
  }

  toBuffer(): Buffer {
    return Buffer.from(this.toArrayBuffer());
  }

  reset(): void {
    this.chunks = [];
    this.totalSize = 0;
  }
}
