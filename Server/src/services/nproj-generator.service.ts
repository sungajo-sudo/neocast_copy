/**
 * NPROJ 생성 서비스
 * PDF 문서에 대한 네오 스마트펜 프로젝트 파일(nproj)을 생성합니다.
 */

import { logger } from '../utils/logger.js';

interface NCodeInfo {
  section: number;
  owner: number;
  bookCode: number;
  pageStart: number;
  pageEnd: number;
}

interface PageSize {
  width: number;
  height: number;
}

// A4 크기 (포인트 단위, 72 points = 1 inch)
const DEFAULT_PAGE_SIZE: PageSize = {
  width: 595.28,
  height: 841.89,
};

/**
 * PDF 바이너리에서 페이지 수 조회
 * 외부 라이브러리 없이 간단한 파싱 사용
 */
export function getPdfPageCount(pdfBuffer: Buffer): number {
  const pdfString = pdfBuffer.toString('binary');

  // 방법 1: /Type /Page 항목 검색
  const pageMatches = pdfString.match(/\/Type\s*\/Page[^s]/g);
  if (pageMatches && pageMatches.length > 0) {
    logger.debug({ count: pageMatches.length }, 'PDF page count from /Type /Page');
    return pageMatches.length;
  }

  // 방법 2: Pages 객체의 /Count 검색
  const countMatch = pdfString.match(/\/Count\s+(\d+)/);
  if (countMatch) {
    const count = parseInt(countMatch[1], 10);
    logger.debug({ count }, 'PDF page count from /Count');
    return count;
  }

  // 판별 불가 시 기본값 1
  logger.warn('Could not determine PDF page count, defaulting to 1');
  return 1;
}

/**
 * PDF 바이너리에서 페이지 크기 조회
 * 포인트 단위 크기 반환 (72 points = 1 inch)
 * pageIndex 파라미터는 현재 사용되지 않음 (첫 페이지 MediaBox 기준)
 */
export function getPdfPageSize(pdfBuffer: Buffer): PageSize {
  const pdfString = pdfBuffer.toString('binary');

  // MediaBox [x1 y1 x2 y2] 검색
  const mediaBoxMatch = pdfString.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
  if (mediaBoxMatch) {
    const width = parseFloat(mediaBoxMatch[3]) - parseFloat(mediaBoxMatch[1]);
    const height = parseFloat(mediaBoxMatch[4]) - parseFloat(mediaBoxMatch[2]);
    logger.debug({ width, height }, 'PDF page size from MediaBox');
    return { width, height };
  }

  logger.warn('Could not determine PDF page size, using A4 default');
  return DEFAULT_PAGE_SIZE;
}

/**
 * XML 특수 문자 이스케이프 처리
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * NPROJ XML 내용 생성
 */
export function generateNproj(
  ncodeInfo: NCodeInfo,
  title: string = 'Document',
  pageSize: PageSize = DEFAULT_PAGE_SIZE
): string {
  const { section, owner, bookCode, pageStart, pageEnd } = ncodeInfo;
  const { width, height } = pageSize;

  const lines: string[] = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<nproj version="2.4">',
    `  <title>${escapeXml(title)}</title>`,
    '  <version>1</version>',
    `  <section>${section}</section>`,
    `  <owner>${owner}</owner>`,
    `  <book>${bookCode}</book>`,
    `  <start_page>${pageStart}</start_page>`,
    `  <end_page>${pageEnd}</end_page>`,
    `  <width>${width.toFixed(2)}</width>`,
    `  <height>${height.toFixed(2)}</height>`,
    '  <segment type="Paper">',
    '    <x1>0</x1>',
    '    <y1>0</y1>',
    `    <x2>${width.toFixed(2)}</x2>`,
    `    <y2>${height.toFixed(2)}</y2>`,
    '    <crop_margin_left>0</crop_margin_left>',
    '    <crop_margin_top>0</crop_margin_top>',
    '    <crop_margin_right>0</crop_margin_right>',
    '    <crop_margin_bottom>0</crop_margin_bottom>',
    '  </segment>',
    '  <pages>',
  ];

  // 페이지 항목 추가
  for (let pageNum = pageStart; pageNum <= pageEnd; pageNum++) {
    lines.push(`    <page number="${pageNum}">`);
    lines.push('      <x1>0</x1>');
    lines.push('      <y1>0</y1>');
    lines.push(`      <x2>${width.toFixed(2)}</x2>`);
    lines.push(`      <y2>${height.toFixed(2)}</y2>`);
    lines.push('    </page>');
  }

  lines.push('  </pages>');
  lines.push('</nproj>');

  const nprojContent = lines.join('\n');

  logger.info(
    { section, owner, bookCode, pageStart, pageEnd, width, height },
    'Generated NPROJ'
  );

  return nprojContent;
}

/**
 * NCode 정보와 선택적 PDF 버퍼를 사용하여 NPROJ 생성
 */
export function generateNprojFromPdf(
  ncodeInfo: NCodeInfo,
  title: string = 'Document',
  pdfBuffer?: Buffer
): string {
  let pageSize = DEFAULT_PAGE_SIZE;

  if (pdfBuffer) {
    pageSize = getPdfPageSize(pdfBuffer);
  }

  return generateNproj(ncodeInfo, title, pageSize);
}
