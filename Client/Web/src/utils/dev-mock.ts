/**
 * DEV 모드 전용 mock 유틸리티
 *
 * 실제 서버 데이터가 없는 상태에서 UI 프리뷰용으로 사용.
 * prod 빌드에서는 모두 비활성(false) 반환.
 */

/** userId 해시 기반 펜 연결 mock (~66% 연결) */
export function mockPenConnected(userId: string): boolean {
  if (!import.meta.env.DEV) return false;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 3 !== 0;
}
