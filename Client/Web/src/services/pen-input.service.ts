/**
 * Pen Input Service
 * Bridges NeoSmartpen input to the stroke service
 */

import { v4 as uuidv4 } from 'uuid';
import { neosmartpenService } from './neosmartpen.service';
import { strokeService } from './stroke-service';
import { useStrokeStore } from '../stores/stroke-store';
import { usePageStore } from '../stores/page-store';
import { useSessionStore } from '../stores/session-store';
import { DotType, type DotData, type NcodePageAddress } from './pen-protocol';
import { StrokeFlags, isSamePageAddress, ncodeToPoint } from '../types';

class PenInputService {
  private currentStrokeId: string | null = null;
  private isInitialized = false;

  /**
   * Initialize pen input handling
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
   * Handle dot event from NeoSmartpen
   */
  private handleDot(dot: DotData): void {
    const sessionStore = useSessionStore.getState();
    const strokeStore = useStrokeStore.getState();
    const pageStore = usePageStore.getState();

    // Need to be in a session
    if (!sessionStore.currentUserId || !sessionStore.session) {
      return;
    }

    const currentUserId = sessionStore.currentUserId;
    const isHost = sessionStore.isHost;
    // 호스트인 경우 smartpenTargetUserId 사용, 게스트는 항상 자신
    const smartpenTargetUserId = isHost
      ? sessionStore.getSmartpenTargetUserId()
      : currentUserId;

    // Ncode page address from pen
    const pageAddress: NcodePageAddress = {
      section: dot.section,
      owner: dot.owner,
      book: dot.book,
      page: dot.page,
    };

    switch (dot.dotType) {
      case DotType.PenDown:
        // Start new stroke
        this.currentStrokeId = uuidv4();

        // For physical pen input, always switch to the page the pen is writing on
        // (pageNavigationLocked only affects mouse/UI-based page changes)
        if (!isSamePageAddress(pageAddress, strokeStore.currentPageAddress)) {
          strokeStore.setCurrentPage(pageAddress);
          pageStore.setCurrentPage(pageAddress, smartpenTargetUserId ?? currentUserId);
          console.log('[PenInputService] Auto-switched to page:', pageAddress);
        }

        // 스마트펜 입력은 smartpenSettings 사용
        // 호스트가 게스트 캔버스에 입력할 때는 guestInputSettings 사용
        const isInputToOther = smartpenTargetUserId && smartpenTargetUserId !== currentUserId;
        const { penColor, penThickness, penType } = isInputToOther
          ? strokeStore.guestInputSettings
          : strokeStore.smartpenSettings;
        strokeService.startStroke(
          this.currentStrokeId,
          smartpenTargetUserId ?? currentUserId, // ownerUserId: 스마트펜 타겟 사용자의 페이지에 기록
          pageAddress,
          penColor,
          penThickness,
          penType,
          StrokeFlags.PressureSensitive
        );

        // Add the first point (Ncode → 72 DPI point 변환)
        {
          const normalizedPressure = Math.floor((dot.force / dot.maxForce) * 65535);
          const xPt = ncodeToPoint(dot.x);
          const yPt = ncodeToPoint(dot.y);
          strokeService.addPoint(this.currentStrokeId, xPt, yPt, normalizedPressure);
        }
        break;

      case DotType.PenMove:
        if (this.currentStrokeId) {
          // Ncode 좌표가 (0,0) 부근(0.0~0.999...)이면 무효 좌표이므로 무시
          if (dot.x < 1 && dot.y < 1) break;
          // Ncode → 72 DPI point 변환
          const normalizedPressure = Math.floor((dot.force / dot.maxForce) * 65535);
          const xPt = ncodeToPoint(dot.x);
          const yPt = ncodeToPoint(dot.y);
          strokeService.addPoint(this.currentStrokeId, xPt, yPt, normalizedPressure);
        }
        break;

      case DotType.PenUp:
        if (this.currentStrokeId) {
          strokeService.endStroke(this.currentStrokeId);
          this.currentStrokeId = null;
        }
        break;

      case DotType.PenHover:
        // Hover events are currently ignored
        break;
    }
  }

  /**
   * Cancel current stroke (if any)
   */
  cancelCurrentStroke(): void {
    if (this.currentStrokeId) {
      strokeService.cancelStroke(this.currentStrokeId);
      this.currentStrokeId = null;
    }
  }
}

// Singleton instance
export const penInputService = new PenInputService();
