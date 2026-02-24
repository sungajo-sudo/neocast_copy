*26-02-24 기준 STEP 1 완료 (master_instructions_v2 기준 — 스토어 구조 이식). Session 8-2까지 완료 포함.

# 🚀 NeoCast — 실시간 필기 협업 플랫폼 (데모 버전)

본 저장소는 실시간 필기 공유 및 원격 첨삭 기능을 시연하기 위해 최적화된 NeoCast의 **데모 버전**입니다.

> **알림:** 이 프로젝트의 모든 설계, 로직 구현 및 UI 디자인은 **Anthropic의 Claude Code (에이전틱 AI)**를 통해 진행되었습니다.

---

## 📌 프로젝트 개요

NeoCast는 실시간 교육과 피드백을 위한 세션 기반 협업 플랫폼입니다. 이번 데모 버전은 **첨삭(빨간펜) 워크플로우**에 집중하여, 호스트가 여러 학생의 화면을 동시에 모니터링하고 가상 캔버스 위에 실시간으로 피드백을 남기는 기능을 핵심적으로 보여줍니다.

## ✨ 핵심 기능 (데모 구현 완료)

- **실시간 스트로크 동기화**: Binary 데이터 전송 및 pako 압축을 통한 초저지연 필기 공유.
- **모니터링 모드 (Dashboard)**: 접속된 모든 학생의 화면을 한눈에 볼 수 있는 실시간 그리드 뷰.
- **원격 첨삭 (Red Pen)**: 호스트가 특정 학생의 캔버스에 진입하여 직접 빨간펜으로 첨삭하면 학생 화면에 실시간 노출.
- **간편 세션 입장**: 별도의 복잡한 인증 없이 닉네임과 세션 코드만으로 즉시 참여 가능.
- **AI 학습 분석 프리뷰**: 세션 활동 데이터를 기반으로 한 학생별 성취도 리포트 UI 및 결과 분석 기능.
- **PDF 다운로드**: 학생별 필기 및 첨삭 내용을 PDF로 저장 (jsPDF + html2canvas).

## 🛠 기술 스택

- **Frontend**: React, TypeScript, Vite, Tailwind CSS v4
- **Backend**: Node.js, Socket.IO
- **Communication**: Socket.IO (Namespaces: `/stroke`, `/control`)
- **Data Compression**: Pako (zlib)를 이용한 바이너리 필기 데이터 압축
- **Styling**: 수채화 배경 + 글래스모피즘 디자인

## ✅ 완료된 작업

### Session 시리즈 (초기 구축)

| 세션 | 내용 |
|------|------|
| Session 1 | 호스트 홈 — 세션 목록 탭 (Room API 연결) |
| Session 2 | 수업 결과 탭 + AI 리포트 화면 (ReportDetail, StudentReport) |
| Session 3 | 게스트 입장(/join) + 세션 대기(/waiting) |
| Session 4 | 버그 수정 — 학생 필기 미전송 / 입장 미표시 / socketService 세션 재연결 |
| Session 5 | 로그인 화면 (선생님/학생 선택) |
| Session 6 | 세션 개설 UI 개선 (비밀번호 + 초대링크) |
| Session 7 | 결과 화면 PDF 다운로드 (jsPDF + html2canvas) |
| Session 8-1 | 게스트 캔버스 neocast UI 이식 (수채화BG + 툴바 + 하단 컨트롤바) |
| Session 8-2 | 호스트 모니터링 뷰 neocast UI 이식 (그리드 기본뷰 + 하단 컨트롤바) |

### master_instructions_v2 시리즈 (main 기능 이식)

| STEP | 내용 | 상태 |
|------|------|------|
| STEP 1 | 호스트 세션 진입 — panel-store / page-store / demoStrokeStore main 구조 이식 | ✅ 완료 |
| STEP 2 | 페이지 기능 이식 — PagesButton + PagesPanel | ⬜ 예정 |
| STEP 3 | PDF 업로드 + 캔버스 우측 미리보기 패널 (60:40) | ⬜ 예정 |
| STEP 4 | 참가자 패널 이식 + 필기중 뱃지 | ⬜ 예정 |
| STEP 5 | 그리드뷰 수정 — 캔버스 전용 미니 프리뷰 + 전체화면 확대 | ⬜ 예정 |

## 🚀 시작하기

데모는 로컬 환경에서 간편하게 실행할 수 있도록 설계되었습니다.

### 사전 준비 사항

- Node.js (v18 이상 권장)
- npm 또는 yarn

### 빠른 실행 방법

루트 디렉토리에서 아래 명령어를 실행하세요:

```bash
sh demo-start.sh
```

이 스크립트는 다음 기능을 동시에 실행합니다:
- **서버 (Backend)**: [http://localhost:7191](http://localhost:7191)
- **클라이언트 (Frontend)**: [http://localhost:3000](http://localhost:3000)

### 개별 실행

```bash
# 서버 (port 7191)
cd server
npx tsx demo-server.ts

# 클라이언트 (port 3000)
cd client
npm run dev
```

## 📂 저장소 구조 (dev 브랜치)

- `/client`: 모니터링 뷰, 캔버스, 학생 리포트 등을 포함한 React 애플리케이션.
- `/server`: 세션 상태를 관리하고 소켓 연결을 처리하는 Node.js 서버 (`http://localhost:7191`).
- `demo-start.sh`: 원클릭 실행을 위한 쉘 스크립트.

---

## 🤖 Claude Code와 함께한 개발 프로세스

이 데모의 전체 구조와 실시간 로직, 그리고 프리미엄 UI 디자인은 **Claude Code**의 가이드에 따라 구축되었습니다.
- **자동화된 구현**: 바이너리 스트로크 처리와 같은 복잡한 로직의 신속한 프로토타이핑.
- **디자인 엑설런스**: 사용자 경험을 극대화하는 세련된 컬러 팔레트와 부드러운 애니메이션 적용.
- **통합된 개발 환경**: 기획부터 코드 작성, 테스트까지 일관된 컨텍스트 유지.

---

**브랜치 정보:** 현재 보시는 브랜치는 `dev`입니다. `main` 브랜치는 안정 버전 릴리즈를 위해 예약되어 있습니다.
