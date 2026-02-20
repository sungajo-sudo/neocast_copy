import { prisma } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { BinaryWriter } from '../protocol/binary-writer.js';
import {
  ClientMessage,
  StrokeStartMessage,
  StrokePointMessage,
  StrokePointBatchMessage,
  StrokeEndMessage,
  PageAddMessage,
  PageDeleteMessage,
  buildHistoryStartMessage,
  buildHistoryStrokeMessage,
  buildHistoryEndMessage,
  buildHistoryPageMessage,
} from '../protocol/messages.js';
import { PenType, PageType, NcodePageAddress, formatPageAddress } from '../protocol/types.js';
import { AuthenticatedSocket } from '../socket/middleware/auth.js';
import zlib from 'zlib';
import { promisify } from 'util';

const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

// 메모리에 저장되는 활성 스트로크 구조 (세션 ID -> 스트로크 ID -> 데이터)
interface ActiveStroke {
  sessionId: string;
  userId: string;
  ownerUserId: string; // 누구의 캔버스에 그려지는지
  strokeId: string;
  pageAddress: NcodePageAddress; // Ncode 페이지 주소 (section.owner.book.page)
  color: number;
  thickness: number;
  penType: PenType;
  flags: number;
  timestamp: bigint;
  points: Array<{
    x: number;
    y: number;
    pressure: number;
    timestamp: bigint;
  }>;
}

const activeStrokes = new Map<string, Map<string, ActiveStroke>>();

function getSessionStrokes(sessionId: string): Map<string, ActiveStroke> {
  let strokes = activeStrokes.get(sessionId);
  if (!strokes) {
    strokes = new Map();
    activeStrokes.set(sessionId, strokes);
  }
  return strokes;
}

/**
 * 스트로크 관련 클라이언트 메시지 처리
 * @param sessionId 세션 ID
 * @param userId 사용자 ID
 * @param message 메시지 객체
 * @param _rawData 원본 바이너리 데이터 (사용 안 함)
 */
export async function processStrokeMessage(
  sessionId: string,
  userId: string,
  message: ClientMessage,
  _rawData: Buffer
): Promise<void> {
  switch (message.type) {
    case 'STROKE_START':
      await handleStrokeStart(sessionId, userId, message);
      break;

    case 'STROKE_POINT':
      await handleStrokePoint(sessionId, message);
      break;

    case 'STROKE_POINT_BATCH':
      await handleStrokePointBatch(sessionId, message);
      break;

    case 'STROKE_END':
      await handleStrokeEnd(sessionId, message);
      break;

    case 'STROKE_CANCEL':
      handleStrokeCancel(sessionId, message.strokeId);
      break;

    case 'PAGE_ADD':
      await handlePageAdd(sessionId, userId, message);
      break;

    case 'PAGE_DELETE':
      await handlePageDelete(sessionId, userId, message);
      break;

    case 'CLEAR_PAGE':
      await handleClearPage(sessionId, message.pageAddress);
      break;

    case 'CLEAR_ALL':
      await handleClearAll(sessionId);
      break;

    case 'UNDO':
    case 'REDO':
      // Undo/Redo 처리는 복잡한 상태 관리가 필요하여 현재 미구현
      logger.debug({ sessionId, type: message.type }, 'Undo/Redo received (not yet implemented)');
      break;

    default:
      // 페이지 변경, 포인터 이동 등은 DB 처리 없이 통과
      break;
  }
}

async function handleStrokeStart(sessionId: string, userId: string, message: StrokeStartMessage): Promise<void> {
  const strokes = getSessionStrokes(sessionId);

  const stroke: ActiveStroke = {
    sessionId,
    userId,
    ownerUserId: message.ownerUserId, // 누구의 캔버스에 그려지는지
    strokeId: message.strokeId,
    pageAddress: message.pageAddress,
    color: message.color,
    thickness: message.thickness,
    penType: message.penType,
    flags: message.flags,
    timestamp: message.timestamp,
    points: [],
  };

  strokes.set(message.strokeId, stroke);

  logger.debug(
    { sessionId, strokeId: message.strokeId, pageAddress: formatPageAddress(message.pageAddress), ownerUserId: message.ownerUserId },
    'Stroke started'
  );
}

async function handleStrokePoint(sessionId: string, message: StrokePointMessage): Promise<void> {
  const strokes = getSessionStrokes(sessionId);
  const stroke = strokes.get(message.strokeId);

  if (!stroke) {
    logger.warn({ sessionId, strokeId: message.strokeId }, 'Stroke point for unknown stroke');
    return;
  }

  stroke.points.push({
    x: message.x,
    y: message.y,
    pressure: message.pressure,
    timestamp: message.timestamp,
  });
}

async function handleStrokePointBatch(sessionId: string, message: StrokePointBatchMessage): Promise<void> {
  const strokes = getSessionStrokes(sessionId);
  const stroke = strokes.get(message.strokeId);

  if (!stroke) {
    logger.warn({ sessionId, strokeId: message.strokeId }, 'Stroke batch for unknown stroke');
    return;
  }

  stroke.points.push(...message.points);
}

async function handleStrokeEnd(sessionId: string, message: StrokeEndMessage): Promise<void> {
  const strokes = getSessionStrokes(sessionId);
  const stroke = strokes.get(message.strokeId);

  if (!stroke) {
    logger.warn({ sessionId, strokeId: message.strokeId }, 'Stroke end for unknown stroke');
    return;
  }

  // 데이터 압축 및 데이터베이스 저장
  try {
    const compressedPoints = await compressPoints(stroke.points);

    await prisma.stroke.create({
      data: {
        id: stroke.strokeId,
        sessionId: stroke.sessionId,
        userId: stroke.userId,
        ownerUserId: stroke.ownerUserId,
        section: stroke.pageAddress.section,
        owner: stroke.pageAddress.owner,
        book: stroke.pageAddress.book,
        page: stroke.pageAddress.page,
        color: BigInt(stroke.color >>> 0), // 부호 없는 32비트 정수로 변환 후 BigInt로 저장
        thickness: stroke.thickness,
        penType: stroke.penType,
        flags: stroke.flags,
        timestamp: stroke.timestamp,
        points: compressedPoints,
      },
    });

    logger.debug(
      { sessionId, strokeId: stroke.strokeId, pointCount: stroke.points.length, pageAddress: formatPageAddress(stroke.pageAddress), ownerUserId: stroke.ownerUserId },
      'Stroke saved to database'
    );
  } catch (error) {
    logger.error({ sessionId, strokeId: stroke.strokeId, error }, 'Failed to save stroke');
  }

  // 활성 스트로크 목록에서 제거
  strokes.delete(message.strokeId);
}

function handleStrokeCancel(sessionId: string, strokeId: string): void {
  const strokes = getSessionStrokes(sessionId);
  strokes.delete(strokeId);
  logger.debug({ sessionId, strokeId }, 'Stroke cancelled');
}

async function handlePageAdd(sessionId: string, userId: string, message: PageAddMessage): Promise<void> {
  // ownerUserId: 페이지 소유자 (호스트가 게스트 캔버스에 페이지 추가 시 게스트 ID)
  // userId: 메시지 보낸 사람 (호스트)
  const { ownerUserId, pageAddress, width, height, pageType } = message;

  try {
    // upsert로 중복 방지 (이미 존재하는 페이지면 업데이트)
    await prisma.page.upsert({
      where: {
        sessionId_ownerUserId_section_owner_book_page: {
          sessionId,
          ownerUserId: ownerUserId,
          section: pageAddress.section,
          owner: pageAddress.owner,
          book: pageAddress.book,
          page: pageAddress.page,
        },
      },
      update: {
        width,
        height,
        pageType,
      },
      create: {
        sessionId,
        ownerUserId: ownerUserId,
        section: pageAddress.section,
        owner: pageAddress.owner,
        book: pageAddress.book,
        page: pageAddress.page,
        width,
        height,
        pageType,
      },
    });

    logger.info(
      { sessionId, senderId: userId, ownerUserId, pageAddress: formatPageAddress(pageAddress), width, height, pageType },
      'Page added to database'
    );
  } catch (error) {
    logger.error({ sessionId, senderId: userId, ownerUserId, pageAddress: formatPageAddress(pageAddress), error }, 'Failed to add page');
  }
}

async function handlePageDelete(sessionId: string, userId: string, message: PageDeleteMessage): Promise<void> {
  const { pageAddress } = message;

  try {
    // 페이지 삭제
    await prisma.page.deleteMany({
      where: {
        sessionId,
        ownerUserId: userId,
        section: pageAddress.section,
        owner: pageAddress.owner,
        book: pageAddress.book,
        page: pageAddress.page,
      },
    });

    // 해당 페이지의 스트로크도 삭제
    await prisma.stroke.deleteMany({
      where: {
        sessionId,
        ownerUserId: userId,
        section: pageAddress.section,
        owner: pageAddress.owner,
        book: pageAddress.book,
        page: pageAddress.page,
      },
    });

    logger.info(
      { sessionId, userId, pageAddress: formatPageAddress(pageAddress) },
      'Page and strokes deleted from database'
    );
  } catch (error) {
    logger.error({ sessionId, userId, pageAddress: formatPageAddress(pageAddress), error }, 'Failed to delete page');
  }
}

async function handleClearPage(sessionId: string, pageAddress: NcodePageAddress): Promise<void> {
  await prisma.stroke.deleteMany({
    where: {
      sessionId,
      section: pageAddress.section,
      owner: pageAddress.owner,
      book: pageAddress.book,
      page: pageAddress.page,
    },
  });
  logger.info({ sessionId, pageAddress: formatPageAddress(pageAddress) }, 'Page cleared');
}

async function handleClearAll(sessionId: string): Promise<void> {
  await prisma.stroke.deleteMany({
    where: { sessionId },
  });
  activeStrokes.delete(sessionId);
  logger.info({ sessionId }, 'All strokes cleared');
}

// 스트로크 포인트 압축 (BinaryWriter 사용 후 Deflate)
async function compressPoints(
  points: Array<{ x: number; y: number; pressure: number; timestamp: bigint }>
): Promise<Buffer> {
  const writer = new BinaryWriter();

  writer.writeUint16(points.length);

  for (const point of points) {
    writer.writeFloat32(point.x);
    writer.writeFloat32(point.y);
    writer.writeUint16(point.pressure);
    writer.writeInt64(point.timestamp);
  }

  const buffer = writer.toBuffer();
  return await deflate(buffer);
}

// 스트로크 포인트 압축 해제 (분석/내보내기용)
export async function decompressPoints(
  data: Buffer
): Promise<Array<{ x: number; y: number; pressure: number; timestamp: bigint }>> {
  const decompressed = await inflate(data);
  const view = new DataView(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);

  const count = view.getUint16(0, true);
  const points: Array<{ x: number; y: number; pressure: number; timestamp: bigint }> = [];

  let offset = 2;
  for (let i = 0; i < count; i++) {
    points.push({
      x: view.getFloat32(offset, true),
      y: view.getFloat32(offset + 4, true),
      pressure: view.getUint16(offset + 8, true),
      timestamp: view.getBigInt64(offset + 10, true),
    });
    offset += 18;
  }

  return points;
}

// 소켓으로 히스토리 데이터 전송 (재접속 또는 늦게 들어온 사용자용)
export async function sendHistoryToSocket(
  socket: AuthenticatedSocket,
  sessionId: string,
  sourceUserIds: string[]
): Promise<void> {
  logger.info(
    { socketId: socket.id, sessionId, sourceUserIds },
    'Starting history sync - looking for pages and strokes from users'
  );

  if (sourceUserIds.length === 0) {
    logger.info({ socketId: socket.id, sessionId }, 'No source users - skipping history');
    return;
  }

  // DB에서 페이지 목록 조회
  const pages = await prisma.page.findMany({
    where: {
      sessionId,
      ownerUserId: { in: sourceUserIds },
    },
    orderBy: { createdAt: 'asc' },
  });

  // DB에서 스트로크 목록 조회
  const strokes = await prisma.stroke.findMany({
    where: {
      sessionId,
      userId: { in: sourceUserIds },
    },
    orderBy: { createdAt: 'asc' },
  });

  logger.info(
    { socketId: socket.id, sessionId, pageCount: pages.length, strokeCount: strokes.length },
    'Found pages and strokes in database'
  );

  if (pages.length === 0 && strokes.length === 0) {
    logger.info({ socketId: socket.id, sessionId }, 'No pages or strokes found - skipping history');
    return;
  }

  // 히스토리 전송 시작 알림
  const startMsg = buildHistoryStartMessage(strokes.length, pages.length, false);
  logger.info(
    { socketId: socket.id, sessionId, totalStrokes: strokes.length, totalPages: pages.length },
    'Sending HISTORY_START'
  );
  socket.emit('history', startMsg);

  // 페이지 정보 먼저 전송
  for (const page of pages) {
    const pageAddress: NcodePageAddress = {
      section: page.section,
      owner: page.owner,
      book: page.book,
      page: page.page,
    };

    const pageMsg = buildHistoryPageMessage(
      page.ownerUserId,
      pageAddress,
      page.width,
      page.height,
      page.pageType as PageType
    );

    logger.debug(
      {
        socketId: socket.id,
        ownerUserId: page.ownerUserId,
        pageAddress: formatPageAddress(pageAddress),
      },
      'Sending HISTORY_PAGE'
    );

    socket.emit('history', pageMsg);
  }

  // 스트로크 정보 전송
  let sentCount = 0;
  for (const stroke of strokes) {
    const pageAddress: NcodePageAddress = {
      section: stroke.section,
      owner: stroke.owner,
      book: stroke.book,
      page: stroke.page,
    };

    const strokeMsg = buildHistoryStrokeMessage(
      stroke.id,
      stroke.userId,
      stroke.ownerUserId,
      pageAddress,
      Number(stroke.color), // BigInt를 다시 number로 변환
      stroke.thickness,
      stroke.penType as PenType,
      stroke.points as Buffer
    );

    logger.debug(
      {
        socketId: socket.id,
        strokeId: stroke.id,
        userId: stroke.userId,
        ownerUserId: stroke.ownerUserId,
        pageAddress: formatPageAddress(pageAddress),
        pointsLength: (stroke.points as Buffer).length,
      },
      'Sending HISTORY_STROKE'
    );

    socket.emit('history', strokeMsg);
    sentCount++;

    // 이벤트 루프 차단을 막기 위해 주기적으로 양보 (SetImmediate)
    if (sentCount % 50 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  // 히스토리 전송 종료 알림
  const endMsg = buildHistoryEndMessage(sentCount);
  logger.info({ socketId: socket.id, sessionId, sentCount }, 'Sending HISTORY_END');
  socket.emit('history', endMsg);

  logger.info(
    { socketId: socket.id, sessionId, pageCount: pages.length, strokeCount: sentCount },
    'History sync completed'
  );
}

// 세션의 총 스트로크 수 조회
export async function getStrokeCount(sessionId: string): Promise<number> {
  return prisma.stroke.count({ where: { sessionId } });
}

// 세션의 순(Unique) 페이지 수 조회
export async function getPageCount(sessionId: string): Promise<number> {
  const result = await prisma.stroke.groupBy({
    by: ['section', 'owner', 'book', 'page'],
    where: { sessionId },
  });
  return result.length;
}

// 세션 종료 시 메모리의 스트로크 데이터 정리
export function clearSessionFromMemory(sessionId: string): void {
  activeStrokes.delete(sessionId);
}
