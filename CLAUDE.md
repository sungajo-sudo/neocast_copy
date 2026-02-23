# NeoCast Demo — Claude Code 작업 가이드

> **파일 경로**: `/Users/neolab/Desktop/neocast_claude/demo/CLAUDE.md`
> **기능 명세**: `/Users/neolab/Desktop/neocast_claude/demo/neocast_feature_spec_mvp.md`

---

## 프로젝트 구조

```
/Users/neolab/Desktop/neocast_claude/
├── NEOCAST_DEMO_PLAN_v2.md
├── neocast_copy-main/
└── demo/
    ├── CLAUDE.md                          ← 이 파일
    ├── neocast_feature_spec_mvp.md        ← 기능 명세서
    ├── client/          # React + Vite + TypeScript + Tailwind v4 (port 3000)
│   └── src/
│       ├── App.tsx              ← 라우팅 (/ = HostHome, /join, /waiting, /session, /report/...)
│       ├── pages/
│       │   ├── HostHome.tsx     ← 호스트 첫 화면 (세션목록 탭 / 수업결과 탭 / 설정 탭)
│       │   ├── GuestJoin.tsx    ← 학생 입장 (/join)
│       │   ├── GuestWaiting.tsx ← 세션 대기 폴링 (/waiting)
│       │   ├── ReportList.tsx   ← 수업 결과 목록 (호스트 홈 수업결과 탭 내부)
│       │   ├── ReportDetail.tsx ← 회차 AI 분석 요약 (/report/:archiveId)
│       │   ├── StudentReport.tsx← 학생 개인 AI 리포트 (/report/:archiveId/student/:studentId)
│       │   └── SessionPage.tsx  ← 캔버스 (⚠️ 건드리지 말 것)
│       ├── assets/
│       │   └── watercolor-bg.png
│       └── index.css            ← @import "tailwindcss" + keyframes
└── server/
    └── demo-server.ts           ← Express + Socket.IO (http://localhost:7191/demo)
```

---

## 라우팅 구조

```
/                              → HostHome (호스트 첫 화면 — 세션 목록 + 수업 결과 + 설정 탭)
/join                          → GuestJoin (학생 입장 — 코드 입력)
/waiting                       → GuestWaiting (세션 닫힘 대기 — 3초 폴링)
/session                       → SessionPage (캔버스 — ⚠️ 기존 코드 유지, 수정 금지)
/report/:archiveId             → ReportDetail (회차 AI 분석 전체 요약)
/report/:archiveId/student/:studentId → StudentReport (학생 개인 AI 리포트)
```

---

## 서버 정보

- **서버 베이스 URL**: `http://localhost:7191/demo`
- **Socket.IO 연결**: `http://localhost:7191` (path: `/demo/socket.io` 등 실제 서버 설정 따름)
- `useSessionStore`의 `socketUrl` 값도 `http://localhost:7191/demo` 기준으로 맞출 것

### Room(세션) API — 현재 사용 중
```
GET  /api/rooms?hostId=xxx          내 세션 목록
POST /api/rooms                     세션 생성 { hostId, hostNickname, name, schedule }
DELETE /api/rooms/:roomId           세션 삭제
POST /api/rooms/:roomId/open        세션 열기 → sessionId, userId, code 반환
POST /api/rooms/:roomId/close       세션 닫기 → 아카이브 저장 트리거
GET  /api/rooms/by-code/:code       코드로 Room 상태 확인 (게스트 폴링용)
```

### Session API — 하위호환용 (신규 기능에서는 Room API 우선 사용)
```
POST /api/sessions                  임시 세션 생성
POST /api/sessions/join             코드로 세션 참가
GET  /api/sessions/:sessionId       세션 정보 조회
```

---

## 디자인 스타일

- **배경**: `watercolor-bg.png` (opacity-60) + `bg-white/40` 오버레이
- **헤더**: `bg-white/70 backdrop-blur-md border-b border-white/50 h-14`
- **카드**: `bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl`
- **주요 버튼**: `bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl`
- **Tailwind**: v4 (`@tailwindcss/vite` 플러그인, `tailwind.config.js` 없음)
- **이미지 Import 방식**:
  ```tsx
  import watercolorBg from '../assets/watercolor-bg.png';
  // 사용: style={{ backgroundImage: `url(${watercolorBg})` }}
  ```

---

## 용어 정의

| 용어 | 설명 |
|------|------|
| 세션 | 고정 개설 수업 단위 (코드 고정, 반복 사용) |
| 세션 열기 | 호스트 활성화 → 학생 입장 가능 상태 |
| 세션 닫기 | 종료 → 회차 기록 자동 저장 |
| 회차 | 세션을 열고 닫을 때마다 생성되는 수업 기록 |
| 호스트 | 강사/선생님 |
| 게스트 | 학생 |

---

## 호스트 홈 탭 구조

```
NeoCAST 호스트 홈
├── 📋 세션 목록   ← 세션 카드 + 열기/닫기/만들기
├── 📊 수업 결과   ← 종료된 회차 목록 + AI 분석 리포트 진입점
└── ⚙️ 설정        ← 프로필명 변경, 비밀번호 변경, 언어 선택
```

---

## Claude Code 효율적 사용 전략

> **원칙: "한 번에 하나씩, 목업 데이터 먼저"** — 실제 API/AI 연결은 마지막에

### 작업 세션 분리 계획

| 세션 | 목표 | 구현 방식 |
|------|------|----------|
| **Session 1** | 호스트 홈 — 세션 목록 탭 | 목업 데이터 + Room API 연결 |
| **Session 2** | 호스트 홈 — 수업 결과 탭 + AI 리포트 화면 (FLOW 8) | 목업 데이터만 (차트 포함) |
| **Session 3** | 게스트 입장(/join) + 대기(/waiting) | Room API 연결 + 폴링 |
| **Session 4** | 버그 수정 — 학생 필기 미전송 / 입장 미표시 | 소켓 이벤트 디버깅 |
| **Session 5** | 로그인 화면 추가 | 선생님/학생 선택 버튼 2개 |
| **Session 6** | 세션 입장 UI 개선 | 코드+링크+비밀번호 입력 |
| **Session 7** | 결과 화면 PDF 다운로드 | jsPDF + html2canvas |

### Session별 시작 프롬프트

**Session 1 — 호스트 홈 (세션 목록 탭)**
```
FLOW 1 기준으로 HostHome.tsx 만들어줘.
- 탭: [세션 목록] [수업 결과] [설정]
- 세션 목록 탭: 세션 카드(이름/코드/열림·닫힘 상태 배지), 열기/닫기 버튼, + 새 세션 만들기
- Room API 연결, 목업 데이터로 먼저 렌더링 후 API fetch로 교체
- 디자인: 수채화 배경 + 글래스모피즘
끝나면 멈추고 기다려줘.
```

**Session 2 — 수업 결과 탭 + AI 리포트 화면**
```
FLOW 8 기준으로 아래 3개 화면 만들어줘.
- 수업 결과 탭: ReportList (HostHome 내부)
- 회차 AI 분석 요약: ReportDetail (/report/:archiveId)
- 학생 개인 AI 리포트: StudentReport (/report/:archiveId/student/:studentId)
- 실제 AI/API 연결 없이 MOCK 데이터로 화면만
- 레이더 차트는 SVG 또는 recharts, 참여도는 바 차트
끝나면 멈추고 기다려줘.
```

**Session 3 — 게스트 입장 + 대기**
```
GuestJoin.tsx(/join)과 GuestWaiting.tsx(/waiting) 만들어줘.
- GuestJoin: 닉네임 입력 + 6자리 코드 입력 → /api/rooms/by-code/:code 확인 후 입장
- GuestWaiting: 세션이 닫혀 있을 때 3초마다 폴링 → 열리면 /session으로 자동 이동
- 서버: http://localhost:7191/demo
끝나면 멈추고 기다려줘.
```

**Session 4 — 버그 수정**
```
아래 두 버그만 수정해줘. 다른 파일 건드리지 말고, 끝나면 어떤 파일 어디 고쳤는지 알려줘.

버그 1. 학생 필기가 선생님 화면에 안 보임
- 게스트 캔버스 스트로크 발생 시 소켓으로 호스트에게 전송되는지 확인
- 호스트 모니터링 뷰에서 게스트 스트로크 수신 후 렌더링하는지 확인
- 소켓 이벤트명 송수신 양쪽 일치 여부 확인

버그 2. 학생 입장해도 호스트 참가자 목록에 안 나타남
- 게스트 입장 시 소켓 join 이벤트 발생하는지 확인
- 호스트 측 참가자 목록 업데이트 로직 확인
- 서버 소켓 room 입장 처리 확인

끝나면 멈추고 기다려줘.
```

**Session 5 — 로그인 화면**
```
Login.tsx 새로 만들고 App.tsx 라우팅 수정해줘.
- 경로: / → Login.tsx, 기존 HostHome은 /host로 이동
- 화면: 버튼 2개만
  - [선생님으로 입장] → 이름 입력 후 /host 이동, localStorage에 role: 'host' 저장
  - [학생으로 입장] → 이름 입력 후 /join 이동, localStorage에 role: 'guest' 저장
- 이름 입력은 버튼 클릭 시 인라인 input으로 간단하게
- 디자인 수채화 배경 + 글래스모피즘 유지
끝나면 멈추고 기다려줘.
```

**Session 6 — 세션 개설 UI 개선**
```
HostHome.tsx의 세션 만들기 모달만 수정해줘. 다른 파일 건드리지 말 것.
- 세션 생성 시 비밀번호 자동 생성 (6자리 숫자, 재생성 버튼 포함)
- 세션 생성 완료 후 초대링크 + 입장코드 복사 버튼 노출
- SessionPage.tsx는 절대 수정 금지 (기존 판서 화면 UI 그대로 유지)
끝나면 멈추고 기다려줘.
```

**Session 7 — 결과 화면 PDF 다운로드**
```
ReportDetail.tsx 학생 목록 각 행에 [PDF 다운로드] 버튼 추가해줘.
- 해당 학생의 필기 캔버스 + 선생님 첨삭 레이어 합친 내용을 PDF로 저장
- 라이브러리: jsPDF + html2canvas 조합 사용
- 파일명: {학생이름}_{세션명}_{회차}.pdf
끝나면 멈추고 기다려줘.
```

---

## 목업 데이터 예시

```typescript
// 세션 목록 목업
const MOCK_SESSIONS = [
  { id: '1', name: '수학 월요일 오전반', schedule: '매주 월 09:00', code: '123456', isOpen: true, studentCount: 8 },
  { id: '2', name: '영어 화요일 오후반', schedule: '매주 화 14:00', code: '789012', isOpen: false, studentCount: 5 },
];

// 수업 결과(아카이브) 목업
const MOCK_ARCHIVES = [
  { id: 'a1', sessionName: '수학 월요일 오전반', round: 3, date: '2026.02.17', studentCount: 8, aiStatus: 'done' },
  { id: 'a2', sessionName: '수학 월요일 오전반', round: 2, date: '2026.02.10', studentCount: 7, aiStatus: 'done' },
  { id: 'a3', sessionName: '영어 화요일 오후반', round: 1, date: '2026.02.04', studentCount: 5, aiStatus: 'pending' },
];
// aiStatus: 'done' | 'pending' | 'none'

// 회차 AI 분석 요약 목업
const MOCK_REPORT_SUMMARY = {
  archiveId: 'a1',
  sessionName: '수학 월요일 오전반',
  round: 3,
  date: '2026.02.17',
  duration: '48분',
  totalStudents: 8,
  avgParticipation: 83,
  hostStrokePages: 5,
  students: [
    { id: 's1', name: '홍길동', duration: '45분', strokeVolume: '많음', annotationCount: 2, participationScore: 4 },
    { id: 's2', name: '김철수', duration: '30분', strokeVolume: '보통', annotationCount: 1, participationScore: 3 },
  ],
};

// 학생 개인 AI 리포트 목업
const MOCK_STUDENT_REPORT = {
  studentId: 's1',
  name: '홍길동',
  totalRounds: 3,
  totalMinutes: 135,
  // 레이더 차트용 (0~100)
  radar: {
    participation: 92,   // 참여도
    focus: 78,           // 집중력
    responsiveness: 85,  // 첨삭 반응성
    strokeVolume: 70,    // 필기량
  },
  focusPeriod: '초반',       // '초반' | '중반' | '후반'
  strokeSpeed: '보통',        // '빠름' | '보통' | '느림'
  annotationReflected: true,
  aiComment: '홍길동 학생은 수업 초반에 집중해서 필기했으며, 선생님의 첨삭 이후 내용을 보완하는 모습이 보입니다. 다음 수업에서는 후반부 집중력 유지를 권장합니다.',
  roundTrend: [65, 78, 92], // 회차별 참여도 추이
};
```

---

## 서버 실행

```bash
# 서버 (port 7191)
cd /Users/neolab/Desktop/neocast_claude/demo/server
npx tsx demo-server.ts

# 클라이언트 (port 3000)
cd /Users/neolab/Desktop/neocast_claude/demo/client
npm run dev
```

---

## 주의사항

- `SessionPage.tsx` 및 하위 컴포넌트(MonitoringView, GuestCanvas 등) — **절대 수정 금지**
- 서버 URL: `http://localhost:7191/demo` — 3001 포트 사용 금지
- `useSessionStore`의 `socketUrl` 기본값도 `http://localhost:7191/demo` 으로 맞출 것
- Tailwind v4 — `tailwind.config.js` 없음, `@tailwindcss/vite` 플러그인 방식
- localhost 저장 데이터: `nc_host_nickname`, `nc_host_id` (localStorage)
- Session API(`/api/sessions/...`)는 하위호환용 — 신규 기능은 Room API 사용
