import { bytesToUUID } from '../utils/uuid.js';

export class BinaryReader {
  private offset = 0;
  private view: DataView;
  private buffer: ArrayBuffer;

  constructor(data: ArrayBuffer | Buffer | Uint8Array) {
    if (data instanceof Buffer) {
      this.buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    } else if (data instanceof Uint8Array) {
      this.buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    } else {
      this.buffer = data;
    }
    this.view = new DataView(this.buffer);
  }

  get position(): number {
    return this.offset;
  }

  get remaining(): number {
    return this.buffer.byteLength - this.offset;
  }

  get length(): number {
    return this.buffer.byteLength;
  }

  seek(offset: number): void {
    if (offset < 0 || offset > this.buffer.byteLength) {
      throw new Error(`Seek offset ${offset} out of bounds`);
    }
    this.offset = offset;
  }

  readUint8(): number {
    this.checkBounds(1);
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readUint16(): number {
    this.checkBounds(2);
    const value = this.view.getUint16(this.offset, true); // Little Endian
    this.offset += 2;
    return value;
  }

  readUint32(): number {
    this.checkBounds(4);
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readInt32(): number {
    this.checkBounds(4);
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readInt64(): bigint {
    this.checkBounds(8);
    const value = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readUint64(): bigint {
    this.checkBounds(8);
    const value = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readFloat32(): number {
    this.checkBounds(4);
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readFloat64(): number {
    this.checkBounds(8);
    const value = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readUUID(): string {
    this.checkBounds(16);
    const bytes = new Uint8Array(this.buffer, this.offset, 16);
    this.offset += 16;
    return bytesToUUID(bytes);
  }

  readBytes(length: number): Uint8Array {
    this.checkBounds(length);
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return bytes;
  }

  readString(): string {
    const length = this.readUint16();
    const bytes = this.readBytes(length);
    return new TextDecoder('utf-8').decode(bytes);
  }

  private checkBounds(size: number): void {
    if (this.offset + size > this.buffer.byteLength) {
      throw new Error(
        `Buffer overflow: trying to read ${size} bytes at offset ${this.offset}, buffer size is ${this.buffer.byteLength}`
      );
    }
  }
}
