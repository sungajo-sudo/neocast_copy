# NeoCast 작업 로그

> **중요**: 이 문서에 기록된 정상 작동 기능들은 절대 다른 기능과 충돌되어서는 안 됩니다.
> 새로운 기능 추가 시 반드시 이 로그를 참조하여 기존 기능을 보호해야 합니다.

---

## 2026-02-26: 스마트펜 연결 및 실시간 동기화 구현 (dev 브랜치)

### ✅ 구현 완료 기능 (절대 수정 금지 - 정상 작동 확인됨)

#### 1. 캔버스 크기 조정 (A4 세로 비율)
- **파일**:
  - `Client/src/components/GuestCanvas.tsx`
  - `Client/src/components/host-canvas/HostCanvas.tsx`
  - `Client/src/components/StudentMiniCanvas.tsx`
  - `Client/src/components/StudentDetailView.tsx`

- **변경 사항**:
  - 캔버스 크기: **700px × 990px** (A4 세로 비율 1:√2)
  - 학생 카드 크기: **350px × 346px** (A4 비율 70% 높이)
  - 상세 보기: **700px × 990px** (A4 세로 비율)

- **핵심 코드**:
  ```typescript
  const CANVAS_W = 700;
  const CANVAS_H = Math.round(CANVAS_W * Math.sqrt(2)); // 990
  ```

- **동작**: ✅ 호스트/게스트 모두 A4 세로 비율 캔버스 정상 표시

---

#### 2. 게스트 화면 레이아웃 (가로 배치)
- **파일**: `Client/src/components/GuestCanvas.tsx`

- **변경 사항**:
  - 선생님 판서(왼쪽) + 내 필기(오른쪽) 가로 배치
  - 선생님 판서 없을 때 내 필기 가운데 정렬
  - `flexDirection: 'row'`
  - `justifyContent: hostStrokes.length > 0 ? 'flex-start' : 'center'`

- **핵심 코드**:
  ```typescript
  <div style={{
      display: 'flex',
      flexDirection: 'row',
      justifyContent: hostStrokes.length > 0 ? 'flex-start' : 'center',
      gap: 20,
  }}>
      {/* 선생님 판서 */}
      {hostStrokes.length > 0 && <div>...</div>}
      {/* 내 필기 */}
      <div>...</div>
  </div>
  ```

- **동작**: ✅ 선생님 판서 표시 시 좌우 배치, 없을 때 가운데 정렬

---

#### 3. 스마트펜 Web Bluetooth 연결 (main 브랜치 이식)
- **새로운 파일**:
  - `Client/src/services/pen-protocol.ts` - NeoSmartpen Protocol V2
  - `Client/src/services/web-bluetooth.service.ts` - Web Bluetooth API 래퍼
  - `Client/src/services/neosmartpen.service.ts` - 펜 프로토콜 파싱
  - `Client/src/stores/pen-store.ts` - Zustand 펜 상태 관리
  - `Client/src/types/web-bluetooth.d.ts` - TypeScript 타입 정의

- **수정된 파일**:
  - `Client/src/components/control-bar/SmartpenButton.tsx`

- **기능**:
  - ✅ Web Bluetooth API 기반 NeoSmartpen 연결
  - ✅ 기기 스캔 및 페어링
  - ✅ 인증 및 비밀번호 처리
  - ✅ 배터리, 기기 정보 표시
  - ✅ 연결 상태별 UI 피드백 (초록색 도트 + 기기명)
  - ✅ 드롭다운 메뉴 (기기 정보, 비밀번호 입력, 연결 해제)

- **핵심 서비스**:
  ```typescript
  // Web Bluetooth 기기 연결
  webBluetoothService.requestDevice()
  webBluetoothService.connectDevice()

  // NeoSmartpen 프로토콜 처리
  neosmartpenService.onConnected()
  neosmartpenService.onDot()
  neosmartpenService.onBattery()
  ```

- **동작**: ✅ Chrome/Edge에서 실제 NeoSmartpen 연결 및 상태 표시

---

#### 4. 스마트펜 Dot 데이터 → Stroke 변환
- **새로운 파일**: `Client/src/services/pen-input.service.ts`

- **수정된 파일**:
  - `Client/src/components/MonitoringView.tsx` (펜 입력 서비스 초기화)
  - `Client/src/components/GuestCanvas.tsx` (펜 입력 서비스 초기화)

- **기능**:
  - ✅ NeoSmartpen dot 이벤트를 stroke로 변환
  - ✅ Ncode 좌표 → 72 DPI point 변환
  - ✅ DemoStrokeCanvas 렌더링 연동
  - ✅ PenDown/PenMove/PenUp 이벤트 처리

- **핵심 코드**:
  ```typescript
  // Ncode → Point 변환 상수
  const NCODE_TO_MM = 2.37066667;
  const INTERNAL_DPI = 72;
  const MM_TO_PT = INTERNAL_DPI / 25.4;
  const NCODE_TO_PT = NCODE_TO_MM * MM_TO_PT; // ≈ 6.72

  function ncodeToPoint(ncodeValue: number): number {
      return ncodeValue * NCODE_TO_PT;
  }
  ```

- **동작**: ✅ 물리 노트 필기 시 즉시 화면에 stroke 표시

---

#### 5. 선생님 스마트펜 필기 → 학생 화면 실시간 동기화
- **파일**: `Client/src/services/pen-input.service.ts`

- **변경 사항**:
  - 스마트펜 stroke 완료 시 localStorage 저장
  - 기존 마우스 필기와 동일한 저장 방식
  - 키: `nc_strokes_${sessionId}_${userId}`

- **핵심 코드**:
  ```typescript
  case DotType.PenUp:
      // localStorage에 저장
      const strokeKey = `nc_strokes_${sessionId}_${userId}`;
      const strokes = JSON.parse(localStorage.getItem(strokeKey) || '[]');
      strokes.push(newStroke);
      localStorage.setItem(strokeKey, JSON.stringify(strokes));
  ```

- **동작**: ✅ 선생님 스마트펜 필기 → 0.5초 이내 학생 "선생님 판서" 화면에 표시

---

#### 6. 호스트 캔버스 지우기 기능
- **파일**: `Client/src/components/host-canvas/HostCanvas.tsx`

- **기능**:
  - ✅ "지우기" 버튼 추가 (빨간색 테두리 + 휴지통 아이콘)
  - ✅ 확인 대화상자 (사용자 실수 방지)
  - ✅ demoStrokeStore 및 localStorage 동시 삭제
  - ✅ 학생 화면도 자동 동기화 (0.5초 이내)

- **핵심 코드**:
  ```typescript
  const handleClearCanvas = useCallback(() => {
      if (!confirm('캔버스의 모든 필기를 지우시겠습니까?')) return;

      // 스토어에서 지우기
      clearUserStrokes(userId);

      // localStorage에서도 지우기
      const strokeKey = `nc_strokes_${sessionId}_${userId}`;
      localStorage.removeItem(strokeKey);
  }, [userId, sessionId, clearUserStrokes]);
  ```

- **동작**: ✅ 호스트 캔버스 지우기 → 학생 화면도 동기화됨

---

#### 7. 학생 필기중 뱃지 (실시간 표시)
- **파일**:
  - `Client/src/components/StudentMiniCanvas.tsx` (뱃지 UI)
  - `Client/src/components/MonitoringView.tsx` (상태 폴링)
  - `Client/src/components/GuestCanvas.tsx` (마우스 필기 상태 저장)
  - `Client/src/services/pen-input.service.ts` (스마트펜 필기 상태 저장)

- **기능**:
  - ✅ 학생이 마우스 또는 스마트펜으로 필기 시작 → "✏️ 필기중" 초록 뱃지
  - ✅ 필기 완료 → 뱃지 사라짐
  - ✅ localStorage 기반 실시간 동기화 (0.5초 폴링)
  - ✅ 3초 타임아웃 (비정상 종료 대응)

- **핵심 코드**:
  ```typescript
  // 필기 시작 시
  localStorage.setItem(`nc_writing_${sessionId}_${userId}`, Date.now().toString());

  // 필기 완료 시
  localStorage.removeItem(`nc_writing_${sessionId}_${userId}`);

  // 호스트 폴링 (0.5초마다)
  const checkWritingStatus = () => {
      const now = Date.now();
      participants.forEach(p => {
          const timestamp = localStorage.getItem(`nc_writing_${sessionId}_${p.userId}`);
          if (timestamp && (now - parseInt(timestamp)) < 3000) {
              writing.add(p.userId);
          }
      });
  };
  ```

- **뱃지 우선순위**:
  1. **첨삭중 (빨강)**: 선생님이 첨삭 모드일 때 (최우선)
  2. **필기중 (초록)**: 학생이 stroke 그리는 중
  3. **없음**: idle 상태

- **동작**: ✅ 학생 필기 시작 → 0.5초 이내 호스트 그리드에 뱃지 표시

---

### 📁 파일 구조 (새로 추가된 파일)

```
Client/src/
├── services/
│   ├── pen-protocol.ts              ← 새 파일 (NeoSmartpen 프로토콜)
│   ├── web-bluetooth.service.ts     ← 새 파일 (Web Bluetooth API)
│   ├── neosmartpen.service.ts       ← 새 파일 (펜 데이터 파싱)
│   └── pen-input.service.ts         ← 새 파일 (Dot→Stroke 변환)
├── stores/
│   └── pen-store.ts                 ← 새 파일 (펜 상태 관리)
├── types/
│   └── web-bluetooth.d.ts           ← 새 파일 (TypeScript 타입)
└── components/
    ├── control-bar/
    │   └── SmartpenButton.tsx       ← 수정 (드롭다운 메뉴 추가)
    ├── host-canvas/
    │   └── HostCanvas.tsx           ← 수정 (지우기 버튼 추가)
    ├── GuestCanvas.tsx              ← 수정 (레이아웃, 필기중 상태)
    ├── MonitoringView.tsx           ← 수정 (필기중 뱃지 폴링)
    ├── StudentMiniCanvas.tsx        ← 수정 (필기중 뱃지 UI)
    └── StudentDetailView.tsx        ← 수정 (A4 크기)
```

---

### 🔒 보호해야 할 핵심 로직 (절대 변경 금지)

#### 1. localStorage 키 규칙
```
nc_strokes_${sessionId}_${userId}     - 완료된 stroke 저장
nc_writing_${sessionId}_${userId}     - 필기중 상태 (timestamp)
nc_participants_${sessionId}           - 참가자 목록
nc_annotations_${sessionId}_${userId}  - 첨삭 데이터
```

#### 2. 폴링 주기
```typescript
호스트 스트로크 폴링: 500ms (0.5초)
참가자 목록 폴링: 1000ms (1초)
필기중 상태 폴링: 500ms (0.5초)
첨삭 데이터 폴링: 500ms (0.5초)
```

#### 3. Ncode 좌표 변환
```typescript
NCODE_TO_PT = 2.37066667 × (72/25.4) ≈ 6.72
```
**절대 변경 금지** - NeoLAB 공식 변환 상수

#### 4. 캔버스 크기
```typescript
CANVAS_W = 700
CANVAS_H = Math.round(CANVAS_W * Math.sqrt(2)) // 990
```
**절대 변경 금지** - A4 세로 비율

---

### ⚠️ 회귀 방지 체크리스트

새로운 기능 추가 시 다음을 반드시 확인:

- [ ] localStorage 키 규칙 준수
- [ ] 폴링 주기 변경하지 않음
- [ ] Ncode 변환 상수 유지
- [ ] 캔버스 크기 비율 유지
- [ ] 스마트펜 연결 프로토콜 유지
- [ ] 기존 stroke 렌더링 로직 보호
- [ ] 필기중 뱃지 로직 보호

---

### 🧪 테스트 완료 항목

- [x] 스마트펜 연결 (Neo smartpen N2, Dimo)
- [x] 물리 노트 필기 → 화면 표시
- [x] 선생님 스마트펜 → 학생 화면 동기화
- [x] 마우스 필기 → 학생 화면 동기화
- [x] 호스트 캔버스 지우기
- [x] 학생 필기중 뱃지 (마우스)
- [x] 학생 필기중 뱃지 (스마트펜)
- [x] A4 세로 비율 캔버스
- [x] 가로 레이아웃 (선생님 판서 + 내 필기)
- [x] TypeScript 컴파일 에러 없음
- [x] 브라우저: Chrome, Edge (Web Bluetooth 지원)

---

### 📝 기술 스택

- **Frontend**: React 19, TypeScript, Vite, Zustand
- **실시간 동기화**: localStorage 폴링 (0.5s~1s)
- **스마트펜**: Web Bluetooth API, NeoSmartpen Protocol V2
- **좌표 변환**: Ncode → 72 DPI Point
- **캔버스**: HTML5 Canvas, A4 세로 비율

---

### 🎯 다음 작업 시 주의사항

1. **절대 수정 금지**:
   - localStorage 키 규칙
   - 폴링 주기
   - Ncode 변환 상수
   - 캔버스 크기/비율
   - 스마트펜 프로토콜

2. **확장 가능**:
   - 새로운 펜 타입 추가 (형광펜, 지우개 등)
   - 색상/굵기 프리셋 추가
   - 추가 뱃지/상태 표시
   - 새로운 동기화 데이터 (별도 키 사용)

3. **테스트 필수**:
   - 기존 기능 회귀 테스트
   - 스마트펜 연결 테스트
   - 실시간 동기화 테스트
   - 크로스 브라우저 테스트

---

### 📞 문제 발생 시

이 로그에 기록된 기능이 작동하지 않으면:
1. 이 커밋으로 롤백
2. 새 기능과 충돌 지점 파악
3. 이 로그의 "보호해야 할 핵심 로직" 확인
4. 회귀 방지 체크리스트 수행

---

**작성일**: 2026-02-26
**브랜치**: dev
**작성자**: Claude Code Assistant
**상태**: ✅ 전체 기능 정상 작동 확인 완료
