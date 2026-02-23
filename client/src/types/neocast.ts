// NeoCast 데모용 타입 정의
// source: neocast_copy-main/Client/Web/src/types/index.ts 에서 필요한 것만 추출

export const PenType = {
  Pen: 0,
  Highlighter: 1,
  Eraser: 2,
  Brush: 3,
} as const;
export type PenType = (typeof PenType)[keyof typeof PenType];

export const StrokeFlags = {
  None: 0,
  PressureSensitive: 1,
  TiltSensitive: 2,
} as const;
export type StrokeFlags = (typeof StrokeFlags)[keyof typeof StrokeFlags];

export const PaperSize = {
  A4: 'A4',
  Letter: 'Letter',
  B4: 'B4',
  A5: 'A5',
} as const;
export type PaperSize = (typeof PaperSize)[keyof typeof PaperSize];

export interface NcodePageAddress {
  section: number;
  owner: number;
  book: number;
  page: number;
}

// 마우스 페이지 상수
export const MOUSE_PAGE_SECTION = 1024;
export const MOUSE_PAGE_OWNER = 1;
export const MOUSE_PAGE_BOOK = 1;

// 내부 좌표계 (72 DPI points)
export const INTERNAL_DPI = 72;
export const MM_TO_PT = INTERNAL_DPI / 25.4;

// 데모용 가상 캔버스 크기 (pixels as "points")
// GuestCanvas는 800×520 기준으로 필기 → 그대로 point 좌표로 사용
const DEMO_CANVAS_W = 800;
const DEMO_CANVAS_H = 520;

/**
 * 용지 크기를 points로 반환
 * 데모에서는 가상 캔버스(800×520)를 항상 사용
 */
export function getPaperSizeInPoints(_paperSize: PaperSize): { widthPt: number; heightPt: number } {
  return { widthPt: DEMO_CANVAS_W, heightPt: DEMO_CANVAS_H };
}

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;  // 0~65535
  timestamp: number; // Unix ms
}

export interface Stroke {
  id: string;
  userId: string;
  ownerUserId: string;
  pageAddress: NcodePageAddress;
  color: number;       // ARGB int
  thickness: number;   // mm
  penType: PenType;
  flags: StrokeFlags;
  startTimestamp: number;
  points: StrokePoint[];
}

export function createMousePageAddress(page: number): NcodePageAddress {
  return { section: MOUSE_PAGE_SECTION, owner: MOUSE_PAGE_OWNER, book: MOUSE_PAGE_BOOK, page };
}

export function formatPageAddress(address: NcodePageAddress): string {
  return `${address.section}.${address.owner}.${address.book}.${address.page}`;
}

export function isSamePageAddress(a: NcodePageAddress, b: NcodePageAddress): boolean {
  return a.section === b.section && a.owner === b.owner && a.book === b.book && a.page === b.page;
}

export function isMousePage(address: NcodePageAddress): boolean {
  return address.section === MOUSE_PAGE_SECTION;
}
