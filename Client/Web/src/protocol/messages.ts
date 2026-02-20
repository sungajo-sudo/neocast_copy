import { BinaryReader } from './binary-reader';
import { BinaryWriter } from './binary-writer';
import { MessageType, PenType, StrokeFlags, PageType, packPageAddress, unpackPageAddress } from '../types';
import type { StrokePoint, Stroke, NcodePageAddress } from '../types';
import pako from 'pako';

// ============================================
// 송신 메시지 (클라이언트 → 서버)
// ============================================

/**
 * STROKE_START 메시지 생성 (59 bytes)
 * - ownerUserId: 누구의 캔버스에 그려지는지 (호스트가 게스트 페이지에 그릴 때 사용)
 * - pageAddress: Ncode 페이지 주소 (section.owner.book.page)
 */
export function createStrokeStart(
  strokeId: string,
  ownerUserId: string,
  pageAddress: NcodePageAddress,
  color: number,
  thickness: number,
  penType: PenType,
  flags: StrokeFlags,
  timestamp: number
): ArrayBuffer {
  const writer = new BinaryWriter();
  writer.writeByte(MessageType.StrokeStart);
  writer.writeUuid(strokeId);
  writer.writeUuid(ownerUserId);
  writer.writeUint64(packPageAddress(pageAddress));
  writer.writeUint32(color);
  writer.writeFloat32(thickness);
  writer.writeByte(penType);
  writer.writeByte(flags);
  writer.writeInt64(timestamp);
  return writer.toArrayBuffer();
}

/**
 * STROKE_POINT 메시지 생성 (35 bytes)
 */
export function createStrokePoint(
  strokeId: string,
  x: number,
  y: number,
  pressure: number,
  timestamp: number
): ArrayBuffer {
  const writer = new BinaryWriter();
  writer.writeByte(MessageType.StrokePoint);
  writer.writeUuid(strokeId);
  writer.writeFloat32(x);
  writer.writeFloat32(y);
  writer.writeUint16(pressure);
  writer.writeInt64(timestamp);
  return writer.toArrayBuffer();
}

/**
 * STROKE_POINT_BATCH 메시지 생성
 */
export function createStrokePointBatch(
  strokeId: string,
  points: StrokePoint[]
): ArrayBuffer {
  const writer = new BinaryWriter();
  writer.writeByte(MessageType.StrokePointBatch);
  writer.writeUuid(strokeId);
  writer.writeUint16(points.length);
  for (const point of points) {
    writer.writeFloat32(point.x);
    writer.writeFloat32(point.y);
    writer.writeUint16(point.pressure);
    writer.writeInt64(point.timestamp);
  }
  return writer.toArrayBuffer();
}

/**
 * STROKE_END 메시지 생성 (17 bytes)
 */
export function createStrokeEnd(strokeId: string): ArrayBuffer {
  const writer = new BinaryWriter();
  writer.writeByte(MessageType.StrokeEnd);
  writer.writeUuid(strokeId);
  return writer.toArrayBuffer();
}

/**
 * STROKE_CANCEL 메시지 생성 (17 bytes)
 */
export function createStrokeCancel(strokeId: string): ArrayBuffer {
  const writer = new BinaryWriter();
  writer.writeByte(MessageType.StrokeCancel);
  writer.writeUuid(strokeId);
  return writer.toArrayBuffer();
}

/**
 * PAGE_CHANGE 메시지 생성 (9 bytes)
 * - 마우스 페이지 번호로 변경하려면 createMousePageAddress(pageNumber)를 사용
 */
export function createPageChange(pageAddress: NcodePageAddress): ArrayBuffer {
  const writer = new BinaryWriter();
  writer.writeByte(MessageType.PageChange);
  writer.writeUint64(packPageAddress(pageAddress));
  return writer.toArrayBuffer();
}

/**
 * PAGE_ADD 메시지 생성 (34 bytes)
 * - 새 페이지 추가를 다른 참가자들에게 알림
 * - ownerUserId: 페이지 소유자 (호스트가 게스트 캔버스에 페이지 추가 시 사용)
 */
export function createPageAdd(
  ownerUserId: string,
  pageAddress: NcodePageAddress,
  width: number,
  height: number,
  pageType: PageType = PageType.Blank
): ArrayBuffer {
  const writer = new BinaryWriter();
  writer.writeByte(MessageType.PageAdd);
  writer.writeUuid(ownerUserId);
  writer.writeUint64(packPageAddress(pageAddress));
  writer.writeFloat32(width);
  writer.writeFloat32(height);
  writer.writeByte(pageType);
  return writer.toArrayBuffer();
}

/**
 * PAGE_DELETE 메시지 생성 (9 bytes)
 * - 페이지 삭제를 다른 참가자들에게 알림
 */
export function createPageDelete(pageAddress: NcodePageAddress): ArrayBuffer {
  const writer = new BinaryWriter();
  writer.writeByte(MessageType.PageDelete);
  writer.writeUint64(packPageAddress(pageAddress));
  return writer.toArrayBuffer();
}


/**
 * CLEAR_PAGE 메시지 생성 (9 bytes)
 */
export function createClearPage(pageAddress: NcodePageAddress): ArrayBuffer {
  const writer = new BinaryWriter();
  writer.writeByte(MessageType.ClearPage);
  writer.writeUint64(packPageAddress(pageAddress));
  return writer.toArrayBuffer();
}


/**
 * UNDO 메시지 생성 (11 bytes)
 */
export function createUndo(pageAddress: NcodePageAddress, count: number): ArrayBuffer {
  const writer = new BinaryWriter();
  writer.writeByte(MessageType.Undo);
  writer.writeUint64(packPageAddress(pageAddress));
  writer.writeUint16(count);
  return writer.toArrayBuffer();
}


/**
 * REDO 메시지 생성 (11 bytes)
 */
export function createRedo(pageAddress: NcodePageAddress, count: number): ArrayBuffer {
  const writer = new BinaryWriter();
  writer.writeByte(MessageType.Redo);
  writer.writeUint64(packPageAddress(pageAddress));
  writer.writeUint16(count);
  return writer.toArrayBuffer();
}


// ============================================
// 수신 메시지 파싱 (서버 → 클라이언트)
// ============================================

export interface ParsedStrokeStart {
  type: 'STROKE_START';
  strokeId: string;
  ownerUserId: string;
  pageAddress: NcodePageAddress;
  color: number;
  thickness: number;
  penType: PenType;
  flags: StrokeFlags;
  timestamp: number;
}

export interface ParsedStrokePoint {
  type: 'STROKE_POINT';
  strokeId: string;
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

export interface ParsedStrokePointBatch {
  type: 'STROKE_POINT_BATCH';
  strokeId: string;
  points: Array<{
    x: number;
    y: number;
    pressure: number;
    timestamp: number;
  }>;
}

export interface ParsedStrokeEnd {
  type: 'STROKE_END';
  strokeId: string;
}

export interface ParsedStrokeCancel {
  type: 'STROKE_CANCEL';
  strokeId: string;
}

export interface ParsedWrapped {
  type: 'WRAPPED';
  senderId: string;
  payload: ParsedMessage;
}

export interface ParsedHistoryStart {
  type: 'HISTORY_START';
  totalStrokes: number;
  totalPages: number;
  fromArchive: boolean;
}

export interface ParsedHistoryStroke {
  type: 'HISTORY_STROKE';
  stroke: Stroke;
}

export interface ParsedHistoryEnd {
  type: 'HISTORY_END';
  syncedStrokes: number;
}

export interface ParsedHistoryPage {
  type: 'HISTORY_PAGE';
  ownerUserId: string;
  pageAddress: NcodePageAddress;
  width: number;
  height: number;
  pageType: PageType;
}

export interface ParsedError {
  type: 'ERROR';
  errorCode: number;
  message: string;
}

export interface ParsedPageAdd {
  type: 'PAGE_ADD';
  ownerUserId: string;
  pageAddress: NcodePageAddress;
  width: number;
  height: number;
  pageType: PageType;
}

export interface ParsedPageDelete {
  type: 'PAGE_DELETE';
  pageAddress: NcodePageAddress;
}

export interface ParsedPageChange {
  type: 'PAGE_CHANGE';
  pageAddress: NcodePageAddress;
}

export type ParsedMessage =
  | ParsedStrokeStart
  | ParsedStrokePoint
  | ParsedStrokePointBatch
  | ParsedStrokeEnd
  | ParsedStrokeCancel
  | ParsedWrapped
  | ParsedHistoryStart
  | ParsedHistoryStroke
  | ParsedHistoryEnd
  | ParsedHistoryPage
  | ParsedError
  | ParsedPageAdd
  | ParsedPageDelete
  | ParsedPageChange;

/**
 * 바이너리 메시지 파싱
 */
export function parseMessage(data: ArrayBuffer | Uint8Array): ParsedMessage | null {
  const reader = new BinaryReader(data);
  const type = reader.readByte() as MessageType;

  switch (type) {
    case MessageType.StrokeStart:
      return parseStrokeStart(reader);

    case MessageType.StrokePoint:
      return parseStrokePoint(reader);

    case MessageType.StrokePointBatch:
      return parseStrokePointBatch(reader);

    case MessageType.StrokeEnd:
      return parseStrokeEnd(reader);

    case MessageType.StrokeCancel:
      return parseStrokeCancel(reader);

    case MessageType.Wrapped:
      return parseWrapped(reader);

    case MessageType.HistoryStart:
      return parseHistoryStart(reader);

    case MessageType.HistoryStroke:
      return parseHistoryStroke(reader);

    case MessageType.HistoryEnd:
      return parseHistoryEnd(reader);

    case MessageType.HistoryPage:
      return parseHistoryPage(reader);

    case MessageType.Error:
      return parseError(reader);

    case MessageType.PageChange:
      return parsePageChange(reader);

    case MessageType.PageAdd:
      return parsePageAdd(reader);

    case MessageType.PageDelete:
      return parsePageDelete(reader);

    default:
      console.warn(`Unknown message type: 0x${type.toString(16)}`);
      return null;
  }
}

function parseStrokeStart(reader: BinaryReader): ParsedStrokeStart {
  const strokeId = reader.readUuid();
  const ownerUserId = reader.readUuid();
  const pageAddress = unpackPageAddress(reader.readUint64());
  return {
    type: 'STROKE_START',
    strokeId,
    ownerUserId,
    pageAddress,
    color: reader.readUint32(),
    thickness: reader.readFloat32(),
    penType: reader.readByte() as PenType,
    flags: reader.readByte() as StrokeFlags,
    timestamp: reader.readInt64AsNumber(),
  };
}

function parseStrokePoint(reader: BinaryReader): ParsedStrokePoint {
  return {
    type: 'STROKE_POINT',
    strokeId: reader.readUuid(),
    x: reader.readFloat32(),
    y: reader.readFloat32(),
    pressure: reader.readUint16(),
    timestamp: reader.readInt64AsNumber(),
  };
}

function parseStrokeEnd(reader: BinaryReader): ParsedStrokeEnd {
  return {
    type: 'STROKE_END',
    strokeId: reader.readUuid(),
  };
}

function parseStrokeCancel(reader: BinaryReader): ParsedStrokeCancel {
  return {
    type: 'STROKE_CANCEL',
    strokeId: reader.readUuid(),
  };
}

function parseStrokePointBatch(reader: BinaryReader): ParsedStrokePointBatch {
  const strokeId = reader.readUuid();
  const count = reader.readUint16();
  const points: Array<{ x: number; y: number; pressure: number; timestamp: number }> = [];

  for (let i = 0; i < count; i++) {
    points.push({
      x: reader.readFloat32(),
      y: reader.readFloat32(),
      pressure: reader.readUint16(),
      timestamp: reader.readInt64AsNumber(),
    });
  }

  return {
    type: 'STROKE_POINT_BATCH',
    strokeId,
    points,
  };
}

function parseWrapped(reader: BinaryReader): ParsedWrapped | null {
  const senderId = reader.readUuid();
  const payloadLength = reader.readUint32();
  const payloadBytes = reader.readBytes(payloadLength);
  const payload = parseMessage(payloadBytes);

  if (!payload) {
    console.warn('Failed to parse wrapped payload');
    return null;
  }

  return {
    type: 'WRAPPED',
    senderId,
    payload,
  };
}

function parseHistoryStart(reader: BinaryReader): ParsedHistoryStart {
  return {
    type: 'HISTORY_START',
    totalStrokes: reader.readUint32(),
    totalPages: reader.readUint32(),
    fromArchive: reader.readByte() !== 0,
  };
}

function parseHistoryStroke(reader: BinaryReader): ParsedHistoryStroke {
  const strokeId = reader.readUuid();
  const userId = reader.readUuid();
  const ownerUserId = reader.readUuid(); // 캔버스 소유자
  const pageAddress = unpackPageAddress(reader.readUint64());
  const color = reader.readUint32();
  const thickness = reader.readFloat32();
  const penType = reader.readByte() as PenType;
  const compressedLength = reader.readUint32();
  const compressedData = reader.readBytes(compressedLength);

  // 압축 해제 및 포인트 디코딩
  const points = decodeCompressedPoints(compressedData);

  return {
    type: 'HISTORY_STROKE',
    stroke: {
      id: strokeId,
      userId,
      ownerUserId,
      pageAddress,
      color,
      thickness,
      penType,
      flags: StrokeFlags.None,
      startTimestamp: 0,
      points,
    },
  };
}

function parseHistoryEnd(reader: BinaryReader): ParsedHistoryEnd {
  return {
    type: 'HISTORY_END',
    syncedStrokes: reader.readUint32(),
  };
}

function parseHistoryPage(reader: BinaryReader): ParsedHistoryPage {
  return {
    type: 'HISTORY_PAGE',
    ownerUserId: reader.readUuid(),
    pageAddress: unpackPageAddress(reader.readUint64()),
    width: reader.readFloat32(),
    height: reader.readFloat32(),
    pageType: reader.readByte() as PageType,
  };
}

function parseError(reader: BinaryReader): ParsedError {
  const errorCode = reader.readUint16();
  const message = reader.readString();
  return {
    type: 'ERROR',
    errorCode,
    message,
  };
}

function parsePageAdd(reader: BinaryReader): ParsedPageAdd {
  return {
    type: 'PAGE_ADD',
    ownerUserId: reader.readUuid(),
    pageAddress: unpackPageAddress(reader.readUint64()),
    width: reader.readFloat32(),
    height: reader.readFloat32(),
    pageType: reader.readByte() as PageType,
  };
}

function parsePageDelete(reader: BinaryReader): ParsedPageDelete {
  return {
    type: 'PAGE_DELETE',
    pageAddress: unpackPageAddress(reader.readUint64()),
  };
}

function parsePageChange(reader: BinaryReader): ParsedPageChange {
  return {
    type: 'PAGE_CHANGE',
    pageAddress: unpackPageAddress(reader.readUint64()),
  };
}

/**
 * 압축된 포인트 데이터 디코딩
 * 서버에서 zlib.deflate로 압축된 데이터를 pako.inflate로 해제
 *
 * 서버 포인트 형식 (per point, 18 bytes):
 * - Float32: x
 * - Float32: y
 * - Uint16: pressure
 * - Int64: timestamp
 */
function decodeCompressedPoints(compressedData: Uint8Array): StrokePoint[] {
  try {
    // zlib 압축 해제
    const decompressed = pako.inflate(compressedData);
    const view = new DataView(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);

    // 포인트 개수 읽기 (Uint16, little-endian)
    const count = view.getUint16(0, true);
    const points: StrokePoint[] = [];

    // 각 포인트 읽기 (18 bytes per point)
    let offset = 2;
    for (let i = 0; i < count; i++) {
      const x = view.getFloat32(offset, true);
      const y = view.getFloat32(offset + 4, true);
      const pressure = view.getUint16(offset + 8, true);
      const timestamp = Number(view.getBigInt64(offset + 10, true));

      points.push({ x, y, pressure, timestamp });
      offset += 18;
    }

    return points;
  } catch (error) {
    console.error('Failed to decode compressed points:', error);
    return [];
  }
}
