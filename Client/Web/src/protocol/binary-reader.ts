/**
 * Little Endian 바이너리 리더
 */
export class BinaryReader {
  private view: DataView;
  private offset = 0;

  constructor(buffer: ArrayBuffer | Uint8Array) {
    if (buffer instanceof Uint8Array) {
      this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else {
      this.view = new DataView(buffer);
    }
  }

  get position(): number {
    return this.offset;
  }

  get remaining(): number {
    return this.view.byteLength - this.offset;
  }

  get length(): number {
    return this.view.byteLength;
  }

  readByte(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readUint16(): number {
    const value = this.view.getUint16(this.offset, true); // Little Endian
    this.offset += 2;
    return value;
  }

  readUint32(): number {
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readInt32(): number {
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readInt64(): bigint {
    const value = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readInt64AsNumber(): number {
    return Number(this.readInt64());
  }

  readUint64(): bigint {
    const value = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readFloat32(): number {
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readFloat64(): number {
    const value = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return value;
  }

  /**
   * 16바이트 바이너리를 UUID 문자열로 읽기
   * @returns UUID 문자열 (예: "550e8400-e29b-41d4-a716-446655440000")
   */
  readUuid(): string {
    const bytes = this.readBytes(16);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  readBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length);
    this.offset += length;
    return bytes;
  }

  readString(): string {
    const length = this.readUint16();
    const bytes = this.readBytes(length);
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  }

  skip(count: number): void {
    this.offset += count;
  }

  seek(position: number): void {
    this.offset = position;
  }

  /**
   * 현재 위치부터 끝까지 남은 데이터 반환
   */
  readRemainingBytes(): Uint8Array {
    return this.readBytes(this.remaining);
  }
}
