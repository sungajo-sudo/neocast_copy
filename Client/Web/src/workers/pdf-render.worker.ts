/**
 * PDF 렌더링 Worker
 * PDF.js를 사용하여 백그라운드에서 PDF 페이지를 렌더링
 */

// Worker 환경에서 PDF.js가 필요로 하는 가짜 document 객체 제공
// PDF.js가 FontFace나 style element를 생성하려고 할 때 사용
const fakeDocument = {
  createElement: (tag: string) => {
    if (tag === 'canvas') {
      return new OffscreenCanvas(1, 1);
    }
    // 다른 요소는 빈 객체 반환
    return {
      style: {},
      setAttribute: () => {},
      getAttribute: () => null,
      appendChild: () => {},
      removeChild: () => {},
    };
  },
  createElementNS: () => ({
    style: {},
    setAttribute: () => {},
    getAttribute: () => null,
    appendChild: () => {},
    removeChild: () => {},
  }),
  documentElement: {
    style: {},
    appendChild: () => {},
    removeChild: () => {},
  },
  head: {
    appendChild: () => {},
    removeChild: () => {},
  },
  body: {
    appendChild: () => {},
    removeChild: () => {},
  },
};

// Worker 전역에 가짜 document 설정
(self as unknown as { document: typeof fakeDocument }).document = fakeDocument;

// Worker 전용 postMessage 함수 (transferables 지원)
const postMessageWithTransfer = (
  message: unknown,
  transfer?: Transferable[]
): void => {
  if (transfer) {
    (self as unknown as { postMessage: (msg: unknown, transfer: Transferable[]) => void }).postMessage(message, transfer);
  } else {
    (self as unknown as { postMessage: (msg: unknown) => void }).postMessage(message);
  }
};

// PDF.js 메인 라이브러리 import
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { SOBKey, PdfWorkerCommand, PdfWorkerResponse } from '../types/paper-info';

// PDF.js Worker 설정 - CDN에서 로드
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// 현재 로드된 PDF 문서들
const loadedDocuments = new Map<SOBKey, PDFDocumentProxy>();

// 진행 중인 렌더링 태스크들
const renderTasks = new Map<string, RenderTask>();

/**
 * 메시지 핸들러
 */
self.onmessage = async (event: MessageEvent<PdfWorkerCommand>) => {
  const command = event.data;

  switch (command.type) {
    case 'INIT':
      await handleInit(command.pdfData, command.sobKey);
      break;

    case 'RENDER':
      await handleRender(command.requestId, command.pageIndex, command.scale);
      break;

    case 'CANCEL':
      handleCancel(command.requestId);
      break;

    case 'DISPOSE':
      handleDispose();
      break;
  }
};

/**
 * PDF 문서 초기화
 */
async function handleInit(pdfData: ArrayBuffer, sobKey: SOBKey): Promise<void> {
  try {
    // 이미 로드된 문서가 있으면 해제
    const existing = loadedDocuments.get(sobKey);
    if (existing) {
      existing.destroy();
      loadedDocuments.delete(sobKey);
    }

    // PDF 로드 (Worker 내에서 실행되므로 내부 worker 비활성화)
    const loadingTask = pdfjsLib.getDocument({
      data: pdfData,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,  // Worker 환경에서 폰트 로딩 비활성화
      disableAutoFetch: true,
      disableRange: true,
      standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/standard_fonts/`,
    });

    const pdfDoc = await loadingTask.promise;
    loadedDocuments.set(sobKey, pdfDoc);

    const response: PdfWorkerResponse = {
      type: 'READY',
      sobKey,
      pageCount: pdfDoc.numPages,
    };
    postMessageWithTransfer(response);
  } catch (error) {
    const response: PdfWorkerResponse = {
      type: 'ERROR',
      error: `Failed to load PDF: ${error instanceof Error ? error.message : String(error)}`,
    };
    postMessageWithTransfer(response);
  }
}

/**
 * 페이지 렌더링
 */
async function handleRender(
  requestId: string,
  pageIndex: number,
  scale: number
): Promise<void> {
  try {
    // 첫 번째 로드된 문서 사용 (단일 문서 가정)
    const sobKey = loadedDocuments.keys().next().value as SOBKey | undefined;
    if (!sobKey) {
      throw new Error('No PDF document loaded');
    }

    const pdfDoc = loadedDocuments.get(sobKey);
    if (!pdfDoc) {
      throw new Error('PDF document not found');
    }

    // 페이지 번호는 1-based
    const pageNumber = pageIndex + 1;
    if (pageNumber < 1 || pageNumber > pdfDoc.numPages) {
      throw new Error(`Invalid page index: ${pageIndex}`);
    }

    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    // OffscreenCanvas 생성
    const canvas = new OffscreenCanvas(
      Math.floor(viewport.width),
      Math.floor(viewport.height)
    );
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Failed to get 2d context');
    }

    // 렌더링 태스크 시작
    const renderTask = page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    });

    renderTasks.set(requestId, renderTask);

    await renderTask.promise;

    // 렌더링 완료 - 태스크 제거
    renderTasks.delete(requestId);

    // ImageBitmap으로 변환하여 전송
    const imageBitmap = await createImageBitmap(canvas);

    const response: PdfWorkerResponse = {
      type: 'RENDERED',
      requestId,
      imageBitmap,
      width: Math.floor(viewport.width),
      height: Math.floor(viewport.height),
    };
    postMessageWithTransfer(response, [imageBitmap]);
  } catch (error) {
    // 취소된 경우가 아니면 에러 전송
    if (
      error instanceof Error &&
      error.message.includes('Rendering cancelled')
    ) {
      return;
    }

    const response: PdfWorkerResponse = {
      type: 'ERROR',
      requestId,
      error: `Render failed: ${error instanceof Error ? error.message : String(error)}`,
    };
    postMessageWithTransfer(response);
  }
}

/**
 * 렌더링 취소
 */
function handleCancel(requestId: string): void {
  const task = renderTasks.get(requestId);
  if (task) {
    task.cancel();
    renderTasks.delete(requestId);

    const response: PdfWorkerResponse = {
      type: 'CANCELLED',
      requestId,
    };
    postMessageWithTransfer(response);
  }
}

/**
 * 리소스 정리
 */
function handleDispose(): void {
  // 모든 렌더링 태스크 취소
  for (const [, task] of renderTasks) {
    task.cancel();
  }
  renderTasks.clear();

  // 모든 PDF 문서 해제
  for (const [, doc] of loadedDocuments) {
    doc.destroy();
  }
  loadedDocuments.clear();

  const response: PdfWorkerResponse = {
    type: 'DISPOSED',
  };
  postMessageWithTransfer(response);
}

// TypeScript를 위한 export
export {};
