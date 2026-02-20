/**
 * NPROJ Generator Service (Client-side)
 *
 * PDF 문서에 대한 네오 스마트펜 프로젝트 파일(nproj)을 생성합니다.
 * WebCaster nproj-classes와 호환되는 형식 (version 2.31)을 사용합니다.
 */

// ============================================
// Types
// ============================================

export interface NCodeInfo {
  section: number;
  owner: number;
  book: number;
  pageStart: number;
  pageEnd: number;
}

export interface PageSize {
  width: number;
  height: number;
}

// A4 크기 (포인트 단위, 72 points = 1 inch)
const DEFAULT_PAGE_SIZE: PageSize = {
  width: 595.28,
  height: 841.89,
};

// 단위 변환 상수
const PU_TO_NU = 0.148809523809524;
const NU_TO_PU = 1 / PU_TO_NU; // 6.72

// ============================================
// PDF Parsing Utilities
// ============================================

/**
 * PDF ArrayBuffer에서 페이지 수 조회
 * 외부 라이브러리 없이 간단한 파싱 사용
 */
export function getPdfPageCount(pdfBuffer: ArrayBuffer): number {
  const bytes = new Uint8Array(pdfBuffer);
  const pdfString = new TextDecoder('latin1').decode(bytes);

  // 방법 1: /Type /Page 항목 검색
  const pageMatches = pdfString.match(/\/Type\s*\/Page[^s]/g);
  if (pageMatches && pageMatches.length > 0) {
    console.log('[NprojGenerator] PDF page count from /Type /Page:', pageMatches.length);
    return pageMatches.length;
  }

  // 방법 2: Pages 객체의 /Count 검색
  const countMatch = pdfString.match(/\/Count\s+(\d+)/);
  if (countMatch) {
    const count = parseInt(countMatch[1], 10);
    console.log('[NprojGenerator] PDF page count from /Count:', count);
    return count;
  }

  // 판별 불가 시 기본값 1
  console.warn('[NprojGenerator] Could not determine PDF page count, defaulting to 1');
  return 1;
}

/**
 * PDF ArrayBuffer에서 페이지 크기 조회
 * 포인트 단위 크기 반환 (72 points = 1 inch)
 */
export function getPdfPageSize(pdfBuffer: ArrayBuffer): PageSize {
  const bytes = new Uint8Array(pdfBuffer);
  const pdfString = new TextDecoder('latin1').decode(bytes);

  // MediaBox [x1 y1 x2 y2] 검색
  const mediaBoxMatch = pdfString.match(
    /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/
  );
  if (mediaBoxMatch) {
    const width = parseFloat(mediaBoxMatch[3]) - parseFloat(mediaBoxMatch[1]);
    const height = parseFloat(mediaBoxMatch[4]) - parseFloat(mediaBoxMatch[2]);
    console.log('[NprojGenerator] PDF page size from MediaBox:', { width, height });
    return { width, height };
  }

  console.warn('[NprojGenerator] Could not determine PDF page size, using A4 default');
  return DEFAULT_PAGE_SIZE;
}

// ============================================
// XML Tag Generators (WebCaster compatible)
// ============================================

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
 * <preset> 태그 생성
 */
function generatePresetTag(): string {
  return `<preset>
<pattern>PDS3</pattern>
<margin left="0" top="0" right="0" bottom="0"/>
</preset>`;
}

/**
 * <book> 태그 생성
 */
function generateBookTag(
  ncodeInfo: NCodeInfo,
  title: string,
  pageCount: number
): string {
  const { section, owner, book, pageStart, pageEnd } = ncodeInfo;

  return `<book>
<title>${escapeXml(title)}</title>
<author>NeoCAST</author>
<section>${section}</section>
<owner>${owner}</owner>
<code>${book}</code>
<revision>1</revision>
<scale>0.001</scale>
<start_page side="">${pageStart}</start_page>
<dot_is_line_segment>false</dot_is_line_segment>
<line_segment_length>1</line_segment_length>
<target_dpi>600</target_dpi>
<dotsize>1</dotsize>
<segment_info sub_code="" total_size="${pageCount}" size="${pageCount}" current_sequence="0" ncode_start_page="${pageStart}" ncode_end_page="${pageEnd}"/>
<extra_info>
pdf_page_count=${pageCount}
</extra_info>
<kind>0</kind>
</book>`;
}

/**
 * <pdf> 태그 생성
 */
function generatePdfTag(title: string): string {
  return `<pdf>
<path>${escapeXml(title)}.pdf</path>
</pdf>`;
}

/**
 * <config> 태그 생성
 */
function generateConfigTag(): string {
  return `<config>
<resource_mapping_mode>NORMAL</resource_mapping_mode>
</config>`;
}

/**
 * <pages> 태그 생성 (page_item 속성 형식)
 */
function generatePagesTag(
  pageCount: number,
  pageSize: PageSize,
  rotation: number = 0
): string {
  const { width, height } = pageSize;
  let result = `<pages count="${pageCount}">\n`;

  for (let i = 0; i < pageCount; i++) {
    // NU 계산 (Ncode Unit)
    const nuXmax = width * PU_TO_NU;
    // Note: nuYmax = height * PU_TO_NU (available if needed for future calculations)

    // crop_margin: left, top, right, bottom (모두 0 for full page)
    const cropMarginL = 0;
    const cropMarginT = 0;
    const cropMarginR = 0;
    const cropMarginB = 0;

    const x1 = 0;
    const y1 = 0;
    const x2 = cropMarginL + width;
    const y2 = cropMarginT + height;

    // printed_scale: 1:1 (pu/nu)일 때 1
    const printedScale = NU_TO_PU / (width / nuXmax);

    // homography 초기값 (identity에 가까운 값)
    const homography = '0,0,0,0,0,0,0,0,1';

    result += `<page_item number="${i}" `
      + `printed_scale="${printedScale.toFixed(6)}" `
      + `homography="${homography}" `
      + `rotate_angle="${rotation}" `
      + `x1="${x1}" y1="${y1}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" `
      + `crop_margin="${cropMarginL},${cropMarginT},${cropMarginR},${cropMarginB}" `
      + `bg_disabled="false" `
      + `page_type="0" `
      + `/>\n`;
  }

  result += `</pages>`;
  return result;
}

/**
 * <action_table> 태그 생성
 */
function generateActionTableTag(): string {
  return `<action_table>
</action_table>`;
}

/**
 * <symbols> 태그 생성
 */
function generateSymbolsTag(): string {
  return `<symbols>
</symbols>`;
}

// ============================================
// NPROJ Generation
// ============================================

/**
 * NPROJ XML 내용 생성 (WebCaster v2.31 호환 형식)
 *
 * @param ncodeInfo NCode 정보 (section, owner, book, pageStart, pageEnd)
 * @param title 문서 제목
 * @param pageSize 페이지 크기 (포인트 단위)
 * @param rotation PDF 회전 각도 (0, 90, 180, 270)
 * @returns NPROJ XML 문자열
 */
export function generateNproj(
  ncodeInfo: NCodeInfo,
  title: string = 'Document',
  pageSize: PageSize = DEFAULT_PAGE_SIZE,
  rotation: number = 0
): string {
  const { pageStart, pageEnd } = ncodeInfo;
  const pageCount = pageEnd - pageStart + 1;

  const preset = generatePresetTag();
  const book = generateBookTag(ncodeInfo, title, pageCount);
  const pdf = generatePdfTag(title);
  const config = generateConfigTag();
  const pages = generatePagesTag(pageCount, pageSize, rotation);
  const actions = generateActionTableTag();
  const symbols = generateSymbolsTag();

  const result = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE nproj>
<nproj version="2.31" category="simple">
${preset}
${book}
${pdf}
${config}
${pages}
${actions}
${symbols}
<resources>
</resources>
</nproj>
`;

  console.log('[NprojGenerator] Generated NPROJ (WebCaster v2.31 format):', {
    section: ncodeInfo.section,
    owner: ncodeInfo.owner,
    book: ncodeInfo.book,
    pageStart,
    pageEnd,
    pageCount,
    width: pageSize.width,
    height: pageSize.height,
    rotation,
  });

  return result;
}

/**
 * NCode 정보와 PDF ArrayBuffer를 사용하여 NPROJ 생성
 *
 * @param ncodeInfo NCode 정보
 * @param title 문서 제목
 * @param pdfBuffer PDF 파일의 ArrayBuffer (선택적, 페이지 크기 추출용)
 * @param rotation PDF 회전 각도
 * @returns NPROJ XML 문자열
 */
export function generateNprojFromPdf(
  ncodeInfo: NCodeInfo,
  title: string = 'Document',
  pdfBuffer?: ArrayBuffer,
  rotation: number = 0
): string {
  let pageSize = DEFAULT_PAGE_SIZE;

  if (pdfBuffer) {
    pageSize = getPdfPageSize(pdfBuffer);
  }

  return generateNproj(ncodeInfo, title, pageSize, rotation);
}

// ============================================
// Convenience Functions
// ============================================

/**
 * PDF 파일에서 페이지 수와 크기를 추출하여 NPROJ에 필요한 정보 반환
 */
export async function analyzePdfFile(
  pdfFile: File
): Promise<{ pageCount: number; pageSize: PageSize }> {
  const buffer = await pdfFile.arrayBuffer();
  return {
    pageCount: getPdfPageCount(buffer),
    pageSize: getPdfPageSize(buffer),
  };
}
