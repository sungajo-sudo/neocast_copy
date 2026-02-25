// Client -> Server message types
export enum ClientMessageType {
  STROKE_START = 0x01,
  STROKE_POINT = 0x02,
  STROKE_END = 0x03,
  STROKE_CANCEL = 0x04,
  STROKE_POINT_BATCH = 0x05,

  PAGE_CHANGE = 0x10,
  PAGE_ADD = 0x11,
  PAGE_DELETE = 0x12,

  CLEAR_PAGE = 0x20,
  CLEAR_ALL = 0x21,
  UNDO = 0x22,
  REDO = 0x23,

  POINTER_MOVE = 0x30,
  POINTER_ON = 0x31,
  POINTER_OFF = 0x32,
}

// Server -> Client message types
export enum ServerMessageType {
  WRAPPED = 0xf0,
  HISTORY_START = 0xf1,
  HISTORY_STROKE = 0xf2,
  HISTORY_END = 0xf3,
  HISTORY_PAGE = 0xf4,

  ERROR = 0xe0,
  ACK = 0xe1,
}

// Voice namespace message types
export enum VoiceMessageType {
  VOICE_DATA = 0x80,
  VOICE_START = 0x81,
  VOICE_END = 0x82,
  VOICE_MUTE = 0x83,
  VOICE_UNMUTE = 0x84,
}

// Pen types
export enum PenType {
  PEN = 0,
  HIGHLIGHTER = 1,
  ERASER = 2,
  BRUSH = 3,
}

// Pointer types
export enum PointerType {
  DOT = 0,
  LASER = 1,
  SPOTLIGHT = 2,
}

// NcodePageAddress - Neolab Ncode page address format
export interface NcodePageAddress {
  section: number; // 0-4095 (12 bits)
  owner: number; // 0-65535 (16 bits)
  book: number; // 0-4095 (12 bits)
  page: number; // 0-4095 (12 bits)
}

// Mouse input uses special section=1024
export const MOUSE_PAGE_SECTION = 1024;
export const MOUSE_PAGE_OWNER = 1;
export const MOUSE_PAGE_BOOK = 1;

/**
 * Pack NcodePageAddress into a 64-bit bigint
 * Layout: [section:12][owner:16][book:12][page:12] = 52 bits, fits in 64-bit
 */
export function packPageAddress(address: NcodePageAddress): bigint {
  const section = BigInt(address.section & 0xfff);
  const owner = BigInt(address.owner & 0xffff);
  const book = BigInt(address.book & 0xfff);
  const page = BigInt(address.page & 0xfff);
  return page | (book << 12n) | (owner << 24n) | (section << 40n);
}

/**
 * Unpack 64-bit bigint to NcodePageAddress
 */
export function unpackPageAddress(packed: bigint): NcodePageAddress {
  return {
    page: Number(packed & 0xfffn),
    book: Number((packed >> 12n) & 0xfffn),
    owner: Number((packed >> 24n) & 0xffffn),
    section: Number((packed >> 40n) & 0xfffn),
  };
}

/**
 * Format page address as string: section.owner.book.page
 */
export function formatPageAddress(address: NcodePageAddress): string {
  return `${address.section}.${address.owner}.${address.book}.${address.page}`;
}

/**
 * Parse page address string to NcodePageAddress
 */
export function parsePageAddressString(str: string): NcodePageAddress | null {
  const parts = str.split('.');
  if (parts.length !== 4) return null;
  const [section, owner, book, page] = parts.map(Number);
  if (isNaN(section) || isNaN(owner) || isNaN(book) || isNaN(page)) return null;
  return { section, owner, book, page };
}

/**
 * Create a mouse page address with given page number
 */
export function createMousePageAddress(pageNumber: number): NcodePageAddress {
  return {
    section: MOUSE_PAGE_SECTION,
    owner: MOUSE_PAGE_OWNER,
    book: MOUSE_PAGE_BOOK,
    page: pageNumber,
  };
}

/**
 * Check if page address is a mouse page (section=1024)
 */
export function isMousePage(address: NcodePageAddress): boolean {
  return address.section === MOUSE_PAGE_SECTION;
}

// Page types
export enum PageType {
  BLANK = 0,
  LINED = 1,
  GRID = 2,
  DOT = 3,
}

// Stroke flags
export enum StrokeFlags {
  PRESSURE_SENSITIVE = 1 << 0,
  TILT_SENSITIVE = 1 << 1,
}

// Protocol error codes (matching PROTOCOL.md)
export enum ProtocolErrorCode {
  SESSION_NOT_FOUND = 1001,
  SESSION_CLOSED = 1002,
  SESSION_FULL = 1003,
  PERMISSION_DENIED = 2001,
  NOT_HOST = 2002,
  INVALID_PACKET = 3001,
  INVALID_STROKE_ID = 3002,
  RATE_LIMITED = 4001,
}

// Message sizes (in bytes)
// Updated for 64-bit pageAddress (8 bytes) instead of 32-bit pageId (4 bytes)
export const MESSAGE_SIZES = {
  STROKE_START: 43, // +4 bytes for pageAddress (uint32 -> uint64)
  STROKE_POINT: 35,
  STROKE_END: 17,
  STROKE_CANCEL: 17,
  PAGE_CHANGE: 9, // +4 bytes
  PAGE_ADD: 18, // +4 bytes
  CLEAR_PAGE: 9, // +4 bytes
  UNDO: 11, // +4 bytes
  REDO: 11, // +4 bytes
  POINTER_MOVE: 17, // +4 bytes
  POINTER_ON: 7,
  POINTER_OFF: 1,
  HISTORY_START: 10,
  HISTORY_END: 5,
  VOICE_START: 6,
  WRAPPED_HEADER: 21,
} as const;

// Control channel event types (JSON)
export enum ControlEventType {
  SESSION_STATUS = 'SESSION_STATUS',
  PARTICIPANT_JOIN = 'PARTICIPANT_JOIN',
  PARTICIPANT_LEAVE = 'PARTICIPANT_LEAVE',
  PERMISSION_CHANGED = 'PERMISSION_CHANGED',
  HISTORY_SYNC_START = 'HISTORY_SYNC_START',
  HISTORY_SYNC_PROGRESS = 'HISTORY_SYNC_PROGRESS',
  HISTORY_SYNC_END = 'HISTORY_SYNC_END',
  SPOTLIGHT_SHARE = 'SPOTLIGHT_SHARE',
  ANNOTATION_STROKE = 'ANNOTATION_STROKE',
}

// Session status
export type SessionStatusValue = 'active' | 'paused' | 'closed';

// Participant leave reason
export type LeaveReason = 'disconnect' | 'kicked' | 'left';

// Role
export type ParticipantRoleValue = 'host' | 'guest';
