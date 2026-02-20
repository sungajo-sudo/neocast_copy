/**
 * Stroke Socket Worker
 *
 * Socket.IO /stroke 네임스페이스 연결을 Web Worker에서 실행하여
 * 바이너리 메시지 파싱(parseMessage) 및 pako 압축해제를 메인 스레드에서 분리한다.
 *
 * 송신: Main Thread → postMessage(binary) → Worker → socket.emit('stroke', binary)
 * 수신: socket.on('stroke') → Worker(parseMessage) → postMessage(parsed) → Main Thread
 */

import { io, Socket } from 'socket.io-client';
import { BinaryReader } from '../protocol/binary-reader';
import { MessageType, PenType, StrokeFlags, PageType, unpackPageAddress } from '../types';
import type { StrokePoint } from '../types';
import pako from 'pako';

let socket: Socket | null = null;

/**
 * Worker 메시지 핸들러
 */
self.onmessage = (event: MessageEvent) => {
  const msg = event.data;

  switch (msg.type) {
    case 'connect':
      handleConnect(msg.url, msg.auth, msg.query);
      break;

    case 'disconnect':
      handleDisconnect();
      break;

    case 'emit':
      // 메인 스레드에서 보내는 stroke 바이너리 데이터
      if (socket?.connected) {
        socket.emit('stroke', msg.data);
      }
      break;
  }
};

/**
 * Socket.IO 연결
 */
function handleConnect(url: string, auth: Record<string, unknown>, query: Record<string, unknown>): void {
  if (socket) {
    socket.disconnect();
  }

  socket = io(`${url}/stroke`, {
    auth,
    query,
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    postMsg({ type: 'connected' });
  });

  socket.on('disconnect', (reason: string) => {
    postMsg({ type: 'disconnected', reason });
  });

  socket.on('connect_error', (error: Error) => {
    postMsg({ type: 'connect_error', message: error.message });
  });

  // stroke 바이너리 수신 → Worker에서 파싱 → 구조화된 데이터를 메인 스레드로 전달
  socket.on('stroke', (data: ArrayBuffer) => {
    try {
      const parsed = parseMessage(data);
      if (parsed) {
        postMsg({ type: 'stroke', parsed });
      }
    } catch (error) {
      console.error('[StrokeWorker] Parse error:', error);
    }
  });

  // history 바이너리 수신 → 동일하게 Worker에서 파싱
  socket.on('history', (data: ArrayBuffer) => {
    try {
      const parsed = parseMessage(data);
      if (parsed) {
        postMsg({ type: 'stroke', parsed });
      }
    } catch (error) {
      console.error('[StrokeWorker] History parse error:', error);
    }
  });

  socket.on('error', (error: { code: number; message: string }) => {
    postMsg({ type: 'socket-error', error });
  });
}

/**
 * Socket.IO 연결 해제
 */
function handleDisconnect(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// ============================================
// Binary Message Parsing (메인 스레드에서 이관)
// ============================================

interface ParsedBase {
  msgType: string;
}

function parseMessage(data: ArrayBuffer | Uint8Array): ParsedBase | null {
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
      console.warn(`[StrokeWorker] Unknown message type: 0x${type.toString(16)}`);
      return null;
  }
}

function parseStrokeStart(reader: BinaryReader) {
  const strokeId = reader.readUuid();
  const ownerUserId = reader.readUuid();
  const pageAddress = unpackPageAddress(reader.readUint64());
  return {
    msgType: 'STROKE_START',
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

function parseStrokePoint(reader: BinaryReader) {
  return {
    msgType: 'STROKE_POINT',
    strokeId: reader.readUuid(),
    x: reader.readFloat32(),
    y: reader.readFloat32(),
    pressure: reader.readUint16(),
    timestamp: reader.readInt64AsNumber(),
  };
}

function parseStrokePointBatch(reader: BinaryReader) {
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
  return { msgType: 'STROKE_POINT_BATCH', strokeId, points };
}

function parseStrokeEnd(reader: BinaryReader) {
  return { msgType: 'STROKE_END', strokeId: reader.readUuid() };
}

function parseStrokeCancel(reader: BinaryReader) {
  return { msgType: 'STROKE_CANCEL', strokeId: reader.readUuid() };
}

function parseWrapped(reader: BinaryReader) {
  const senderId = reader.readUuid();
  const payloadLength = reader.readUint32();
  const payloadBytes = reader.readBytes(payloadLength);
  const payload = parseMessage(payloadBytes);
  if (!payload) return null;
  return { msgType: 'WRAPPED', senderId, payload };
}

function parseHistoryStart(reader: BinaryReader) {
  return {
    msgType: 'HISTORY_START',
    totalStrokes: reader.readUint32(),
    totalPages: reader.readUint32(),
    fromArchive: reader.readByte() !== 0,
  };
}

function parseHistoryStroke(reader: BinaryReader) {
  const strokeId = reader.readUuid();
  const userId = reader.readUuid();
  const ownerUserId = reader.readUuid();
  const pageAddress = unpackPageAddress(reader.readUint64());
  const color = reader.readUint32();
  const thickness = reader.readFloat32();
  const penType = reader.readByte() as PenType;
  const compressedLength = reader.readUint32();
  const compressedData = reader.readBytes(compressedLength);
  const points = decodeCompressedPoints(compressedData);

  return {
    msgType: 'HISTORY_STROKE',
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

function parseHistoryEnd(reader: BinaryReader) {
  return { msgType: 'HISTORY_END', syncedStrokes: reader.readUint32() };
}

function parseHistoryPage(reader: BinaryReader) {
  return {
    msgType: 'HISTORY_PAGE',
    ownerUserId: reader.readUuid(),
    pageAddress: unpackPageAddress(reader.readUint64()),
    width: reader.readFloat32(),
    height: reader.readFloat32(),
    pageType: reader.readByte() as PageType,
  };
}

function parseError(reader: BinaryReader) {
  return {
    msgType: 'ERROR',
    errorCode: reader.readUint16(),
    message: reader.readString(),
  };
}

function parsePageAdd(reader: BinaryReader) {
  return {
    msgType: 'PAGE_ADD',
    ownerUserId: reader.readUuid(),
    pageAddress: unpackPageAddress(reader.readUint64()),
    width: reader.readFloat32(),
    height: reader.readFloat32(),
    pageType: reader.readByte() as PageType,
  };
}

function parsePageDelete(reader: BinaryReader) {
  return {
    msgType: 'PAGE_DELETE',
    pageAddress: unpackPageAddress(reader.readUint64()),
  };
}

function parsePageChange(reader: BinaryReader) {
  return {
    msgType: 'PAGE_CHANGE',
    pageAddress: unpackPageAddress(reader.readUint64()),
  };
}

/**
 * 압축된 포인트 데이터 디코딩 (pako.inflate — Worker에서 실행)
 */
function decodeCompressedPoints(compressedData: Uint8Array): StrokePoint[] {
  try {
    const decompressed = pako.inflate(compressedData);
    const view = new DataView(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);
    const count = view.getUint16(0, true);
    const points: StrokePoint[] = [];

    let offset = 2;
    for (let i = 0; i < count; i++) {
      points.push({
        x: view.getFloat32(offset, true),
        y: view.getFloat32(offset + 4, true),
        pressure: view.getUint16(offset + 8, true),
        timestamp: Number(view.getBigInt64(offset + 10, true)),
      });
      offset += 18;
    }
    return points;
  } catch (error) {
    console.error('[StrokeWorker] Failed to decode compressed points:', error);
    return [];
  }
}

/**
 * 메인 스레드로 메시지 전송 헬퍼
 */
function postMsg(data: Record<string, unknown>): void {
  (self as unknown as { postMessage: (msg: unknown) => void }).postMessage(data);
}

// TypeScript를 위한 export
export {};
