// 메시지 타입 코드
export const MessageType = {
  // 스트로크
  StrokeStart: 0x01,
  StrokePoint: 0x02,
  StrokeEnd: 0x03,
  StrokeCancel: 0x04,
  StrokePointBatch: 0x05,

  // 페이지
  PageChange: 0x10,
  PageAdd: 0x11,
  PageDelete: 0x12,

  // 편집
  ClearPage: 0x20,
  ClearAll: 0x21,
  Undo: 0x22,
  Redo: 0x23,

  // 포인터
  PointerMove: 0x30,
  PointerOn: 0x31,
  PointerOff: 0x32,

  // 음성
  VoiceData: 0x80,
  VoiceStart: 0x81,
  VoiceEnd: 0x82,
  VoiceMute: 0x83,
  VoiceUnmute: 0x84,

  // 서버 메시지
  Wrapped: 0xf0,
  HistoryStart: 0xf1,
  HistoryStroke: 0xf2,
  HistoryEnd: 0xf3,
  HistoryPage: 0xf4,

  // 에러
  Error: 0xe0,
  Ack: 0xe1,
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

// 펜 타입
export const PenType = {
  Pen: 0,
  Highlighter: 1,
  Eraser: 2,
  Brush: 3,
} as const;

export type PenType = (typeof PenType)[keyof typeof PenType];

// 스트로크 플래그
export const StrokeFlags = {
  None: 0,
  PressureSensitive: 1,
  TiltSensitive: 2,
} as const;

export type StrokeFlags = (typeof StrokeFlags)[keyof typeof StrokeFlags];

// 페이지 타입
export const PageType = {
  Blank: 0,
  Lined: 1,
  Grid: 2,
  Dot: 3,
} as const;

export type PageType = (typeof PageType)[keyof typeof PageType];

// Ncode 페이지 주소 (section.owner.book.page 형식)
export interface NcodePageAddress {
  section: number; // 0-4095 (12 bits)
  owner: number; // 0-65535 (16 bits)
  book: number; // 0-4095 (12 bits)
  page: number; // 0-4095 (12 bits)
}

// 마우스 입력용 페이지 상수
export const MOUSE_PAGE_SECTION = 1024;
export const MOUSE_PAGE_OWNER = 1;
export const MOUSE_PAGE_BOOK = 1;

// ============================================
// 좌표 변환 상수 (Ncode Coordinate System)
// ============================================
// 내부 좌표계는 72 DPI point 좌표계를 사용
// 모든 입력(Ncode, Mouse)은 72 DPI point로 변환되어 저장됨

// Ncode unit → mm 변환 상수
// 1 Ncode unit = 2.37066667 mm (= 56/600 inch)
export const NCODE_TO_MM = 2.37066667;

// ============================================
// 용지 크기 정의
// ============================================

// 용지 크기 타입
export const PaperSize = {
  A4: 'A4',
  Letter: 'Letter',
  B4: 'B4',
  A5: 'A5',
} as const;

export type PaperSize = (typeof PaperSize)[keyof typeof PaperSize];

// 용지 크기 정보 (mm 단위)
export interface PaperSizeInfo {
  name: string;
  widthMm: number;
  heightMm: number;
}

export const PAPER_SIZES: Record<PaperSize, PaperSizeInfo> = {
  [PaperSize.A4]: { name: 'A4', widthMm: 210, heightMm: 297 },
  [PaperSize.Letter]: { name: 'Letter', widthMm: 215.9, heightMm: 279.4 },
  [PaperSize.B4]: { name: 'B4', widthMm: 250, heightMm: 353 },
  [PaperSize.A5]: { name: 'A5', widthMm: 148, heightMm: 210 },
};

// A4 용지 크기 (mm) - 기본값
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

// 내부 좌표계 DPI (PDF 표준)
export const INTERNAL_DPI = 72;

// A4 용지 크기 (72 DPI points) - 기본값
// A4: 210mm × (72/25.4) ≈ 595.28 points
//     297mm × (72/25.4) ≈ 841.89 points
export const A4_WIDTH_PT = A4_WIDTH_MM * (INTERNAL_DPI / 25.4);
export const A4_HEIGHT_PT = A4_HEIGHT_MM * (INTERNAL_DPI / 25.4);

/**
 * 용지 크기를 72 DPI point로 변환
 */
export function getPaperSizeInPoints(paperSize: PaperSize): { widthPt: number; heightPt: number } {
  const info = PAPER_SIZES[paperSize];
  return {
    widthPt: info.widthMm * (INTERNAL_DPI / 25.4),
    heightPt: info.heightMm * (INTERNAL_DPI / 25.4),
  };
}

// mm → 72 DPI point 변환 상수
export const MM_TO_PT = INTERNAL_DPI / 25.4;

// 72 DPI point → mm 변환 상수
export const PT_TO_MM = 25.4 / INTERNAL_DPI;

// Ncode → 72 DPI point 변환 상수
// 1 Ncode unit = 2.37066667 mm = 2.37066667 × (72/25.4) points
export const NCODE_TO_PT = NCODE_TO_MM * MM_TO_PT;

/**
 * Ncode 좌표를 72 DPI point로 변환 (내부 좌표계)
 */
export function ncodeToPoint(ncodeValue: number): number {
  return ncodeValue * NCODE_TO_PT;
}

/**
 * 72 DPI point를 Ncode 좌표로 변환
 */
export function pointToNcode(ptValue: number): number {
  return ptValue / NCODE_TO_PT;
}

/**
 * mm를 72 DPI point로 변환
 */
export function mmToPoint(mmValue: number): number {
  return mmValue * MM_TO_PT;
}

/**
 * 72 DPI point를 mm로 변환
 */
export function pointToMm(ptValue: number): number {
  return ptValue * PT_TO_MM;
}

/**
 * 화면 pixel(특정 DPI)을 72 DPI point로 변환
 * @param pxValue 화면 픽셀 값
 * @param screenDpi 화면 DPI (기본값: 96)
 */
export function screenPxToPoint(pxValue: number, screenDpi: number = 96): number {
  const mm = pxValue * (25.4 / screenDpi);
  return mm * MM_TO_PT;
}

/**
 * 72 DPI point를 화면 pixel로 변환
 * @param ptValue 72 DPI point 값
 * @param screenDpi 화면 DPI (기본값: 96)
 */
export function pointToScreenPx(ptValue: number, screenDpi: number = 96): number {
  const mm = ptValue * PT_TO_MM;
  return mm * (screenDpi / 25.4);
}

// Legacy aliases (deprecated, mm 기반 - 호환성 유지용)
export const ncodeToMm = (ncodeValue: number): number => ncodeValue * NCODE_TO_MM;
export const mmToNcode = (mmValue: number): number => mmValue / NCODE_TO_MM;

// 마우스 페이지 주소 생성 헬퍼
export function createMousePageAddress(page: number): NcodePageAddress {
  return {
    section: MOUSE_PAGE_SECTION,
    owner: MOUSE_PAGE_OWNER,
    book: MOUSE_PAGE_BOOK,
    page,
  };
}

// 페이지 주소 문자열 포맷
export function formatPageAddress(address: NcodePageAddress): string {
  return `${address.section}.${address.owner}.${address.book}.${address.page}`;
}

// 페이지 주소 동등성 비교
export function isSamePageAddress(a: NcodePageAddress, b: NcodePageAddress): boolean {
  return a.section === b.section && a.owner === b.owner && a.book === b.book && a.page === b.page;
}

// 마우스 페이지인지 확인
export function isMousePage(address: NcodePageAddress): boolean {
  return address.section === MOUSE_PAGE_SECTION;
}

// 페이지 주소를 64비트 BigInt로 패킹
export function packPageAddress(address: NcodePageAddress): bigint {
  const section = BigInt(address.section & 0xfff);
  const owner = BigInt(address.owner & 0xffff);
  const book = BigInt(address.book & 0xfff);
  const page = BigInt(address.page & 0xfff);
  return page | (book << 12n) | (owner << 24n) | (section << 40n);
}

// 64비트 BigInt에서 페이지 주소 언패킹
export function unpackPageAddress(packed: bigint): NcodePageAddress {
  return {
    page: Number(packed & 0xfffn),
    book: Number((packed >> 12n) & 0xfffn),
    owner: Number((packed >> 24n) & 0xffffn),
    section: Number((packed >> 40n) & 0xfffn),
  };
}

// 스트로크 포인트
export interface StrokePoint {
  x: number; // mm
  y: number; // mm
  pressure: number; // 0~65535
  timestamp: number; // Unix ms
}

// 스트로크
export interface Stroke {
  id: string;
  userId: string; // 누가 그렸는지 (drawer)
  ownerUserId: string; // 누구의 캔버스/페이지인지 (canvas owner)
  pageAddress: NcodePageAddress; // Ncode 페이지 주소 (section.owner.book.page)
  color: number; // ARGB
  thickness: number; // mm
  penType: PenType;
  flags: StrokeFlags;
  startTimestamp: number;
  points: StrokePoint[];
}

// 참가자 역할
export const ParticipantRole = {
  Host: 'host',
  Guest: 'guest',
} as const;

export type ParticipantRole = (typeof ParticipantRole)[keyof typeof ParticipantRole];

// 참가자
export interface Participant {
  userId: string;
  userName: string;
  role: ParticipantRole;
  joinedAt: number;
  isMuted: boolean;
  isSpeaking: boolean;
  isOnline?: boolean; // 연결 상태 (기본값: true, HOST_DISCONNECTED 시 false)
}

// 세션 상태
export const SessionStatus = {
  Active: 'active',
  Paused: 'paused',
  Closed: 'closed',
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

// 세션
export interface Session {
  id: string;
  code: string;
  title?: string; // 세션 이름 (호스트가 생성 시 입력)
  status: SessionStatus;
  hostId: string;
  participants: Participant[];
  createdAt: number;
  hasPassword?: boolean; // Whether session requires password
  inviteToken?: string | null; // Password-free join token for invite links (hosts only)
}

// 연결 상태
export const ConnectionState = {
  Disconnected: 'disconnected',
  Connecting: 'connecting',
  Connected: 'connected',
  Reconnecting: 'reconnecting',
} as const;

export type ConnectionState = (typeof ConnectionState)[keyof typeof ConnectionState];

// 에러 코드
export const ErrorCode = {
  SessionNotFound: 1001,
  SessionClosed: 1002,
  SessionFull: 1003,
  PermissionDenied: 2001,
  NotHost: 2002,
  InvalidPacket: 3001,
  InvalidStrokeId: 3002,
  RateLimited: 4001,
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// Control 채널 메시지 타입
export type ControlMessageType =
  | 'SESSION_STATUS'
  | 'PARTICIPANT_JOIN'
  | 'PARTICIPANT_LEAVE'
  | 'PERMISSION_CHANGED'
  | 'HISTORY_SYNC_START'
  | 'HISTORY_SYNC_PROGRESS'
  | 'HISTORY_SYNC_END';

// Control 메시지
export interface ControlMessage {
  type: ControlMessageType;
  timestamp: number;
  [key: string]: unknown;
}

// 사용자 색상 매핑
export interface UserColorMap {
  [userId: string]: string;
}

// 인증 관련 타입 re-export
export * from './auth';
