/**
 * DEV 모드 멀티탭 브릿지 서비스
 *
 * 백엔드 없이 두 탭(호스트/게스트)이 서로 통신할 수 있도록
 * BroadcastChannel + localStorage를 사용합니다.
 *
 * - localStorage: 세션 정보 (크로스탭 영속 저장)
 * - BroadcastChannel: 실시간 이벤트 (스트로크, 참가자, 첨삭)
 */

import type { Stroke } from '../types';
import type { AnnotationStroke } from '../stores/annotation-store';

const CHANNEL_NAME = 'neocast:dev:bridge';
const SESSION_KEY_PREFIX = 'neocast:dev:session:';

/** localStorage에 저장되는 DEV 세션 데이터 */
export interface DevSessionData {
  id: string;
  code: string;
  title: string;
  hostId: string;
  hostName: string;
  createdAt: number;
}

/** 브릿지 채널로 전송되는 이벤트 */
export type BridgeEvent =
  | { type: 'GUEST_JOIN'; userId: string; userName: string; code: string }
  | { type: 'GUEST_LEAVE'; userId: string; code: string }
  | { type: 'STROKE_ADDED'; stroke: Stroke; code: string }
  | { type: 'GUEST_WRITING'; userId: string; code: string }
  | { type: 'ANNOTATION_ADDED'; targetUserId: string; annotation: AnnotationStroke; code: string };

type EventListener = (event: BridgeEvent) => void;

class DevBridgeService {
  private channel: BroadcastChannel | null = null;
  private listeners = new Map<string, EventListener[]>();

  private ensureChannel(): BroadcastChannel {
    if (!this.channel) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.addEventListener('message', (e: MessageEvent<BridgeEvent>) => {
        const handlers = this.listeners.get(e.data.type) ?? [];
        handlers.forEach((fn) => fn(e.data));
      });
    }
    return this.channel;
  }

  /** 세션을 localStorage에 등록 (게스트가 찾을 수 있도록) */
  announceSession(data: DevSessionData): void {
    localStorage.setItem(SESSION_KEY_PREFIX + data.code, JSON.stringify(data));
  }

  /** 세션 정보 조회 */
  getSession(code: string): DevSessionData | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY_PREFIX + code);
      return raw ? (JSON.parse(raw) as DevSessionData) : null;
    } catch {
      return null;
    }
  }

  /** 세션 정보 삭제 */
  removeSession(code: string): void {
    localStorage.removeItem(SESSION_KEY_PREFIX + code);
  }

  /** 다른 탭으로 이벤트 전송 */
  send(event: BridgeEvent): void {
    this.ensureChannel().postMessage(event);
  }

  /** 이벤트 구독 */
  on(type: BridgeEvent['type'], fn: EventListener): void {
    this.ensureChannel(); // 구독 시 채널 생성 보장 (수신 가능하도록)
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(type, [...existing, fn]);
  }

  /** 이벤트 구독 해제 */
  off(type: BridgeEvent['type'], fn: EventListener): void {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(type, existing.filter((f) => f !== fn));
  }

  /** 채널 닫기 */
  destroy(): void {
    this.channel?.close();
    this.channel = null;
    this.listeners.clear();
  }
}

export const devBridge = new DevBridgeService();
