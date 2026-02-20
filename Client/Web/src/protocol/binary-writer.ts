/**
 * Little Endian 바이너리 라이터
 */
export class BinaryWriter {
  private chunks: ArrayBuffer[] = [];
  private totalSize = 0;

  writeByte(value: number): this {
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

  writeInt64(value: bigint | number): this {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigInt64(0, BigInt(value), true);
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

  /**
   * UUID를 16바이트 바이너리로 쓰기
   * @param uuid UUID 문자열 (예: "550e8400-e29b-41d4-a716-446655440000")
   */
  writeUuid(uuid: string): this {
    const hex = uuid.replace(/-/g, '');
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    this.chunks.push(bytes.buffer);
    this.totalSize += 16;
    return this;
  }

  writeBytes(data: ArrayBuffer | Uint8Array): this {
    let buffer: ArrayBuffer;
    if (data instanceof Uint8Array) {
      // Create a new ArrayBuffer copy to avoid SharedArrayBuffer issues
      buffer = new ArrayBuffer(data.byteLength);
      new Uint8Array(buffer).set(data);
    } else {
      buffer = data;
    }
    this.chunks.push(buffer);
    this.totalSize += buffer.byteLength;
    return this;
  }

  writeString(value: string): this {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    this.writeUint16(bytes.length);
    this.chunks.push(bytes.buffer);
    this.totalSize += bytes.length;
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

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.toArrayBuffer());
  }

  clear(): void {
    this.chunks = [];
    this.totalSize = 0;
  }

  get length(): number {
    return this.totalSize;
  }
}
