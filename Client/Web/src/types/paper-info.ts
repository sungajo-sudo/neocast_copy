/**
 * Paper Info 관련 타입 정의
 * - PaperHub API 응답 타입
 * - NPROJ 파싱 결과 타입
 * - 캐시 관련 타입
 */

import type { NcodePageAddress } from './index';

// ============================================
// API 응답 타입
// ============================================

/**
 * paper-info API 응답 타입
 */
export interface PaperInfoResponse {
  paperGroupId: string;
  title: string;
  start: {
    section: number;
    owner: number;
    book: number;
    page: number;
  };
  end: {
    section: number;
    owner: number;
    book: number;
    page: number;
  };
  pageCount: number;
  pdfUrl: string | null;
  nprojUrl: string | null; // nproj 다운로드 URL (클라이언트에서 직접 다운로드)
}

// ============================================
// 캐시 키 타입
// ============================================

/**
 * Section.Owner.Book 키 (북 단위 캐싱용)
 */
export type SOBKey = `${number}.${number}.${number}`;

/**
 * Section.Owner.Book.PageStart - Section.Owner.Book.PageEnd 키 (범위 표현용)
 */
export type SOBPRangeKey = `${number}.${number}.${number}.${number}-${number}.${number}.${number}.${number}`;

// ============================================
// NPROJ 파싱 결과 타입 (neostudio2에서 포팅)
// ============================================

/**
 * SOBP 타입 (Section, Owner, Book, Page)
 */
export interface IPageSOBP {
  section: number;
  owner: number;
  book: number;
  page: number;
}

/**
 * NPROJ 페이지 정보
 */
export interface NprojPageJson {
  sobp: IPageSOBP;
  crop_margin: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  size_pu: {
    width: number;
    height: number;
  };
  nu: {
    Xmin: number;
    Ymin: number;
    Xmax: number;
    Ymax: number;
  };
  whole: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

/**
 * PUI 심볼 타입
 */
export interface PuiSymbolType {
  sobp: IPageSOBP;
  command: string;
  type: 'Rectangle' | 'Ellipse' | 'Polygon' | 'Custom';
  rect_nu?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  ellipse_nu?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  custom_nu?: {
    left: number;
    top: number;
    width: number;
    height: number;
    lock: boolean;
  };
  polygon?: { x: number; y: number }[];
  extra?: string;
}

/**
 * NPROJ 파싱 결과 JSON
 */
export interface NprojJson {
  book: {
    title: string;
    author: string;
    section: number;
    owner: number;
    book: number;
    start_page: number;
    extra_info: Record<string, string>;
    kind?: number; // 0: normal, 2: Moleskine
    offset?: { left: number; top: number }; // Moleskine only
  };
  pdf: {
    filename: string;
    numPages: number;
  };
  pages: NprojPageJson[];
  symbols: PuiSymbolType[];
  resources: Record<string, string>;
}

// ============================================
// 캐시 관련 타입
// ============================================

/**
 * 캐시된 PaperInfo
 */
export interface CachedPaperInfo {
  sobKey: SOBKey;
  paperGroupId: string;
  title: string;
  startPage: number;
  endPage: number;
  nprojJson: NprojJson;
  pdfBlob: Blob;
  cachedAt: number;
}

/**
 * IndexedDB에 저장되는 PaperInfo (pdfBlob 제외)
 */
export interface StoredPaperInfo {
  sobKey: SOBKey;
  paperGroupId: string;
  title: string;
  startPage: number;
  endPage: number;
  nprojJson: NprojJson;
  cachedAt: number;
}

/**
 * IndexedDB에 저장되는 PDF Blob
 */
export interface StoredPdfBlob {
  sobKey: SOBKey;
  pdfBlob: Blob;
  cachedAt: number;
}

// ============================================
// 다운로드 큐 관련 타입
// ============================================

/**
 * 다운로드 상태
 */
export type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'failed';

/**
 * 다운로드 큐 아이템
 */
export interface DownloadQueueItem {
  sobKey: SOBKey;
  address: NcodePageAddress;
  priority: number;
  requestedAt: number;
  status: DownloadStatus;
}

// ============================================
// PDF 렌더링 관련 타입
// ============================================

/**
 * PDF 렌더링 상태
 */
export type RenderStatus = 'queued' | 'rendering' | 'completed' | 'cancelled';

/**
 * PDF 렌더링 요청
 */
export interface PdfRenderRequest {
  id: string;
  sobKey: SOBKey;
  pageIndex: number; // PDF 내 페이지 인덱스 (0-based)
  scale: number;
  priority: number;
  status: RenderStatus;
  requestedAt: number;
}

/**
 * PDF 렌더링 결과
 */
export interface PdfRenderResult {
  requestId: string;
  sobKey: SOBKey;
  pageIndex: number;
  imageBitmap: ImageBitmap | null;
  width: number;
  height: number;
  error?: string;
}

// ============================================
// Worker 메시지 타입
// ============================================

/**
 * Main → Worker 메시지
 */
export type PdfWorkerCommand =
  | { type: 'INIT'; pdfData: ArrayBuffer; sobKey: SOBKey }
  | { type: 'RENDER'; requestId: string; pageIndex: number; scale: number }
  | { type: 'CANCEL'; requestId: string }
  | { type: 'DISPOSE' };

/**
 * Worker → Main 메시지
 */
export type PdfWorkerResponse =
  | { type: 'READY'; sobKey: SOBKey; pageCount: number }
  | { type: 'RENDERED'; requestId: string; imageBitmap: ImageBitmap; width: number; height: number }
  | { type: 'CANCELLED'; requestId: string }
  | { type: 'ERROR'; requestId?: string; error: string }
  | { type: 'DISPOSED' };

// ============================================
// 유틸리티 함수
// ============================================

/**
 * S.O.B 키 생성 (북 단위 캐싱)
 */
export function createSOBKey(section: number, owner: number, book: number): SOBKey {
  return `${section}.${owner}.${book}`;
}

/**
 * NcodePageAddress에서 SOB 키 추출
 */
export function getSOBKeyFromAddress(address: NcodePageAddress): SOBKey {
  return `${address.section}.${address.owner}.${address.book}`;
}

/**
 * S.O.B.P 범위 키 생성
 */
export function createSOBPRangeKey(
  start: IPageSOBP,
  end: IPageSOBP
): SOBPRangeKey {
  return `${start.section}.${start.owner}.${start.book}.${start.page}-${end.section}.${end.owner}.${end.book}.${end.page}`;
}

/**
 * 페이지가 캐시된 범위 내에 있는지 확인
 */
export function isPageInCachedRange(
  address: NcodePageAddress,
  cachedInfo: CachedPaperInfo
): boolean {
  const sobKey = getSOBKeyFromAddress(address);
  if (sobKey !== cachedInfo.sobKey) return false;
  return address.page >= cachedInfo.startPage && address.page <= cachedInfo.endPage;
}
