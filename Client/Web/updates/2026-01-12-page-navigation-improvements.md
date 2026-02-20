# 페이지 네비게이션 개선 및 즉시 동기화 기능

## 변경 일자
2026-01-12

## 변경 요약
다중 사용자 환경에서 페이지 네비게이션 관련 버그를 수정하고, 페이지 변경 시 즉시 동기화 기능을 추가했습니다.

## 변경된 파일
- `src/components/toolbar/PageNavigation.tsx`: 복수 사용자 페이지 합집합 표시 및 PAGE_CHANGE 메시지 전송
- `src/services/stroke-service.ts`: 페이지 자동 이동 조건 개선 및 PAGE_CHANGE 핸들러 추가
- `src/protocol/messages.ts`: PAGE_CHANGE 메시지 파싱 지원 추가
- `src/components/canvas/CanvasContainer.tsx`: 페이지 미소유 시 (+) 버튼 표시

## 상세 내용

### 1. 복수 사용자 페이지 합집합 표시 (PageNavigation.tsx)
- **문제**: 복수 사용자 필기면을 볼 때 페이지 네비게이션 패널에 각 사용자의 페이지 합집합이 표시되지 않았음
- **해결**:
  - `UnionPageItem` 인터페이스 추가하여 여러 사용자의 페이지를 합집합으로 관리
  - `unionPages` useMemo로 선택된 사용자들의 페이지 합집합 계산
  - `renderOwnerIndicators`로 각 페이지의 소유자를 색상 인디케이터로 표시
  - 일부 사용자만 페이지를 소유한 경우 amber 색상 배경으로 구분

### 2. 페이지 자동 이동 조건 개선 (stroke-service.ts)
- **문제**: B가 B의 필기면을 보고 있을 때, A가 A의 필기면에서 페이지를 변경하면 B도 따라 이동하는 버그
- **해결**:
  - `selectedViewUserIds`와 `selectedViewUserId` 기반 조건 체크
  - 단일 사용자 보기: 해당 사용자의 캔버스에서 발생한 이벤트만 따라감
  - 복수 사용자 보기: 선택된 사용자들의 이벤트만 따라감
  - 전체 보기: 모든 사용자의 이벤트를 따라감

### 3. PAGE_CHANGE 즉시 동기화 (messages.ts, stroke-service.ts, PageNavigation.tsx)
- **문제**: 필기 시작(STROKE_START) 시에만 페이지가 동기화되고, 페이지 네비게이션 시에는 동기화되지 않았음
- **해결**:
  - `PageNavigation.tsx`의 `handleSelectPage`에서 `strokeService.changePageByAddress()` 호출 추가
  - `messages.ts`에 `ParsedPageChange` 인터페이스 및 `parsePageChange` 함수 추가
  - `stroke-service.ts`에 PAGE_CHANGE 메시지 핸들러 추가 (STROKE_START와 동일한 조건 로직)

### 4. 페이지 미소유 시 (+) 버튼 (CanvasContainer.tsx)
- **문제**: 복수 사용자 보기에서 특정 사용자가 현재 페이지를 소유하지 않을 때 빈 캔버스가 표시됨
- **해결**:
  - `hasPage` 함수로 각 사용자의 페이지 소유 여부 확인
  - 페이지 미소유 시 회색 배경과 "Add Page" 버튼 표시
  - 호스트가 버튼 클릭 시 해당 사용자에게 페이지 추가

## 관련 문서
- `docs/bugs/page-navigation-bugs.md` - 버그 분석 문서
- `docs/feat/page-sync-on-navigation.md` - 기능 설계 문서
