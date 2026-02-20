# 스포트라이트/그리드 뷰 게스트 지원 및 주목공유 상태 복원

## 변경 일자
2026-02-11

## 변경 요약
게스트에게도 스포트라이트/그리드 뷰를 제공하고, 주목공유 해제 시 이전 뷰 상태를 복원하며, 다수의 UX 버그를 수정합니다.

## 변경된 파일

### Client

- **App.tsx**: 게스트 참가 페이지에서 "게스트로 바로 참가하기" 버튼에 `autoFocus` 추가 (Enter 키로 즉시 참가 가능)
- **CanvasContainer.tsx**: 게스트 스포트라이트/그리드 뷰 전면 구현
  - 게스트용 gridUsers 계산 (호스트 + 자신 + 주목공유 대상)
  - 스포트라이트 뷰 (사이드바 드래그 도킹, 썸네일, 접기/펼치기)
  - 뷰 모드 토글 버튼을 캔버스 영역 우하단으로 이동
  - 게스트 페이지 추가 가드: `!isHost` → `!isHost && userId !== currentUserId`
  - 게스트 초기 스포트라이트를 자신의 캔버스로 설정 (호스트 fallback 방지)
  - 주목공유 중 비호스트 캔버스 전환 차단
  - 스포트라이트 사이드바 세로 라벨 폰트 12px, 라벨 폭 22px, lineHeight 1.4
  - 그리드 셀에 페이지 주소 표시 추가
  - 컨텍스트 메뉴를 호스트 전용으로 제한 (스마트펜/호스트 임명/퇴출/주목공유)
  - 그리드 정보 클릭 시 GridSelector 팝업 연동
- **CanvasContextMenu.tsx**: 기존 "만 보기/제외" → 스마트펜 입력, 주목 공유, 호스트 임명, 내보내기로 재구성
- **GridSelector.tsx**: "자동 레이아웃" 버튼 추가 (`onAutoLayout` prop)

### Store

- **session-store.ts**:
  - `viewMode`, `spotlightUserId` 상태 및 setter 추가
  - `spotlightShareUserId`, `preSpotlightShareState` 상태 추가
  - `setSpotlightShare`: 활성 시 이전 viewMode/spotlightUserId 저장, 해제 시 복원
  - `setSession`: 게스트일 때 `spotlightUserId: currentUserId` 설정
  - `addParticipant`: `isGridLayoutAuto: true` 리셋 추가 (참가자 변동 시 자동 레이아웃 재계산)
  - `removeParticipant`: 주목공유 대상 퇴장 시 이전 상태 복원
- **connection-store.ts**: `SPOTLIGHT_SHARE` 컨트롤 메시지 수신 처리, 호스트 변경/연결 해제 시 주목공유 자동 해제

### Server

- **protocol/types.ts**: `SPOTLIGHT_SHARE` 컨트롤 이벤트 타입 추가
- **socket/namespaces/control.ns.ts**: `SPOTLIGHT_SHARE` 메시지 핸들러 (호스트 권한 검증 후 세션 전체 브로드캐스트)

### i18n

- 16개 언어 파일에 `canvas.spotlightView`, `canvas.gridView`, `canvas.spotlightSharing`, `canvas.stopSpotlightShare`, `participant.spotlightShare` 키 추가

## 상세 내용

### 게스트 뷰 모드
게스트에게도 스포트라이트/그리드 뷰를 제공합니다. 게스트의 gridUsers는 호스트 + 자신 + 주목공유 대상으로 구성되며, 초기 스포트라이트는 자신의 캔버스입니다.

### 주목공유 상태 복원
호스트가 주목공유를 활성화하면 현재 viewMode와 spotlightUserId를 `preSpotlightShareState`에 저장합니다. 해제 시 저장된 상태로 복원하여 사용자가 보던 화면으로 돌아갑니다. 대상 변경(A→B) 시에는 최초 진입 전 상태를 유지합니다.

### 그리드 자동 레이아웃
참가자 추가 시 `isGridLayoutAuto: true`로 리셋하여, 수동 레이아웃 선택 상태에서도 참가자 변동 시 자동으로 최적 레이아웃을 재계산합니다.
