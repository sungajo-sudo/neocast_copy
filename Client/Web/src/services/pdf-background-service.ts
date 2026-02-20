/**
 * PDF 배경 렌더링 서비스
 * - PDF.js를 사용한 메인 스레드 렌더링
 * - 렌더링 큐 및 우선순위 관리
 * - 현재 페이지 우선, 지나간 페이지 취소
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type {
  SOBKey,
  PdfRenderRequest,
  PdfRenderResult,
} from '../types/paper-info';

// PDF.js Worker 설정 - CDN에서 로드
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// 우선순위 상수
const PRIORITY_CURRENT = 0;
const PRIORITY_ADJACENT = 10;
const PRIORITY_OTHER = 50;

// 최대 동시 렌더링
const MAX_CONCURRENT_RENDERS = 3;

type RenderCallback = (result: PdfRenderResult) => void;

interface PendingRender {
  request: PdfRenderRequest;
  callback: RenderCallback;
  resolve: (result: PdfRenderResult) => void;
}

class PdfBackgroundService {
  private pdfDoc: PDFDocumentProxy | null = null;
  private currentSobKey: SOBKey | null = null;
  private isReady = false;
  private pageCount = 0;

  // 렌더링 큐
  private renderQueue: PendingRender[] = [];

  // 진행 중인 렌더링
  private activeRenders = new Map<string, { pending: PendingRender; task: RenderTask }>();

  // 콜백 맵
  private callbacks = new Map<string, RenderCallback>();

  private requestIdCounter = 0;

  /**
   * PDF 로드
   */
  async initWithPdf(sobKey: SOBKey, pdfBlob: Blob): Promise<number> {
    // 이미 같은 PDF가 로드되어 있으면 스킵
    if (this.currentSobKey === sobKey && this.isReady) {
      return this.pageCount;
    }

    // 기존 문서 정리
    this.dispose();

    this.currentSobKey = sobKey;
    this.isReady = false;

    // PDF 데이터 로드
    const pdfData = await pdfBlob.arrayBuffer();

    // PDF 문서 로드
    const loadingTask = pdfjsLib.getDocument({
      data: pdfData,
      useWorkerFetch: false,
      isEvalSupported: false,
    });

    this.pdfDoc = await loadingTask.promise;
    this.pageCount = this.pdfDoc.numPages;
    this.isReady = true;

    return this.pageCount;
  }

  /**
   * 페이지 렌더링 요청
   */
  requestRender(
    pageIndex: number,
    scale: number,
    priority: number = PRIORITY_OTHER
  ): Promise<PdfRenderResult> {
    return new Promise((resolve) => {
      if (!this.isReady || !this.currentSobKey) {
        resolve({
          requestId: '',
          sobKey: '' as SOBKey,
          pageIndex,
          imageBitmap: null,
          width: 0,
          height: 0,
          error: 'PDF not loaded',
        });
        return;
      }

      const requestId = `render_${++this.requestIdCounter}`;
      const request: PdfRenderRequest = {
        id: requestId,
        sobKey: this.currentSobKey,
        pageIndex,
        scale,
        priority,
        status: 'queued',
        requestedAt: Date.now(),
      };

      const pending: PendingRender = {
        request,
        callback: () => {},
        resolve,
      };

      // 큐에 우선순위 순으로 삽입
      this.insertIntoQueue(pending);

      // 큐 처리 시작
      this.processQueue();
    });
  }

  /**
   * 렌더링 요청 및 콜백
   */
  requestRenderWithCallback(
    pageIndex: number,
    scale: number,
    callback: RenderCallback,
    priority: number = PRIORITY_OTHER
  ): string {
    if (!this.isReady || !this.currentSobKey) {
      const result: PdfRenderResult = {
        requestId: '',
        sobKey: '' as SOBKey,
        pageIndex,
        imageBitmap: null,
        width: 0,
        height: 0,
        error: 'PDF not loaded',
      };
      // 콜백을 비동기로 호출하여 TDZ 에러 방지
      queueMicrotask(() => callback(result));
      return '';
    }

    const requestId = `render_${++this.requestIdCounter}`;
    const request: PdfRenderRequest = {
      id: requestId,
      sobKey: this.currentSobKey,
      pageIndex,
      scale,
      priority,
      status: 'queued',
      requestedAt: Date.now(),
    };

    const pending: PendingRender = {
      request,
      callback,
      resolve: () => {},
    };

    this.callbacks.set(requestId, callback);
    this.insertIntoQueue(pending);
    this.processQueue();

    return requestId;
  }

  /**
   * 렌더링 취소
   */
  cancelRender(requestId: string): void {
    // 큐에서 제거
    const queueIndex = this.renderQueue.findIndex(
      (p) => p.request.id === requestId
    );
    if (queueIndex !== -1) {
      this.renderQueue.splice(queueIndex, 1);
      this.callbacks.delete(requestId);
      return;
    }

    // 진행 중인 렌더링 취소
    const active = this.activeRenders.get(requestId);
    if (active) {
      active.task.cancel();
      this.activeRenders.delete(requestId);
      this.callbacks.delete(requestId);
    }
  }

  /**
   * 현재 페이지가 아닌 모든 렌더링 취소
   */
  cancelAllExcept(pageIndex: number): void {
    // 큐에서 다른 페이지 제거
    this.renderQueue = this.renderQueue.filter(
      (p) => p.request.pageIndex === pageIndex
    );

    // 진행 중인 렌더링 중 다른 페이지 취소
    for (const [requestId, active] of this.activeRenders) {
      if (active.pending.request.pageIndex !== pageIndex) {
        active.task.cancel();
        this.activeRenders.delete(requestId);
      }
    }
  }

  /**
   * 현재 페이지 우선순위 업데이트
   */
  setCurrentPage(pageIndex: number): void {
    // 현재 페이지의 우선순위를 최상위로
    for (const pending of this.renderQueue) {
      if (pending.request.pageIndex === pageIndex) {
        pending.request.priority = PRIORITY_CURRENT;
      } else if (
        Math.abs(pending.request.pageIndex - pageIndex) === 1
      ) {
        pending.request.priority = PRIORITY_ADJACENT;
      } else {
        pending.request.priority = PRIORITY_OTHER;
      }
    }

    // 큐 재정렬
    this.renderQueue.sort((a, b) => a.request.priority - b.request.priority);
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    // 모든 진행 중인 렌더링 취소
    for (const [, active] of this.activeRenders) {
      active.task.cancel();
    }
    this.activeRenders.clear();

    // PDF 문서 해제
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
      this.pdfDoc = null;
    }

    this.currentSobKey = null;
    this.isReady = false;
    this.pageCount = 0;
    this.renderQueue = [];
    this.callbacks.clear();
  }

  /**
   * 현재 로드된 SOBKey 조회
   */
  getCurrentSobKey(): SOBKey | null {
    return this.currentSobKey;
  }

  /**
   * 준비 상태 확인
   */
  isInitialized(): boolean {
    return this.isReady;
  }

  /**
   * 페이지 수 조회
   */
  getPageCount(): number {
    return this.pageCount;
  }

  // ============================================
  // Private 메서드
  // ============================================

  private insertIntoQueue(pending: PendingRender): void {
    // 우선순위 순으로 삽입
    const index = this.renderQueue.findIndex(
      (p) => p.request.priority > pending.request.priority
    );

    if (index === -1) {
      this.renderQueue.push(pending);
    } else {
      this.renderQueue.splice(index, 0, pending);
    }
  }

  private processQueue(): void {
    // 최대 동시 렌더링 수 확인
    while (
      this.activeRenders.size < MAX_CONCURRENT_RENDERS &&
      this.renderQueue.length > 0
    ) {
      const pending = this.renderQueue.shift();
      if (!pending) break;

      this.startRender(pending);
    }
  }

  private async startRender(pending: PendingRender): Promise<void> {
    if (!this.pdfDoc) return;

    pending.request.status = 'rendering';
    const requestId = pending.request.id;

    try {
      // 페이지 번호는 1-based
      const pageNumber = pending.request.pageIndex + 1;
      if (pageNumber < 1 || pageNumber > this.pdfDoc.numPages) {
        throw new Error(`Invalid page index: ${pending.request.pageIndex}`);
      }

      const page = await this.pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: pending.request.scale });

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

      this.activeRenders.set(requestId, { pending, task: renderTask });

      await renderTask.promise;

      // 렌더링 완료 - 태스크 제거
      this.activeRenders.delete(requestId);

      // ImageBitmap으로 변환
      const imageBitmap = await createImageBitmap(canvas);

      const result: PdfRenderResult = {
        requestId,
        sobKey: pending.request.sobKey,
        pageIndex: pending.request.pageIndex,
        imageBitmap,
        width: Math.floor(viewport.width),
        height: Math.floor(viewport.height),
      };

      // 콜백은 한 번만 호출
      const callback = this.callbacks.get(requestId);
      if (callback) {
        callback(result);
        this.callbacks.delete(requestId);
      } else {
        pending.callback(result);
      }
      pending.resolve(result);

    } catch (error) {
      this.activeRenders.delete(requestId);

      // 취소된 경우 무시
      if (error instanceof Error && error.message.includes('Rendering cancelled')) {
        return;
      }

      const result: PdfRenderResult = {
        requestId,
        sobKey: pending.request.sobKey,
        pageIndex: pending.request.pageIndex,
        imageBitmap: null,
        width: 0,
        height: 0,
        error: `Render failed: ${error instanceof Error ? error.message : String(error)}`,
      };

      // 콜백은 한 번만 호출
      const callback = this.callbacks.get(requestId);
      if (callback) {
        callback(result);
        this.callbacks.delete(requestId);
      } else {
        pending.callback(result);
      }
      pending.resolve(result);
    }

    // 다음 큐 처리
    this.processQueue();
  }
}

// 싱글톤 인스턴스
export const pdfBackgroundService = new PdfBackgroundService();

// 우선순위 상수 export
export { PRIORITY_CURRENT, PRIORITY_ADJACENT, PRIORITY_OTHER };
