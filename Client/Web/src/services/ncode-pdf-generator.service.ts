/**
 * NCode PDF Generator Service
 * PDF에 NCode 패턴을 적용하여 인쇄 가능한 PDF를 생성합니다.
 *
 * 의존성: wasm-pdf-core sub-module 필요
 * 설정: vite.config.ts에서 nl-pdf-wrapper alias 설정 필요
 */

import {
  createPDFWorkerEmployer,
  NeoPDFContext,
  NeoPDFDocument,
  setUsePdfWorkers,
} from 'nl-pdf-wrapper';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

/** 개별 페이지의 NCode 정보 */
export interface NcodePageInfo {
  /** PDF 내 페이지 인덱스 */
  pageIndex: number;
  /** 원본 PDF에서의 페이지 인덱스 (표시용, 1부터 시작) */
  originalPageNumber?: number;
  /** Section */
  section: number;
  /** Owner */
  owner: number;
  /** Book code */
  book: number;
  /** Page number */
  page: number;
}

export interface NcodePdfGeneratorOptions {
  /** PDF 버퍼 */
  buffer: ArrayBuffer;
  /** Paper Group ID */
  paperGroupId: string;
  /** 문서 이름 */
  docName: string;
  /** 파란색(청사진)으로 변환 여부 */
  printInBlue: boolean;
  /** NCode 글리프 크기 (기본값 1.0) */
  ncodeGlyphScale: number;
  /** 처리할 페이지 목록 (각 페이지의 NCode 정보 포함) */
  pages: NcodePageInfo[];
  /** 진행 상태 콜백 */
  onProgress?: (status: string, progress: number, subStatus?: string) => void;
}

/** 기존 ncode 정보에서 pages 배열을 생성하는 헬퍼 함수 */
export function createPagesFromNcode(
  ncode: { section: number; owner: number; bookCode: number; pageStart: number },
  pageCount: number,
  originalPageIndices?: number[]  // 원본 PDF에서의 페이지 인덱스 배열 (0부터 시작)
): NcodePageInfo[] {
  return Array.from({ length: pageCount }, (_, i) => ({
    pageIndex: i,
    originalPageNumber: originalPageIndices ? originalPageIndices[i] + 1 : i + 1,  // 1부터 시작하는 페이지 번호
    section: ncode.section,
    owner: ncode.owner,
    book: ncode.bookCode,
    page: ncode.pageStart + i,
  }));
}

export interface NcodePdfGeneratorResult {
  /** 생성된 PDF 바이트 배열 */
  pdfBytes: Uint8Array;
}

/**
 * PDF에 NCode 패턴을 적용하여 새로운 PDF를 생성합니다.
 *
 * @param options 생성 옵션
 * @returns 생성된 PDF 바이트 배열
 */
export async function generateNcodePdf(
  options: NcodePdfGeneratorOptions
): Promise<NcodePdfGeneratorResult> {
  const {
    buffer,
    paperGroupId,
    docName,
    printInBlue,
    ncodeGlyphScale,
    pages,
    onProgress,
  } = options;

  const pageCount = pages.length;

  // Progress helper
  const reportProgress = (status: string, progress: number, subStatus?: string) => {
    onProgress?.(status, progress, subStatus);
  };

  // Initialize wasm-pdf-core
  reportProgress('initializingEngine', 15);
  console.log('[NcodePdfGenerator] Initializing wasm-pdf-core...');

  setUsePdfWorkers(false);
  const employer = createPDFWorkerEmployer({ useWorker: false });
  await employer.initWorker();
  console.log('[NcodePdfGenerator] Employer initialized');

  const pdfCtx = new NeoPDFContext(employer);
  await pdfCtx.initContext(employer, 16);
  console.log('[NcodePdfGenerator] Context initialized');

  try {
    // Open PDF from buffer
    const ncodeDoc = new NeoPDFDocument(employer, pdfCtx);
    await ncodeDoc.openFromBuffer({
      paperGroupId,
      buffer,
      docName,
    });

    // Prepare NCode font
    reportProgress('preparingFont', 25);
    const ncodeFont = await ncodeDoc.prepareNcodeFont({
      glyphDiameter: ncodeGlyphScale,
    });

    // Process each page
    for (let i = 0; i < pageCount; i++) {
      const pageInfo = pages[i];
      const pageNum = i + 1;
      const progressPercent = 30 + Math.floor((i / pageCount) * 60);
      reportProgress('generatingPattern', progressPercent, `${pageNum}/${pageCount}`);

      // UI 업데이트를 위한 짧은 딜레이 (메인 스레드 블로킹 방지)
      await new Promise(resolve => setTimeout(resolve, 1));

      const page = await ncodeDoc.getPage(pageInfo.pageIndex);
      if (!page) {
        console.warn(`[NcodePdfGenerator] Page ${pageInfo.pageIndex} not found`);
        continue;
      }

      // 파란색 변환 옵션이 켜져 있으면 페이지를 파란색으로 변환
      if (printInBlue) {
        await page.convertPageColor(
          true,   // toRgb
          false,  // toCmy
          null,   // ncodeFont
          true,   // useRgbPseudoColor - 청사진(파란색)으로 변환
          0.9,    // maxBlueContrast
          true,   // shouldFlatten
          true,   // dropContents
          false   // rgbSoftMark
        );
      }

      // SOBP string format: section.owner.book.page
      const sobp = `${pageInfo.section}.${pageInfo.owner}.${pageInfo.book}.${pageInfo.page}`;
      console.log(`[NcodePdfGenerator] Adding NCode to page ${pageInfo.pageIndex}: ${sobp}`);

      page.startNcodeLayersOverlay();
      await page.addNcodeLayer({
        sobp,
        isPdfInRGB: true,
        ncodeFont,
      });
      await page.flushAndDrawNcodeLayers();

      await page.flattenPage();
      await page.free();
    }

    // Save PDF
    reportProgress('savingPdf', 95);
    const savedBytes = await ncodeDoc.saveBytes();

    // Cleanup
    await ncodeDoc.free();
    pdfCtx.free();
    employer.terminate();

    // Add page info text using pdf-lib
    const pdfDoc = await PDFDocument.load(savedBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pdfPages = pdfDoc.getPages();

    for (let i = 0; i < pages.length; i++) {
      const pageInfo = pages[i];
      const pdfPage = pdfPages[i];
      if (!pdfPage) continue;

      const fontSize = 7;
      const margin = 10;

      // 원본 페이지 번호 (없으면 pageIndex + 1 사용)
      const originalPageNum = pageInfo.originalPageNumber ?? (pageInfo.pageIndex + 1);
      const sobp = `${pageInfo.section}.${pageInfo.owner}.${pageInfo.book}.${pageInfo.page}`;

      // 한 줄로 합친 텍스트
      const infoText = `pageNo:${originalPageNum} pageaddress=${sobp} b${printInBlue ? 1 : 0} s=${ncodeGlyphScale.toFixed(1)}`;

      // 세로로 위로 쓰기 (90도 회전)
      // 왼쪽 아래에서 시작, 텍스트는 아래에서 위로 읽힘
      pdfPage.drawText(infoText, {
        x: margin,
        y: margin,
        size: fontSize,
        font: helveticaFont,
        color: rgb(0, 0, 0),
        rotate: degrees(90),
      });
    }

    const finalPdfBytes = await pdfDoc.save();

    return {
      pdfBytes: new Uint8Array(finalPdfBytes),
    };
  } catch (error) {
    // Cleanup on error
    pdfCtx.free();
    employer.terminate();
    throw error;
  }
}

/**
 * NCode PDF 파일명 생성
 * 형식: {title}-ncoded-{S}_{O}_{B}_{P}-b{blueprint}-d{glyphScale}.pdf
 * 예: document-ncoded-5_255_0_796-b1-d1.0.pdf
 */
export function generateNcodePdfFilename(
  title: string,
  sobp: { section: number; owner: number; book: number; pageStart: number },
  printInBlue: boolean,
  ncodeGlyphScale: number
): string {
  const { section, owner, book, pageStart } = sobp;
  const blueprintFlag = printInBlue ? '1' : '0';
  const glyphScaleStr = ncodeGlyphScale.toFixed(1);
  return `${title}-ncoded-${section}_${owner}_${book}_${pageStart}-b${blueprintFlag}-d${glyphScaleStr}.pdf`;
}

/**
 * PDF 다운로드 헬퍼
 */
export function downloadPdf(pdfBytes: Uint8Array, filename: string): void {
  const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 브라우저 인쇄 다이얼로그로 PDF 인쇄
 */
export function printPdf(pdfBytes: Uint8Array): void {
  const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      // Cleanup after print dialog closes
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 1000);
    }, 100);
  };
}
