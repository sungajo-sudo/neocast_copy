/**
 * Pen Input Service
 * 스마트펜 dot 데이터를 stroke로 변환하여 캔버스에 표시
 */

import { v4 as uuidv4 } from 'uuid';
import { neosmartpenService } from './neosmartpen.service';
import { useDemoStrokeStore } from '../stores/demoStrokeStore';
import { useSessionStore } from '../stores/sessionStore';
import { DotType, type DotData } from './pen-protocol';

// Ncode 좌표 변환 상수
const NCODE_TO_MM = 2.37066667;
const INTERNAL_DPI = 72;
const MM_TO_PT = INTERNAL_DPI / 25.4;
const NCODE_TO_PT = NCODE_TO_MM * MM_TO_PT;

// Ncode 좌표를 72 DPI point로 변환
function ncodeToPoint(ncodeValue: number): number {
  return ncodeValue * NCODE_TO_PT;
}

class PenInputService {
  private currentStrokeId: string | null = null;
  private currentPoints: { x: number; y: number; pressure: number }[] = [];
  private isInitialized = false;

  /**
   * 펜 입력 핸들링 초기화
   */
  initialize(): void {
    if (this.isInitialized) return;

    neosmartpenService.onDot((dot) => {
      this.handleDot(dot);
    });

    this.isInitialized = true;
    console.log('[PenInputService] Initialized');
  }

  /**
   * NeoSmartpen dot 이벤트 처리
   */
  private handleDot(dot: DotData): void {
    const sessionStore = useSessionStore.getState();
    const strokeStore = useDemoStrokeStore.getState();

    // 세션에 참여 중이어야 함
    if (!sessionStore.userId || !sessionStore.sessionId) {
      return;
    }

    const userId = sessionStore.userId;

    switch (dot.dotType) {
      case DotType.PenDown:
        // 새 스트로크 시작
        this.currentStrokeId = uuidv4();
        this.currentPoints = [];

        // 🧪 로컬 모드: 필기 시작 상태 저장 (필기중 뱃지용)
        const sessionId = sessionStore.sessionId;
        if (sessionId && userId) {
          localStorage.setItem(`nc_writing_${sessionId}_${userId}`, Date.now().toString());
        }

        // 첫 번째 포인트 추가 (Ncode → 72 DPI point 변환)
        const firstPressure = Math.min(dot.force / dot.maxForce, 1);
        const firstX = ncodeToPoint(dot.x);
        const firstY = ncodeToPoint(dot.y);

        this.currentPoints.push({
          x: firstX,
          y: firstY,
          pressure: firstPressure
        });

        // active stroke로 추가
        strokeStore.updateActiveStroke(this.currentStrokeId, {
          id: this.currentStrokeId,
          userId,
          color: '#1a1a1a', // 기본 검정색
          lineWidth: 3,
          points: [...this.currentPoints],
          done: false,
        });

        console.log(`[PenInputService] Stroke started: ${this.currentStrokeId} at (${firstX.toFixed(1)}, ${firstY.toFixed(1)})`);
        break;

      case DotType.PenMove:
        if (this.currentStrokeId && this.currentPoints.length > 0) {
          // Ncode 좌표가 (0,0) 부근이면 무효 좌표이므로 무시
          if (dot.x < 1 && dot.y < 1) break;

          // Ncode → 72 DPI point 변환
          const pressure = Math.min(dot.force / dot.maxForce, 1);
          const xPt = ncodeToPoint(dot.x);
          const yPt = ncodeToPoint(dot.y);

          this.currentPoints.push({
            x: xPt,
            y: yPt,
            pressure
          });

          // active stroke 업데이트
          strokeStore.updateActiveStroke(this.currentStrokeId, {
            id: this.currentStrokeId,
            userId,
            color: '#1a1a1a',
            lineWidth: 3,
            points: [...this.currentPoints],
            done: false,
          });
        }
        break;

      case DotType.PenUp:
        if (this.currentStrokeId && this.currentPoints.length > 0) {
          // 최종 스트로크로 저장
          strokeStore.addStroke(userId, {
            id: this.currentStrokeId,
            userId,
            color: '#1a1a1a',
            lineWidth: 3,
            points: [...this.currentPoints],
            done: true,
          });

          // 🧪 로컬 모드: localStorage에 스마트펜 스트로크 저장 (게스트 동기화용)
          const sessionId = sessionStore.sessionId;
          if (sessionId) {
            const strokeKey = `nc_strokes_${sessionId}_${userId}`;
            const strokes = JSON.parse(localStorage.getItem(strokeKey) || '[]');
            const newStroke = {
              id: this.currentStrokeId,
              userId,
              color: '#1a1a1a',
              lineWidth: 3,
              points: this.currentPoints.map(p => ({ x: p.x, y: p.y, pressure: p.pressure })),
              timestamp: Date.now(),
              done: true
            };
            strokes.push(newStroke);
            localStorage.setItem(strokeKey, JSON.stringify(strokes));
            console.log(`[PenInputService] Saved to localStorage: ${strokeKey}`);

            // 🧪 로컬 모드: 필기 완료 상태 제거 (필기중 뱃지용)
            localStorage.removeItem(`nc_writing_${sessionId}_${userId}`);
          }

          // active stroke 제거
          strokeStore.finalizeStroke(this.currentStrokeId);

          console.log(`[PenInputService] Stroke completed: ${this.currentStrokeId}, ${this.currentPoints.length} points`);

          // 초기화
          this.currentStrokeId = null;
          this.currentPoints = [];
        }
        break;

      case DotType.PenHover:
        // Hover 이벤트는 현재 무시
        break;
    }
  }

  /**
   * 현재 스트로크 취소
   */
  cancelCurrentStroke(): void {
    if (this.currentStrokeId) {
      const strokeStore = useDemoStrokeStore.getState();
      strokeStore.finalizeStroke(this.currentStrokeId);
      this.currentStrokeId = null;
      this.currentPoints = [];
      console.log('[PenInputService] Current stroke cancelled');
    }
  }
}

// 싱글톤 인스턴스
export const penInputService = new PenInputService();
