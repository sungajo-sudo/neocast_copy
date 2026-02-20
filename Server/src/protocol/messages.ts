import { BinaryReader } from './binary-reader.js';
import { BinaryWriter } from './binary-writer.js';
import {
  ClientMessageType,
  ServerMessageType,
  PenType,
  PointerType,
  PageType,
  ProtocolErrorCode,
  NcodePageAddress,
  unpackPageAddress,
  packPageAddress,
} from './types.js';

// Parsed message types
export interface StrokeStartMessage {
  type: 'STROKE_START';
  strokeId: string;
  ownerUserId: string; // 누구의 캔버스에 그려지는지 (호스트가 게스트 페이지에 그릴 때 사용)
  pageAddress: NcodePageAddress; // Ncode page address (section.owner.book.page)
  color: number;
  thickness: number;
  penType: PenType;
  flags: number;
  timestamp: bigint;
}

export interface StrokePointMessage {
  type: 'STROKE_POINT';
  strokeId: string;
  x: number;
  y: number;
  pressure: number;
  timestamp: bigint;
}

export interface StrokePointBatchMessage {
  type: 'STROKE_POINT_BATCH';
  strokeId: string;
  points: Array<{
    x: number;
    y: number;
    pressure: number;
    timestamp: bigint;
  }>;
}

export interface StrokeEndMessage {
  type: 'STROKE_END';
  strokeId: string;
}

export interface StrokeCancelMessage {
  type: 'STROKE_CANCEL';
  strokeId: string;
}

export interface PageChangeMessage {
  type: 'PAGE_CHANGE';
  pageAddress: NcodePageAddress;
}

export interface PageAddMessage {
  type: 'PAGE_ADD';
  ownerUserId: string;
  pageAddress: NcodePageAddress;
  width: number;
  height: number;
  pageType: PageType;
}

export interface PageDeleteMessage {
  type: 'PAGE_DELETE';
  pageAddress: NcodePageAddress;
}

export interface ClearPageMessage {
  type: 'CLEAR_PAGE';
  pageAddress: NcodePageAddress;
}

export interface ClearAllMessage {
  type: 'CLEAR_ALL';
}

export interface UndoMessage {
  type: 'UNDO';
  pageAddress: NcodePageAddress;
  count: number;
}

export interface RedoMessage {
  type: 'REDO';
  pageAddress: NcodePageAddress;
  count: number;
}

export interface PointerMoveMessage {
  type: 'POINTER_MOVE';
  pageAddress: NcodePageAddress;
  x: number;
  y: number;
}

export interface PointerOnMessage {
  type: 'POINTER_ON';
  pointerType: PointerType;
  color: number;
}

export interface PointerOffMessage {
  type: 'POINTER_OFF';
}

export type ClientMessage =
  | StrokeStartMessage
  | StrokePointMessage
  | StrokePointBatchMessage
  | StrokeEndMessage
  | StrokeCancelMessage
  | PageChangeMessage
  | PageAddMessage
  | PageDeleteMessage
  | ClearPageMessage
  | ClearAllMessage
  | UndoMessage
  | RedoMessage
  | PointerMoveMessage
  | PointerOnMessage
  | PointerOffMessage;

// Server messages
export interface WrappedMessage {
  type: 'WRAPPED';
  senderId: string;
  payload: Buffer;
}

export interface HistoryStartMessage {
  type: 'HISTORY_START';
  totalStrokes: number;
  totalPages: number;
  fromArchive: boolean;
}

export interface HistoryStrokeMessage {
  type: 'HISTORY_STROKE';
  strokeId: string;
  userId: string;
  ownerUserId: string;
  pageAddress: NcodePageAddress;
  color: number;
  thickness: number;
  penType: PenType;
  compressedPoints: Buffer;
}

export interface HistoryEndMessage {
  type: 'HISTORY_END';
  syncedStrokes: number;
}

export interface ErrorMessage {
  type: 'ERROR';
  code: ProtocolErrorCode;
  message: string;
}

export interface AckMessage {
  type: 'ACK';
  sequenceId: number;
}

export type ServerMessage =
  | WrappedMessage
  | HistoryStartMessage
  | HistoryStrokeMessage
  | HistoryEndMessage
  | ErrorMessage
  | AckMessage;

// Parse client message
export function parseClientMessage(data: Buffer | ArrayBuffer | Uint8Array): ClientMessage {
  const reader = new BinaryReader(data);
  const type = reader.readUint8();

  switch (type) {
    case ClientMessageType.STROKE_START:
      return {
        type: 'STROKE_START',
        strokeId: reader.readUUID(),
        ownerUserId: reader.readUUID(),
        pageAddress: unpackPageAddress(reader.readUint64()),
        color: reader.readUint32(),
        thickness: reader.readFloat32(),
        penType: reader.readUint8() as PenType,
        flags: reader.readUint8(),
        timestamp: reader.readInt64(),
      };

    case ClientMessageType.STROKE_POINT:
      return {
        type: 'STROKE_POINT',
        strokeId: reader.readUUID(),
        x: reader.readFloat32(),
        y: reader.readFloat32(),
        pressure: reader.readUint16(),
        timestamp: reader.readInt64(),
      };

    case ClientMessageType.STROKE_POINT_BATCH: {
      const strokeId = reader.readUUID();
      const pointCount = reader.readUint16();
      const points = [];
      for (let i = 0; i < pointCount; i++) {
        points.push({
          x: reader.readFloat32(),
          y: reader.readFloat32(),
          pressure: reader.readUint16(),
          timestamp: reader.readInt64(),
        });
      }
      return { type: 'STROKE_POINT_BATCH', strokeId, points };
    }

    case ClientMessageType.STROKE_END:
      return { type: 'STROKE_END', strokeId: reader.readUUID() };

    case ClientMessageType.STROKE_CANCEL:
      return { type: 'STROKE_CANCEL', strokeId: reader.readUUID() };

    case ClientMessageType.PAGE_CHANGE:
      return { type: 'PAGE_CHANGE', pageAddress: unpackPageAddress(reader.readUint64()) };

    case ClientMessageType.PAGE_ADD:
      return {
        type: 'PAGE_ADD',
        ownerUserId: reader.readUUID(),
        pageAddress: unpackPageAddress(reader.readUint64()),
        width: reader.readFloat32(),
        height: reader.readFloat32(),
        pageType: reader.readUint8() as PageType,
      };

    case ClientMessageType.PAGE_DELETE:
      return { type: 'PAGE_DELETE', pageAddress: unpackPageAddress(reader.readUint64()) };

    case ClientMessageType.CLEAR_PAGE:
      return { type: 'CLEAR_PAGE', pageAddress: unpackPageAddress(reader.readUint64()) };

    case ClientMessageType.CLEAR_ALL:
      return { type: 'CLEAR_ALL' };

    case ClientMessageType.UNDO:
      return {
        type: 'UNDO',
        pageAddress: unpackPageAddress(reader.readUint64()),
        count: reader.readUint16(),
      };

    case ClientMessageType.REDO:
      return {
        type: 'REDO',
        pageAddress: unpackPageAddress(reader.readUint64()),
        count: reader.readUint16(),
      };

    case ClientMessageType.POINTER_MOVE:
      return {
        type: 'POINTER_MOVE',
        pageAddress: unpackPageAddress(reader.readUint64()),
        x: reader.readFloat32(),
        y: reader.readFloat32(),
      };

    case ClientMessageType.POINTER_ON:
      return {
        type: 'POINTER_ON',
        pointerType: reader.readUint8() as PointerType,
        color: reader.readUint32(),
      };

    case ClientMessageType.POINTER_OFF:
      return { type: 'POINTER_OFF' };

    default:
      throw new Error(`Unknown message type: 0x${type.toString(16)}`);
  }
}

// Build server messages
export function buildWrappedMessage(senderId: string, payload: Buffer): Buffer {
  const writer = new BinaryWriter();
  writer.writeUint8(ServerMessageType.WRAPPED);
  writer.writeUUID(senderId);
  writer.writeUint32(payload.length);
  writer.writeBytes(payload);
  return writer.toBuffer();
}

export function buildHistoryStartMessage(totalStrokes: number, totalPages: number, fromArchive: boolean): Buffer {
  const writer = new BinaryWriter();
  writer.writeUint8(ServerMessageType.HISTORY_START);
  writer.writeUint32(totalStrokes);
  writer.writeUint32(totalPages);
  writer.writeUint8(fromArchive ? 1 : 0);
  return writer.toBuffer();
}

export function buildHistoryStrokeMessage(
  strokeId: string,
  userId: string,
  ownerUserId: string,
  pageAddress: NcodePageAddress,
  color: number,
  thickness: number,
  penType: PenType,
  compressedPoints: Buffer
): Buffer {
  const writer = new BinaryWriter();
  writer.writeUint8(ServerMessageType.HISTORY_STROKE);
  writer.writeUUID(strokeId);
  writer.writeUUID(userId);
  writer.writeUUID(ownerUserId);
  writer.writeUint64(packPageAddress(pageAddress));
  writer.writeUint32(color);
  writer.writeFloat32(thickness);
  writer.writeUint8(penType);
  writer.writeUint32(compressedPoints.length);
  writer.writeBytes(compressedPoints);
  return writer.toBuffer();
}

export function buildHistoryEndMessage(syncedStrokes: number): Buffer {
  const writer = new BinaryWriter();
  writer.writeUint8(ServerMessageType.HISTORY_END);
  writer.writeUint32(syncedStrokes);
  return writer.toBuffer();
}

export function buildHistoryPageMessage(
  ownerUserId: string,
  pageAddress: NcodePageAddress,
  width: number,
  height: number,
  pageType: PageType
): Buffer {
  const writer = new BinaryWriter();
  writer.writeUint8(ServerMessageType.HISTORY_PAGE);
  writer.writeUUID(ownerUserId);
  writer.writeUint64(packPageAddress(pageAddress));
  writer.writeFloat32(width);
  writer.writeFloat32(height);
  writer.writeUint8(pageType);
  return writer.toBuffer();
}

export function buildErrorMessage(code: ProtocolErrorCode, message: string): Buffer {
  const writer = new BinaryWriter();
  writer.writeUint8(ServerMessageType.ERROR);
  writer.writeUint16(code);
  writer.writeString(message);
  return writer.toBuffer();
}

export function buildAckMessage(sequenceId: number): Buffer {
  const writer = new BinaryWriter();
  writer.writeUint8(ServerMessageType.ACK);
  writer.writeUint32(sequenceId);
  return writer.toBuffer();
}
