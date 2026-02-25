/**
 * Feature Flags
 *
 * feature/restructure-v2 브랜치에서 특정 기능을 비활성화하기 위한 플래그.
 * 코드를 삭제하지 않고 조건부 렌더링으로 숨김 처리.
 * main merge 시 원하는 플래그를 true로 변경하여 재활성화 가능.
 */
export const FEATURE_FLAGS = {
  /** 메신저 (DM, 친구관리, 프레즌스) — Phase 0-4에서 비활성화 */
  MESSENGER_ENABLED: false,

  /** 음성 통화 (WebRTC 마이크) — Phase 0-4에서 비활성화 */
  VOICE_ENABLED: false,
} as const;
