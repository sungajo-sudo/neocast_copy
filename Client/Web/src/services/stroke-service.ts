import {
  createStrokeStart,
  createStrokePoint,
  createStrokeEnd,
  createStrokeCancel,
  createPageChange,
  createPageAdd,
  createPageDelete,
  createClearPage,
  createUndo,
  createRedo,
} from '../protocol/messages';
import { useStrokeStore } from '../stores/stroke-store';
import { usePageStore } from '../stores/page-store';
import { useSessionStore } from '../stores/session-store';
import { PenType, StrokeFlags, PageType, createMousePageAddress, formatPageAddress, isSamePageAddress } from '../types';
import type { StrokePoint, NcodePageAddress } from '../types';
import StrokeSocketWorker from '../workers/stroke-socket.worker?worker';


/**
 * Stroke 서비스 (Web Worker 기반)
 *
 * Socket.IO /stroke 연결과 바이너리 파싱은 별도 Worker에서 실행된다.
 * 메인 스레드는 UI 이벤트 처리와 Zustand 스토어 업데이트만 담당한다.
 *
 * 송신: Main Thread → createBinaryMsg() → Worker → socket.emit()
 * 수신: Worker(socket.on + parseMessage) → postMessage(parsed) → Main Thread → store update
 */
class StrokeService {
  private worker: Worker | null = null;

  /**
   * Worker 생성 및 소켓 연결
   */
  connect(serverUrl: string, auth: Record<string, unknown>, query: Record<string, unknown>): void {
    if (this.worker) return;

    this.worker = new StrokeSocketWorker();
    this.setupWorkerHandlers();

    this.worker.postMessage({
      type: 'connect',
      url: serverUrl,
      auth,
      query,
    });

    console.log('[StrokeService] Worker created, connecting...');
  }

  /**
   * 소켓 연결 해제
   */
  disconnect(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'disconnect' });
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Worker를 통해 바이너리 데이터 전송
   */
  private workerEmit(data: ArrayBuffer): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'emit', data }, [data]);
    }
  }

  /**
   * 스트로크 시작
   */
  startStroke(
    strokeId: string,
    ownerUserId: string,
    pageAddress: NcodePageAddress,
    color: number,
    thickness: number,
    penType: PenType,
    flags: StrokeFlags = StrokeFlags.None
  ): void {
    const timestamp = Date.now();

    // 로컬 스토어에 추가 (worker 유무와 무관하게 항상 실행)
    const currentUserId = useSessionStore.getState().currentUserId;
    if (currentUserId) {
      useStrokeStore.getState().startStroke(
        strokeId,
        currentUserId,
        ownerUserId,
        pageAddress,
        color,
        thickness,
        penType,
        flags,
        timestamp
      );
    }

    // Worker를 통해 서버로 전송
    if (this.worker) {
      const message = createStrokeStart(strokeId, ownerUserId, pageAddress, color, thickness, penType, flags, timestamp);
      this.workerEmit(message);
    }
    console.log('[StrokeService] Stroke started:', strokeId, 'page:', formatPageAddress(pageAddress), 'on canvas of:', ownerUserId);
  }

  /**
   * 스트로크 포인트 추가
   */
  addPoint(strokeId: string, x: number, y: number, pressure: number): void {
    const timestamp = Date.now();
    const point: StrokePoint = { x, y, pressure, timestamp };

    // 로컬 스토어에 추가 (worker 유무와 무관하게 항상 실행)
    useStrokeStore.getState().addPoint(strokeId, point);

    // Worker를 통해 서버로 전송
    if (this.worker) {
      const message = createStrokePoint(strokeId, x, y, pressure, timestamp);
      this.workerEmit(message);
    }
  }

  /**
   * 스트로크 종료
   */
  endStroke(strokeId: string): void {
    // Worker를 통해 서버로 전송
    if (this.worker) {
      const message = createStrokeEnd(strokeId);
      this.workerEmit(message);
    }

    // 로컬 스토어 업데이트 (worker 유무와 무관하게 항상 실행)
    const store = useStrokeStore.getState();
    const activeStroke = store.getActiveStroke(strokeId);
    if (activeStroke?.penType === PenType.Eraser) {
      store.applyEraserStroke(activeStroke);
      store.cancelStroke(strokeId);
    } else {
      store.endStroke(strokeId);
    }

    console.log('[StrokeService] Stroke ended:', strokeId);
  }

  /**
   * 스트로크 취소
   */
  cancelStroke(strokeId: string): void {
    // Worker를 통해 서버로 전송
    if (this.worker) {
      const message = createStrokeCancel(strokeId);
      this.workerEmit(message);
    }

    // 로컬 스토어 업데이트 (worker 유무와 무관하게 항상 실행)
    useStrokeStore.getState().cancelStroke(strokeId);
    console.log('[StrokeService] Stroke cancelled:', strokeId);
  }

  /**
   * 페이지 변경 (마우스 페이지 번호로)
   */
  changePage(pageNumber: number): void {
    const pageAddress = createMousePageAddress(pageNumber);
    this.changePageByAddress(pageAddress);
  }

  /**
   * 페이지 변경 (페이지 주소로)
   */
  changePageByAddress(pageAddress: NcodePageAddress): void {
    // Worker를 통해 서버로 전송
    if (this.worker) {
      const message = createPageChange(pageAddress);
      this.workerEmit(message);
    }

    // 로컬 스토어 업데이트 (worker 유무와 무관하게 항상 실행)
    const sessionStore = useSessionStore.getState();
    const ownerUserId = sessionStore.selectedViewUserId ?? sessionStore.currentUserId;

    useStrokeStore.getState().setCurrentPage(pageAddress);
    if (ownerUserId) {
      usePageStore.getState().setCurrentPage(pageAddress, ownerUserId);
    }
    console.log('[StrokeService] Page changed:', formatPageAddress(pageAddress));
  }

  /**
   * 페이지 추가
   */
  addPage(ownerUserId: string, pageAddress: NcodePageAddress, width: number = 210, height: number = 297): void {
    // Worker를 통해 서버로 전송
    if (this.worker) {
      const message = createPageAdd(ownerUserId, pageAddress, width, height, PageType.Blank);
      this.workerEmit(message);
    }
    console.log('[StrokeService] Page added for user:', ownerUserId, 'page:', formatPageAddress(pageAddress));
  }

  /**
   * 페이지 삭제
   */
  deletePage(pageAddress: NcodePageAddress): void {
    // Worker를 통해 서버로 전송
    if (this.worker) {
      const message = createPageDelete(pageAddress);
      this.workerEmit(message);
    }

    // 로컬 스토어 업데이트 (worker 유무와 무관하게 항상 실행)
    const sessionStore = useSessionStore.getState();
    const ownerUserId = sessionStore.selectedViewUserId ?? sessionStore.currentUserId;
    if (ownerUserId) {
      usePageStore.getState().deletePage(pageAddress, ownerUserId);
    }
    useStrokeStore.getState().clearPage(pageAddress);
    console.log('[StrokeService] Page deleted:', formatPageAddress(pageAddress));
  }

  /**
   * 페이지 클리어
   */
  clearPage(pageNumber: number): void {
    const pageAddress = createMousePageAddress(pageNumber);
    this.clearPageByAddress(pageAddress);
  }

  /**
   * 페이지 클리어 (페이지 주소로)
   */
  clearPageByAddress(pageAddress: NcodePageAddress): void {
    const sessionStore = useSessionStore.getState();
    const ownerUserId = sessionStore.getActiveCanvasUserId() ?? sessionStore.currentUserId;

    if (!ownerUserId) {
      console.warn('[StrokeService] No active canvas to clear');
      return;
    }

    // Worker를 통해 서버로 전송
    if (this.worker) {
      const message = createClearPage(pageAddress);
      this.workerEmit(message);
    }

    // 로컬 스토어 업데이트 (worker 유무와 무관하게 항상 실행)
    useStrokeStore.getState().clearPageByOwner(pageAddress, ownerUserId);
    console.log('[StrokeService] Page cleared for user:', ownerUserId, 'page:', formatPageAddress(pageAddress));
  }

  /**
   * Undo
   */
  undo(count: number = 1): void {
    const pageAddress = useStrokeStore.getState().currentPageAddress;
    const sessionStore = useSessionStore.getState();
    const ownerUserId = sessionStore.getActiveCanvasUserId() ?? sessionStore.currentUserId;

    if (!ownerUserId) {
      console.warn('[StrokeService] No active canvas for undo');
      return;
    }

    // Worker를 통해 서버로 전송
    if (this.worker) {
      const message = createUndo(pageAddress, count);
      this.workerEmit(message);
    }

    // 로컬 스토어 업데이트 (worker 유무와 무관하게 항상 실행)
    for (let i = 0; i < count; i++) {
      useStrokeStore.getState().undo(pageAddress, ownerUserId);
    }

    console.log('[StrokeService] Undo for user:', ownerUserId, 'page:', formatPageAddress(pageAddress), count);
  }

  /**
   * Redo
   */
  redo(count: number = 1): void {
    const pageAddress = useStrokeStore.getState().currentPageAddress;
    const sessionStore = useSessionStore.getState();
    const ownerUserId = sessionStore.getActiveCanvasUserId() ?? sessionStore.currentUserId;

    if (!ownerUserId) {
      console.warn('[StrokeService] No active canvas for redo');
      return;
    }

    // Worker를 통해 서버로 전송
    if (this.worker) {
      const message = createRedo(pageAddress, count);
      this.workerEmit(message);
    }

    // 로컬 스토어 업데이트 (worker 유무와 무관하게 항상 실행)
    for (let i = 0; i < count; i++) {
      useStrokeStore.getState().redo(pageAddress, ownerUserId);
    }

    console.log('[StrokeService] Redo for user:', ownerUserId, 'page:', formatPageAddress(pageAddress), count);
  }

  // ============================================
  // Worker 메시지 핸들러 (수신 파싱 결과 처리)
  // ============================================

  private setupWorkerHandlers(): void {
    if (!this.worker) return;

    this.worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;

      switch (msg.type) {
        case 'connected':
          console.log('[StrokeService] Worker connected');
          break;

        case 'disconnected':
          console.log('[StrokeService] Worker disconnected:', msg.reason);
          break;

        case 'connect_error':
          console.error('[StrokeService] Worker connect error:', msg.message);
          break;

        case 'stroke':
          // Worker에서 파싱된 메시지 처리
          this.handleParsedMessage(msg.parsed, null);
          break;

        case 'socket-error':
          console.error('[StrokeService] Socket error:', msg.error);
          break;
      }
    };
  }

  /**
   * 파싱된 메시지 처리 (Zustand 스토어 업데이트)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleParsedMessage(message: any, senderId: string | null): void {
    const store = useStrokeStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentUserId = sessionStore.currentUserId;

    switch (message.msgType) {
      case 'WRAPPED':
        if (message.senderId !== currentUserId && message.payload) {
          this.handleParsedMessage(message.payload, message.senderId);
        }
        break;

      case 'STROKE_START':
        if (senderId && senderId !== currentUserId) {
          store.startStroke(
            message.strokeId,
            senderId,
            message.ownerUserId,
            message.pageAddress,
            message.color,
            message.thickness,
            message.penType,
            message.flags,
            message.timestamp
          );

          const pageStore = usePageStore.getState();
          if (!pageStore.hasPage(message.pageAddress, message.ownerUserId)) {
            pageStore.addPage(message.pageAddress, message.ownerUserId);
          }

          // 자동 네비게이션
          const selectedViewUserIds = sessionStore.selectedViewUserIds;
          const selectedViewUserId = sessionStore.selectedViewUserId;
          let shouldAutoNavigate = false;
          if (!store.pageNavigationLocked && !isSamePageAddress(message.pageAddress, store.currentPageAddress)) {
            if (selectedViewUserIds.length === 1) {
              shouldAutoNavigate = selectedViewUserId === message.ownerUserId;
            }
          }

          if (shouldAutoNavigate) {
            store.setCurrentPage(message.pageAddress);
            usePageStore.getState().setCurrentPage(message.pageAddress, message.ownerUserId);
          }
        }
        break;

      case 'STROKE_POINT':
        if (senderId && senderId !== currentUserId) {
          store.addPoint(message.strokeId, {
            x: message.x,
            y: message.y,
            pressure: message.pressure,
            timestamp: message.timestamp,
          });
        }
        break;

      case 'STROKE_POINT_BATCH':
        if (senderId && senderId !== currentUserId) {
          for (const point of message.points) {
            store.addPoint(message.strokeId, {
              x: point.x,
              y: point.y,
              pressure: point.pressure,
              timestamp: point.timestamp,
            });
          }
        }
        break;

      case 'STROKE_END':
        if (senderId && senderId !== currentUserId) {
          const activeStroke = store.getActiveStroke(message.strokeId);
          if (activeStroke?.penType === PenType.Eraser) {
            store.applyEraserStroke(activeStroke);
            store.cancelStroke(message.strokeId);
          } else {
            store.endStroke(message.strokeId);
          }
        }
        break;

      case 'STROKE_CANCEL':
        if (senderId && senderId !== currentUserId) {
          store.cancelStroke(message.strokeId);
        }
        break;

      case 'HISTORY_START':
        console.log('[StrokeService] History sync started:', message.totalStrokes, 'strokes,', message.totalPages, 'pages');
        sessionStore.startSync(message.totalStrokes);
        store.clearAllStrokes();
        break;

      case 'HISTORY_PAGE':
        usePageStore.getState().addPage(message.pageAddress, message.ownerUserId, message.width, message.height);
        break;

      case 'HISTORY_STROKE': {
        const historyPageStore = usePageStore.getState();
        if (!historyPageStore.hasPage(message.stroke.pageAddress, message.stroke.ownerUserId)) {
          historyPageStore.addPage(message.stroke.pageAddress, message.stroke.ownerUserId);
        }
        if (message.stroke.penType === PenType.Eraser) {
          store.applyEraserStroke(message.stroke);
        } else {
          store.addHistoryStroke(message.stroke);
        }
        sessionStore.updateSyncProgress(sessionStore.syncProgress + 1);
        break;
      }

      case 'HISTORY_END':
        console.log('[StrokeService] History sync completed:', message.syncedStrokes, 'strokes');
        sessionStore.endSync();
        break;

      case 'ERROR':
        console.error('[StrokeService] Server error:', message.errorCode, message.message);
        break;

      case 'PAGE_ADD':
        if (senderId && senderId !== currentUserId) {
          usePageStore.getState().addPage(message.pageAddress, message.ownerUserId, message.width, message.height);
        }
        if (message.ownerUserId === currentUserId && senderId !== currentUserId) {
          usePageStore.getState().addPage(message.pageAddress, currentUserId!, message.width, message.height);
        }
        break;

      case 'PAGE_DELETE':
        if (senderId && senderId !== currentUserId) {
          usePageStore.getState().deletePage(message.pageAddress, senderId);
          store.clearPage(message.pageAddress);
        }
        break;

      case 'PAGE_CHANGE':
        if (senderId && senderId !== currentUserId) {
          const selectedViewUserIds = sessionStore.selectedViewUserIds;
          const selectedViewUserId = sessionStore.selectedViewUserId;
          let shouldAutoNavigate = false;
          if (!store.pageNavigationLocked && !isSamePageAddress(message.pageAddress, store.currentPageAddress)) {
            if (selectedViewUserIds.length === 1) {
              shouldAutoNavigate = selectedViewUserId === senderId;
            }
          }
          if (shouldAutoNavigate) {
            store.setCurrentPage(message.pageAddress);
            usePageStore.getState().setCurrentPage(message.pageAddress, senderId);
          }
        }
        break;
    }
  }
}

// 싱글톤 인스턴스
export const strokeService = new StrokeService();
