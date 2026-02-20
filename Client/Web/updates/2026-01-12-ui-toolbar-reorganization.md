# UI 툴바 재구성 및 레이아웃 개선

## 변경 일자
2026-01-12

## 변경 요약
Top bar에 주요 도구들을 배치하고, 사이드바 레이아웃을 개선했습니다. 연결 상태는 NeoCAST 제목의 글로우 효과로 표시하도록 변경했습니다.

## 변경된 파일

### 새로 추가된 파일
- `src/components/toolbar/ToolbarActions.tsx`: Undo/Redo/Clear 버튼 컴포넌트
- `src/components/toolbar/PaperSizeBadge.tsx`: Paper Size 드롭다운 뱃지 (A4, Letter, B4, A5)
- `src/components/toolbar/PenSettingsPopover.tsx`: 펜 설정 팝오버 (펜 타입, 색상, 두께)

### 수정된 파일
- `src/App.tsx`: 전체 레이아웃 재구성
  - NeoCAST 제목에 연결 상태 글로우 효과 적용 (녹색: 연결됨, 빨간색: 끊김)
  - 기존 연결 상태 인디케이터 (점 + 텍스트) 제거
  - Top bar에 ToolbarActions, PaperSizeBadge, PenSettingsPopover 추가
  - 왼쪽 사이드바: PageNavigation만 표시 (열린 상태 기본)
  - 오른쪽 사이드바: ParticipantList만 표시 (닫힌 상태 기본)
  - SessionInvite 컴포넌트 제거
  - AuthPanel은 로그인 전에만 표시

- `src/components/pen/PenConnectionBadge.tsx`: "Connect Pen" → "Connect"로 텍스트 간소화

- `src/components/toolbar/PageNavigation.tsx`: Lock 라벨에 오른쪽 마진 추가 (닫기 버튼과 겹침 방지)

- `src/components/toolbar/index.ts`: 새 컴포넌트들 export 추가

## 상세 내용

### Top Bar 구성
세션 활성화 시 NeoCAST 제목 오른쪽에 다음 순서로 표시:
1. Undo/Redo/Clear 버튼 (아이콘)
2. Paper Size 드롭다운 뱃지
3. Pen Settings 팝오버 (클릭 시 펜 타입/색상/두께 선택)

### 연결 상태 표시
- 연결됨: NeoCAST 제목에 녹색 형광 그림자
- 끊김: NeoCAST 제목에 빨간색 형광 그림자

### 사이드바 레이아웃
- 왼쪽: 페이지 리스트 (기본 열림)
- 오른쪽: 참가자 리스트 (기본 닫힘)
