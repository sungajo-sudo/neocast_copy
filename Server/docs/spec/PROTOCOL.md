# PenStreamServer 바이너리 프로토콜 명세서

## 1. 개요

### 1.1 프로토콜 특징

- **전송 방식**: WebSocket (Socket.io) Binary
- **바이트 순서**: Little Endian
- **문자 인코딩**: UTF-8
- **UUID 형식**: 16바이트 바이너리 (RFC 4122)

### 1.2 네임스페이스

| 네임스페이스 | 용도 | 데이터 형식 |
|-------------|------|------------|
| `/stroke` | 필기 데이터 | Binary |
| `/voice` | 음성 데이터 | Binary |
| `/control` | 제어 메시지 | JSON |

---

## 2. 기본 데이터 타입

### 2.1 Primitive Types

| 타입 | 크기 | 범위 | 설명 |
|------|------|------|------|
| `uint8` | 1 byte | 0 ~ 255 | 부호 없는 8비트 정수 |
| `uint16` | 2 bytes | 0 ~ 65,535 | 부호 없는 16비트 정수 (LE) |
| `uint32` | 4 bytes | 0 ~ 4,294,967,295 | 부호 없는 32비트 정수 (LE) |
| `int32` | 4 bytes | -2^31 ~ 2^31-1 | 부호 있는 32비트 정수 (LE) |
| `int64` | 8 bytes | -2^63 ~ 2^63-1 | 부호 있는 64비트 정수 (LE) |
| `float32` | 4 bytes | IEEE 754 | 32비트 부동소수점 (LE) |
| `float64` | 8 bytes | IEEE 754 | 64비트 부동소수점 (LE) |

### 2.2 Complex Types

#### UUID (16 bytes)

```
바이트 배열 형식 (RFC 4122 binary representation)
예: 550e8400-e29b-41d4-a716-446655440000

Offset  Size  Field
------  ----  -----
0       4     time_low
4       2     time_mid
6       2     time_hi_and_version
8       1     clock_seq_hi_and_reserved
9       1     clock_seq_low
10      6     node

총 16 bytes
```

#### Color (ARGB, 4 bytes)

```
Offset  Size  Field
------  ----  -----
0       1     Blue    (0-255)
1       1     Green   (0-255)
2       1     Red     (0-255)
3       1     Alpha   (0-255, 255=불투명)

총 4 bytes (Little Endian uint32)

예: 빨간색 (불투명) = 0xFFFF0000
    → 메모리: [00, 00, FF, FF]
```

#### String (가변 길이)

```
Offset  Size    Field
------  ----    -----
0       2       Length      (uint16, 바이트 수)
2       N       Data        (UTF-8 인코딩)

총 2 + N bytes
```

---

## 3. 메시지 타입 코드

### 3.1 클라이언트 → 서버 (Client to Server)

| Code | Name | Description |
|------|------|-------------|
| `0x01` | `STROKE_START` | 새 스트로크 시작 |
| `0x02` | `STROKE_POINT` | 스트로크 점 데이터 |
| `0x03` | `STROKE_END` | 스트로크 종료 |
| `0x04` | `STROKE_CANCEL` | 스트로크 취소 |
| `0x10` | `PAGE_CHANGE` | 페이지 변경 |
| `0x11` | `PAGE_ADD` | 페이지 추가 |
| `0x12` | `PAGE_DELETE` | 페이지 삭제 |
| `0x20` | `CLEAR_PAGE` | 현재 페이지 지우기 |
| `0x21` | `CLEAR_ALL` | 전체 지우기 |
| `0x22` | `UNDO` | 실행 취소 |
| `0x23` | `REDO` | 다시 실행 |
| `0x30` | `POINTER_MOVE` | 포인터/레이저 위치 |
| `0x31` | `POINTER_ON` | 포인터 켜기 |
| `0x32` | `POINTER_OFF` | 포인터 끄기 |

### 3.2 서버 → 클라이언트 (Server to Client)

| Code | Name | Description |
|------|------|-------------|
| `0xF0` | `WRAPPED` | 다른 사용자의 메시지 래핑 |
| `0xF1` | `HISTORY_START` | 히스토리 동기화 시작 |
| `0xF2` | `HISTORY_STROKE` | 히스토리 스트로크 데이터 |
| `0xF3` | `HISTORY_END` | 히스토리 동기화 완료 |
| `0xE0` | `ERROR` | 에러 메시지 |
| `0xE1` | `ACK` | 확인 응답 |

### 3.3 음성 메시지 (Voice Namespace)

| Code | Name | Description |
|------|------|-------------|
| `0x80` | `VOICE_DATA` | 음성 프레임 데이터 |
| `0x81` | `VOICE_START` | 음성 전송 시작 |
| `0x82` | `VOICE_END` | 음성 전송 종료 |
| `0x83` | `VOICE_MUTE` | 음소거 |
| `0x84` | `VOICE_UNMUTE` | 음소거 해제 |

---

## 4. 스트로크 메시지 상세

### 4.1 STROKE_START (0x01)

새로운 스트로크(획)의 시작을 알림

```
┌─────────────────────────────────────────────────────────────┐
│                     STROKE_START Packet                     │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0x01)                               │
│   1    │  16    │ StrokeId (UUID)                           │
│  17    │   4    │ PageId (uint32)                           │
│  21    │   4    │ Color (ARGB uint32)                       │
│  25    │   4    │ Thickness (float32, mm 단위)              │
│  29    │   1    │ PenType (uint8)                           │
│  30    │   1    │ Flags (uint8)                             │
│  31    │   8    │ Timestamp (int64, Unix ms)                │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 39 bytes                                             │
└─────────────────────────────────────────────────────────────┘
```

**PenType 값:**

| Value | Name | Description |
|-------|------|-------------|
| 0 | PEN | 일반 펜 |
| 1 | HIGHLIGHTER | 형광펜 (반투명) |
| 2 | ERASER | 지우개 |
| 3 | BRUSH | 브러시 |

**Flags 비트 필드:**

| Bit | Name | Description |
|-----|------|-------------|
| 0 | PRESSURE_SENSITIVE | 필압 감지 사용 |
| 1 | TILT_SENSITIVE | 기울기 감지 사용 |
| 2-7 | Reserved | 예약됨 (0으로 설정) |

**예시 (Hex Dump):**

```
01                              # Type: STROKE_START
550E8400E29B41D4A716446655440000  # StrokeId: UUID
01 00 00 00                     # PageId: 1
00 00 FF FF                     # Color: Red (ARGB)
00 00 80 3F                     # Thickness: 1.0mm
00                              # PenType: PEN
01                              # Flags: PRESSURE_SENSITIVE
88 77 66 55 44 33 22 11         # Timestamp: Unix ms
```

---

### 4.2 STROKE_POINT (0x02)

스트로크의 개별 점 데이터

```
┌─────────────────────────────────────────────────────────────┐
│                     STROKE_POINT Packet                     │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0x02)                               │
│   1    │  16    │ StrokeId (UUID)                           │
│  17    │   4    │ X (float32, mm)                           │
│  21    │   4    │ Y (float32, mm)                           │
│  25    │   2    │ Pressure (uint16, 0~65535)                │
│  27    │   8    │ Timestamp (int64, Unix ms)                │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 35 bytes                                             │
└─────────────────────────────────────────────────────────────┘
```

**좌표계:**

```
(0,0) ─────────────────────────► X (mm)
  │
  │    페이지 좌표계
  │    - 원점: 좌측 상단
  │    - 단위: 밀리미터 (mm)
  │    - A4 기준: 210mm x 297mm
  │
  ▼
  Y (mm)
```

**Pressure 값:**

| 값 | 백분율 | 설명 |
|----|--------|------|
| 0 | 0% | 최소 필압 (hover) |
| 32768 | 50% | 중간 필압 |
| 65535 | 100% | 최대 필압 |

**예시 (Hex Dump):**

```
02                              # Type: STROKE_POINT
550E8400E29B41D4A716446655440000  # StrokeId: UUID
00 00 48 43                     # X: 200.0mm
00 00 96 43                     # Y: 300.0mm
00 80                           # Pressure: 32768 (50%)
88 77 66 55 44 33 22 11         # Timestamp: Unix ms
```

---

### 4.3 STROKE_POINT_BATCH (0x05) - 배치 전송 최적화

여러 점을 한번에 전송 (네트워크 효율화)

```
┌─────────────────────────────────────────────────────────────┐
│                  STROKE_POINT_BATCH Packet                  │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0x05)                               │
│   1    │  16    │ StrokeId (UUID)                           │
│  17    │   2    │ PointCount (uint16)                       │
│  19    │  18*N  │ Points[] (N개의 Point 데이터)             │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 19 + (18 * PointCount) bytes                         │
└─────────────────────────────────────────────────────────────┘

Point 구조 (18 bytes):
┌────────┬────────┬───────────────────────────────────────────┐
│   0    │   4    │ X (float32, mm)                           │
│   4    │   4    │ Y (float32, mm)                           │
│   8    │   2    │ Pressure (uint16, 0~65535)                │
│  10    │   8    │ Timestamp (int64, Unix ms)                │
└────────┴────────┴───────────────────────────────────────────┘
```

---

### 4.4 STROKE_END (0x03)

스트로크 완료

```
┌─────────────────────────────────────────────────────────────┐
│                      STROKE_END Packet                      │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0x03)                               │
│   1    │  16    │ StrokeId (UUID)                           │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 17 bytes                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 4.5 STROKE_CANCEL (0x04)

진행 중인 스트로크 취소 (예: 지우개로 변경 시)

```
┌─────────────────────────────────────────────────────────────┐
│                    STROKE_CANCEL Packet                     │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0x04)                               │
│   1    │  16    │ StrokeId (UUID)                           │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 17 bytes                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 페이지 관련 메시지

### 5.1 PAGE_CHANGE (0x10)

현재 페이지 변경

```
┌─────────────────────────────────────────────────────────────┐
│                     PAGE_CHANGE Packet                      │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0x10)                               │
│   1    │   4    │ PageId (uint32)                           │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 5 bytes                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 PAGE_ADD (0x11)

새 페이지 추가

```
┌─────────────────────────────────────────────────────────────┐
│                      PAGE_ADD Packet                        │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0x11)                               │
│   1    │   4    │ PageId (uint32)                           │
│   5    │   4    │ Width (float32, mm)                       │
│   9    │   4    │ Height (float32, mm)                      │
│  13    │   1    │ PageType (uint8)                          │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 14 bytes                                             │
└─────────────────────────────────────────────────────────────┘
```

**PageType 값:**

| Value | Name | Description |
|-------|------|-------------|
| 0 | BLANK | 빈 페이지 |
| 1 | LINED | 줄 노트 |
| 2 | GRID | 모눈 |
| 3 | DOT | 점선 |

---

## 6. 편집 명령 메시지

### 6.1 UNDO (0x22)

실행 취소

```
┌─────────────────────────────────────────────────────────────┐
│                        UNDO Packet                          │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0x22)                               │
│   1    │   4    │ PageId (uint32)                           │
│   5    │   2    │ Count (uint16, 취소할 개수)               │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 7 bytes                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 REDO (0x23)

다시 실행

```
┌─────────────────────────────────────────────────────────────┐
│                        REDO Packet                          │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0x23)                               │
│   1    │   4    │ PageId (uint32)                           │
│   5    │   2    │ Count (uint16, 다시 실행할 개수)          │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 7 bytes                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 CLEAR_PAGE (0x20)

현재 페이지 모든 스트로크 삭제

```
┌─────────────────────────────────────────────────────────────┐
│                     CLEAR_PAGE Packet                       │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0x20)                               │
│   1    │   4    │ PageId (uint32)                           │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 5 bytes                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 포인터/레이저 메시지

### 7.1 POINTER_MOVE (0x30)

포인터 위치 업데이트 (실시간)

```
┌─────────────────────────────────────────────────────────────┐
│                    POINTER_MOVE Packet                      │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0x30)                               │
│   1    │   4    │ PageId (uint32)                           │
│   5    │   4    │ X (float32, mm)                           │
│   9    │   4    │ Y (float32, mm)                           │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 13 bytes                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 POINTER_ON (0x31)

포인터 활성화

```
┌─────────────────────────────────────────────────────────────┐
│                     POINTER_ON Packet                       │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0x31)                               │
│   1    │   1    │ PointerType (uint8)                       │
│   2    │   4    │ Color (ARGB uint32)                       │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 7 bytes                                              │
└─────────────────────────────────────────────────────────────┘
```

**PointerType 값:**

| Value | Name | Description |
|-------|------|-------------|
| 0 | DOT | 점 포인터 |
| 1 | LASER | 레이저 포인터 (자취 표시) |
| 2 | SPOTLIGHT | 스포트라이트 |

---

## 8. 서버 메시지

### 8.1 WRAPPED (0xF0)

다른 사용자의 메시지를 래핑하여 전송

```
┌─────────────────────────────────────────────────────────────┐
│                      WRAPPED Packet                         │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0xF0)                               │
│   1    │  16    │ SenderId (UUID, 원본 송신자)              │
│  17    │   4    │ PayloadLength (uint32)                    │
│  21    │   N    │ Payload (원본 패킷 데이터)                │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 21 + N bytes                                         │
└─────────────────────────────────────────────────────────────┘
```

**예시:**

```
// Host가 보낸 STROKE_POINT를 Guest에게 전달
F0                              # Type: WRAPPED
AABBCCDD...                     # SenderId: Host's UUID (16 bytes)
25 00 00 00                     # PayloadLength: 37
02 550E8400...                  # Payload: 원본 STROKE_POINT (37 bytes)
```

---

### 8.2 HISTORY_START (0xF1)

히스토리 동기화 시작 (늦게 참여한 사용자용)

```
┌─────────────────────────────────────────────────────────────┐
│                    HISTORY_START Packet                     │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0xF1)                               │
│   1    │   4    │ TotalStrokes (uint32)                     │
│   5    │   4    │ TotalPages (uint32)                       │
│   9    │   1    │ FromArchive (uint8, bool)                 │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 10 bytes                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 HISTORY_STROKE (0xF2)

히스토리 스트로크 (압축된 완성 스트로크)

```
┌─────────────────────────────────────────────────────────────┐
│                   HISTORY_STROKE Packet                     │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0xF2)                               │
│   1    │  16    │ StrokeId (UUID)                           │
│  17    │  16    │ UserId (UUID, 작성자)                     │
│  33    │   4    │ PageId (uint32)                           │
│  37    │   4    │ Color (ARGB uint32)                       │
│  41    │   4    │ Thickness (float32)                       │
│  45    │   1    │ PenType (uint8)                           │
│  46    │   4    │ CompressedLength (uint32)                 │
│  50    │   N    │ CompressedPoints (Brotli 압축)            │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 50 + N bytes                                         │
└─────────────────────────────────────────────────────────────┘
```

**CompressedPoints 형식 (압축 해제 후):**

```
Delta-encoded point array:
┌─────────────────────────────────────────────────────────────┐
│ uint16   PointCount                                         │
│ int16[]  DeltaX (첫 번째는 절대값 * 100)                    │
│ int16[]  DeltaY (첫 번째는 절대값 * 100)                    │
│ uint8[]  Pressure (0-255, scaled from 0.0-1.0)              │
│ uint16[] DeltaTime (첫 번째는 0)                            │
└─────────────────────────────────────────────────────────────┘
```

### 8.4 HISTORY_END (0xF3)

히스토리 동기화 완료

```
┌─────────────────────────────────────────────────────────────┐
│                     HISTORY_END Packet                      │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0xF3)                               │
│   1    │   4    │ SyncedStrokes (uint32)                    │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 5 bytes                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### 8.5 ERROR (0xE0)

에러 메시지

```
┌─────────────────────────────────────────────────────────────┐
│                       ERROR Packet                          │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0xE0)                               │
│   1    │   2    │ ErrorCode (uint16)                        │
│   3    │   2    │ MessageLength (uint16)                    │
│   5    │   N    │ Message (UTF-8 string)                    │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 5 + N bytes                                          │
└─────────────────────────────────────────────────────────────┘
```

**ErrorCode 값:**

| Code | Name | Description |
|------|------|-------------|
| 1001 | SESSION_NOT_FOUND | 세션을 찾을 수 없음 |
| 1002 | SESSION_CLOSED | 세션이 종료됨 |
| 1003 | SESSION_FULL | 세션 인원 초과 |
| 2001 | PERMISSION_DENIED | 권한 없음 |
| 2002 | NOT_HOST | 호스트 권한 필요 |
| 3001 | INVALID_PACKET | 잘못된 패킷 형식 |
| 3002 | INVALID_STROKE_ID | 잘못된 스트로크 ID |
| 4001 | RATE_LIMITED | 요청 제한 초과 |

---

## 9. 음성 메시지

### 9.1 VOICE_DATA (0x80)

음성 프레임 데이터

```
┌─────────────────────────────────────────────────────────────┐
│                     VOICE_DATA Packet                       │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0x80)                               │
│   1    │   4    │ SequenceNumber (uint32)                   │
│   5    │   8    │ Timestamp (int64, Unix ms)                │
│  13    │   2    │ DataLength (uint16)                       │
│  15    │   N    │ OpusFrame (Opus 인코딩 데이터)            │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 15 + N bytes                                         │
└─────────────────────────────────────────────────────────────┘
```

**음성 설정:**

| 항목 | 값 |
|------|-----|
| Codec | Opus |
| Sample Rate | 48000 Hz |
| Channels | 1 (Mono) |
| Frame Size | 20ms (960 samples) |
| Bitrate | 24000 bps (권장) |

### 9.2 VOICE_START (0x81)

```
┌─────────────────────────────────────────────────────────────┐
│                     VOICE_START Packet                      │
├────────┬────────┬───────────────────────────────────────────┤
│ Offset │  Size  │                  Field                    │
├────────┼────────┼───────────────────────────────────────────┤
│   0    │   1    │ Type (0x81)                               │
│   1    │   4    │ SampleRate (uint32)                       │
│   5    │   1    │ Channels (uint8)                          │
├────────┴────────┴───────────────────────────────────────────┤
│ Total: 6 bytes                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Control 채널 (JSON)

`/control` 네임스페이스는 JSON 형식 사용

### 10.1 세션 상태 변경

```json
{
  "type": "SESSION_STATUS",
  "status": "active" | "paused" | "closed",
  "timestamp": 1704067200000
}
```

### 10.2 참가자 이벤트

```json
{
  "type": "PARTICIPANT_JOIN",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "userName": "홍길동",
  "role": "host" | "guest",
  "timestamp": 1704067200000
}

{
  "type": "PARTICIPANT_LEAVE",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "disconnect" | "kicked" | "left",
  "timestamp": 1704067200000
}
```

### 10.3 권한 변경

```json
{
  "type": "PERMISSION_CHANGED",
  "guestId": "550e8400-e29b-41d4-a716-446655440000",
  "canReceiveFrom": [
    "host-uuid-here",
    "other-guest-uuid"
  ],
  "timestamp": 1704067200000
}
```

### 10.4 히스토리 동기화 알림

```json
{
  "type": "HISTORY_SYNC_START",
  "totalStrokes": 150,
  "totalPages": 3,
  "fromArchive": true,
  "linkedArchiveIds": ["archive-uuid-1", "archive-uuid-2"]
}

{
  "type": "HISTORY_SYNC_PROGRESS",
  "syncedStrokes": 75,
  "totalStrokes": 150,
  "percentage": 50
}

{
  "type": "HISTORY_SYNC_END",
  "syncedStrokes": 150,
  "duration": 2500
}
```

---

## 11. 구현 예시 (TypeScript)

### 11.1 BinaryReader

```typescript
export class BinaryReader {
  private offset = 0;
  private view: DataView;

  constructor(private buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  readUint8(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readUint16(): number {
    const value = this.view.getUint16(this.offset, true); // Little Endian
    this.offset += 2;
    return value;
  }

  readUint32(): number {
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readFloat32(): number {
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readInt64(): bigint {
    const value = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readUUID(): string {
    const bytes = new Uint8Array(this.buffer, this.offset, 16);
    this.offset += 16;
    return uuidFromBytes(bytes);
  }

  readBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return bytes;
  }
}

function uuidFromBytes(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
```

### 11.2 BinaryWriter

```typescript
export class BinaryWriter {
  private chunks: ArrayBuffer[] = [];
  private totalSize = 0;

  writeUint8(value: number): this {
    const buf = new ArrayBuffer(1);
    new DataView(buf).setUint8(0, value);
    this.chunks.push(buf);
    this.totalSize += 1;
    return this;
  }

  writeUint16(value: number): this {
    const buf = new ArrayBuffer(2);
    new DataView(buf).setUint16(0, value, true);
    this.chunks.push(buf);
    this.totalSize += 2;
    return this;
  }

  writeUint32(value: number): this {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setUint32(0, value, true);
    this.chunks.push(buf);
    this.totalSize += 4;
    return this;
  }

  writeFloat32(value: number): this {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, value, true);
    this.chunks.push(buf);
    this.totalSize += 4;
    return this;
  }

  writeInt64(value: bigint): this {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigInt64(0, value, true);
    this.chunks.push(buf);
    this.totalSize += 8;
    return this;
  }

  writeUUID(uuid: string): this {
    const bytes = uuidToBytes(uuid);
    this.chunks.push(bytes.buffer);
    this.totalSize += 16;
    return this;
  }

  toArrayBuffer(): ArrayBuffer {
    const result = new Uint8Array(this.totalSize);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    return result.buffer;
  }
}

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
```

### 11.3 메시지 파싱 예시

```typescript
import { MessageType } from './message-types';
import { BinaryReader } from './binary-reader';

export function parseMessage(buffer: ArrayBuffer) {
  const reader = new BinaryReader(buffer);
  const type = reader.readUint8();

  switch (type) {
    case MessageType.STROKE_START:
      return {
        type: 'STROKE_START',
        strokeId: reader.readUUID(),
        pageId: reader.readUint32(),
        color: reader.readUint32(),
        thickness: reader.readFloat32(),
        penType: reader.readUint8(),
        flags: reader.readUint8(),
        timestamp: reader.readInt64(),  // Unix ms
      };

    case MessageType.STROKE_POINT:
      return {
        type: 'STROKE_POINT',
        strokeId: reader.readUUID(),
        x: reader.readFloat32(),
        y: reader.readFloat32(),
        pressure: reader.readUint16(),  // 0~65535 (65535 = 100%)
        timestamp: reader.readInt64(),
      };

    case MessageType.STROKE_END:
      return {
        type: 'STROKE_END',
        strokeId: reader.readUUID(),
      };

    case MessageType.WRAPPED:
      const senderId = reader.readUUID();
      const payloadLength = reader.readUint32();
      const payload = reader.readBytes(payloadLength);
      return {
        type: 'WRAPPED',
        senderId,
        payload: parseMessage(payload.buffer),
      };

    default:
      throw new Error(`Unknown message type: 0x${type.toString(16)}`);
  }
}
```

---

## 12. 버전 호환성

### 12.1 프로토콜 버전

현재 버전: **1.0**

연결 시 버전 협상:
```json
// 클라이언트 → 서버 (연결 시 handshake)
{
  "protocolVersion": "1.0",
  "clientVersion": "1.2.3",
  "platform": "windows" | "macos" | "android" | "ios"
}

// 서버 → 클라이언트
{
  "protocolVersion": "1.0",
  "serverVersion": "1.0.0",
  "compatible": true
}
```

### 12.2 하위 호환성 규칙

- 새 필드는 패킷 끝에 추가
- 기존 필드의 오프셋/크기 변경 금지
- 새 메시지 타입은 미사용 코드 사용
- Reserved 필드는 0으로 설정

---

*문서 버전: 1.0*
*최종 수정: 2026-01-09*
