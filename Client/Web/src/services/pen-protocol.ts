/**
 * NeoSmartpen Protocol V2 constants and helpers
 * Based on PenStreamer.Browser/Bluetooth/WebBluetoothPenClient.cs
 */

// Protocol constants
export const Protocol = {
  STX: 0xc0,
  ETX: 0xc1,
  DLE: 0x7d,

  // Commands
  CMD_VERSION_REQUEST: 0x01,
  CMD_VERSION_RESPONSE: 0x81,
  CMD_PASSWORD_REQUEST: 0x02,
  CMD_PASSWORD_RESPONSE: 0x82,
  CMD_SETTING_INFO_REQUEST: 0x04,
  CMD_SETTING_INFO_RESPONSE: 0x84,
  CMD_SETTING_CHANGE_REQUEST: 0x05,
  CMD_SETTING_CHANGE_RESPONSE: 0x85,
  CMD_ONLINE_DATA_REQUEST: 0x11,
  CMD_ONLINE_DATA_RESPONSE: 0x91,

  // Events
  EVT_LOW_BATTERY: 0x61,
  EVT_SHUTDOWN: 0x62,
  EVT_PEN_UPDOWN: 0x63,
  EVT_PAPER_INFO: 0x64,
  EVT_PEN_DOT: 0x65,
  EVT_PEN_ERROR: 0x68,
  EVT_NEW_PEN_DOWN: 0x69,
  EVT_NEW_PEN_UP: 0x6a,
  EVT_NEW_PAPER_INFO: 0x6b,
  EVT_NEW_PEN_DOT: 0x6c,
  EVT_NEW_PEN_ERROR: 0x6d,

  // Settings
  SETTING_TIMESTAMP: 0x01,
} as const;

// Dot types
export const DotType = {
  PenDown: 0,
  PenMove: 1,
  PenUp: 2,
  PenHover: 3,
} as const;

export type DotType = (typeof DotType)[keyof typeof DotType];

// Ncode page address
export interface NcodePageAddress {
  section: number;
  owner: number;
  book: number;
  page: number;
}

// Dot event data
export interface DotData {
  x: number;
  y: number;
  force: number;
  maxForce: number;
  section: number;
  owner: number;
  book: number;
  page: number;
  timestamp: number;
  dotType: DotType;
  tiltX: number;
  tiltY: number;
  twist: number;
}

// Pen connected event data
export interface PenConnectedData {
  macAddress: string;
  deviceName: string;
  firmwareVersion: string;
  protocolVersion: string;
  maxForce: number;
}

// Pen status data
export interface PenStatusData {
  battery: number;
  beep: boolean;
  hover: boolean;
  sensitivity: number;
}

/**
 * Packet reader for parsing response data
 */
export class PacketReader {
  private data: Uint8Array;
  private position: number;

  constructor(data: Uint8Array) {
    this.data = data;
    this.position = 0;
  }

  getByte(): number {
    if (this.position >= this.data.length) return 0;
    return this.data[this.position++];
  }

  getByteToInt(): number {
    return this.getByte() & 0xff;
  }

  getShort(): number {
    if (this.position + 2 > this.data.length) return 0;
    const result = this.data[this.position] | (this.data[this.position + 1] << 8);
    this.position += 2;
    // Convert to signed short
    return result > 0x7fff ? result - 0x10000 : result;
  }

  getUShort(): number {
    if (this.position + 2 > this.data.length) return 0;
    const result = this.data[this.position] | (this.data[this.position + 1] << 8);
    this.position += 2;
    return result;
  }

  getInt(): number {
    if (this.position + 4 > this.data.length) return 0;
    const result =
      this.data[this.position] |
      (this.data[this.position + 1] << 8) |
      (this.data[this.position + 2] << 16) |
      (this.data[this.position + 3] << 24);
    this.position += 4;
    return result;
  }

  getLong(): bigint {
    if (this.position + 8 > this.data.length) return BigInt(0);
    let result = BigInt(0);
    for (let i = 0; i < 8; i++) {
      result |= BigInt(this.data[this.position + i]) << BigInt(i * 8);
    }
    this.position += 8;
    return result;
  }

  getBytes(count: number): Uint8Array {
    const available = Math.min(count, this.data.length - this.position);
    const result = this.data.slice(this.position, this.position + available);
    this.position += available;
    return result;
  }

  getString(length: number): string {
    const bytes = this.getBytes(length);
    let nullIndex = bytes.indexOf(0);
    if (nullIndex === -1) nullIndex = bytes.length;
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes.slice(0, nullIndex));
  }
}

/**
 * Packet builder for creating request packets
 */
export class PacketBuilder {
  private data: number[] = [];
  private cmd: number;

  constructor(cmd: number) {
    this.cmd = cmd;
  }

  put(value: number): PacketBuilder {
    this.data.push(value & 0xff);
    return this;
  }

  putShort(value: number): PacketBuilder {
    this.data.push(value & 0xff);
    this.data.push((value >> 8) & 0xff);
    return this;
  }

  putInt(value: number): PacketBuilder {
    this.data.push(value & 0xff);
    this.data.push((value >> 8) & 0xff);
    this.data.push((value >> 16) & 0xff);
    this.data.push((value >> 24) & 0xff);
    return this;
  }

  putLong(value: bigint): PacketBuilder {
    for (let i = 0; i < 8; i++) {
      this.data.push(Number((value >> BigInt(i * 8)) & BigInt(0xff)));
    }
    return this;
  }

  putBytes(bytes: Uint8Array): PacketBuilder {
    for (const b of bytes) {
      this.data.push(b);
    }
    return this;
  }

  putString(value: string, length: number): PacketBuilder {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    for (let i = 0; i < length; i++) {
      this.data.push(i < bytes.length ? bytes[i] : 0);
    }
    return this;
  }

  putNull(length: number): PacketBuilder {
    for (let i = 0; i < length; i++) {
      this.data.push(0);
    }
    return this;
  }

  build(): Uint8Array {
    const result: number[] = [Protocol.STX];

    const addWithEscape = (b: number) => {
      if (b === Protocol.STX || b === Protocol.ETX || b === Protocol.DLE) {
        result.push(Protocol.DLE);
        result.push(b ^ 0x20);
      } else {
        result.push(b);
      }
    };

    addWithEscape(this.cmd);
    const length = this.data.length;
    addWithEscape(length & 0xff);
    addWithEscape((length >> 8) & 0xff);

    for (const b of this.data) {
      addWithEscape(b);
    }

    result.push(Protocol.ETX);
    return new Uint8Array(result);
  }
}

/**
 * Format page address as string (section.owner.book.page)
 */
export function formatPageAddress(address: NcodePageAddress): string {
  return `${address.section}.${address.owner}.${address.book}.${address.page}`;
}

/**
 * Parse page address string (section.owner.book.page)
 */
export function parsePageAddress(str: string): NcodePageAddress | null {
  const parts = str.split('.');
  if (parts.length !== 4) return null;

  const [section, owner, book, page] = parts.map(Number);
  if ([section, owner, book, page].some(isNaN)) return null;

  return { section, owner, book, page };
}

/**
 * Convert page address to unique number for map key
 */
export function pageAddressToKey(address: NcodePageAddress): string {
  return `${address.section}.${address.owner}.${address.book}.${address.page}`;
}

/**
 * Mouse page section (for virtual mouse-drawn pages)
 */
export const MOUSE_PAGE_SECTION = 1024;
export const MOUSE_PAGE_OWNER = 1;
export const MOUSE_PAGE_BOOK = 1;
