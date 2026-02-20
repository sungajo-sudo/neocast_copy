# NP2 파일 형식 (NeoCAST Paper v2)

## 개요

NP2(`.np2`)는 NeoCAST에서 사용하는 NCode PDF compound 파일 형식입니다.
PDF 문서, NPROJ 메타데이터, SOBP 정보를 하나의 JSON 파일로 묶어서 저장합니다.

## 파일명 규칙

```
{title}-{section}_{owner}_{book}_{pageStart}-{pageEnd}.np2
```

### 예시
- `회의록-5_255_0_0-9.np2`
- `설계도면-5_254_12_100-150.np2`
- `Meeting Notes-5_255_1_0-4.np2`

### 구성 요소
| 요소 | 설명 |
|------|------|
| `title` | 문서 제목 (특수문자 제외) |
| `section` | NCode Section (고정: 5) |
| `owner` | NCode Owner (255→0 역순 할당) |
| `book` | NCode Book (0-4095 순차 할당) |
| `pageStart` | 시작 페이지 번호 |
| `pageEnd` | 끝 페이지 번호 |

## 파일 구조

```json
{
  "version": "1.0",
  "hostId": "user-uuid-string",
  "hostName": "사용자 이름",
  "paperGroupId": "paper-uuid-string",
  "title": "문서 제목",
  "sobp": {
    "section": 5,
    "owner": 255,
    "book": 0,
    "pageStart": 0,
    "pageEnd": 9
  },
  "pageCount": 10,
  "nprojXml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>...",
  "pdfBase64": "JVBERi0xLjQKJeLjz9...",
  "createdAt": "2026-01-25T12:00:00.000Z"
}
```

## 필드 설명

### 메타데이터

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `version` | string | O | 파일 형식 버전 (현재 "1.0") |
| `hostId` | string | O | 문서 생성자의 사용자 ID (UUID) |
| `hostName` | string | X | 문서 생성자 이름 (공유 시 사용) |
| `paperGroupId` | string | O | Paper Group 고유 ID (UUID) |
| `title` | string | O | 문서 제목 |
| `createdAt` | string | O | 생성 시각 (ISO 8601 형식) |

### SOBP 정보

| 필드 | 타입 | 범위 | 설명 |
|------|------|------|------|
| `sobp.section` | number | 0-255 | NCode Section (NeoCAST: 5) |
| `sobp.owner` | number | 0-255 | NCode Owner (사용자별 역순 할당) |
| `sobp.book` | number | 0-4095 | NCode Book (12-bit) |
| `sobp.pageStart` | number | 0-4095 | 시작 페이지 (12-bit) |
| `sobp.pageEnd` | number | 0-4095 | 끝 페이지 (12-bit) |

### 콘텐츠

| 필드 | 타입 | 설명 |
|------|------|------|
| `pageCount` | number | 총 페이지 수 |
| `nprojXml` | string | NPROJ v2.4 XML 내용 |
| `pdfBase64` | string | PDF 파일의 Base64 인코딩 |

## SOBP 할당 규칙

NeoCAST는 사용자별로 SOBP 영역을 할당합니다.

### 할당 순서
1. **Page 순차**: 0 → 4095
2. **Book 순차**: Page overflow 시 Book 증가 (0 → 4095)
3. **Owner 역순**: Book overflow 시 Owner 감소 (255 → 0)

### 예시 시나리오
```
첫 번째 문서 (10페이지): Section=5, Owner=255, Book=0, Page=0-9
두 번째 문서 (5페이지):  Section=5, Owner=255, Book=0, Page=10-14
...
Page overflow 발생 시:   Section=5, Owner=255, Book=1, Page=0-...
...
Book overflow 발생 시:   Section=5, Owner=254, Book=0, Page=0-...
```

## NPROJ v2.4 형식

NP2에 포함되는 NPROJ XML 구조:

```xml
<?xml version="1.0" encoding="utf-8"?>
<nproj version="2.4">
  <title>문서 제목</title>
  <version>1</version>
  <section>5</section>
  <owner>255</owner>
  <book>0</book>
  <start_page>0</start_page>
  <end_page>9</end_page>
  <width>595.28</width>
  <height>841.89</height>
  <segment type="Paper">
    <x1>0</x1>
    <y1>0</y1>
    <x2>595.28</x2>
    <y2>841.89</y2>
    <crop_margin_left>0</crop_margin_left>
    <crop_margin_top>0</crop_margin_top>
    <crop_margin_right>0</crop_margin_right>
    <crop_margin_bottom>0</crop_margin_bottom>
  </segment>
  <pages>
    <page number="0">
      <x1>0</x1>
      <y1>0</y1>
      <x2>595.28</x2>
      <y2>841.89</y2>
    </page>
    <!-- ... 페이지별 항목 ... -->
  </pages>
</nproj>
```

### 페이지 크기 단위
- 포인트 (72 points = 1 inch)
- A4 기본값: 595.28 x 841.89 points

## 사용 사례

### 1. PDF 업로드 및 NP2 생성
```
클라이언트 → POST /api/nc-paperhub/allocate (페이지 수)
           ← SOBP 할당 정보 반환
클라이언트 → NPROJ 생성 (클라이언트 측)
클라이언트 → POST /api/nc-paperhub/attach (PDF + NPROJ)
           ← NP2 메타데이터 반환
```

### 2. NP2 다운로드
```
클라이언트 → GET /api/nc-paperhub/paper/{paperGroupId}/compound
           ← NP2 파일 다운로드
```

### 3. 채팅으로 공유
1. 발신자: NP2 파일을 채팅 메시지로 전송
2. 수신자: NP2 수신 및 Local PaperHub에 저장
3. 수신자: 해당 SOBP로 펜 입력 수신 가능

## 호환성

### 클라이언트 저장소
- **IndexedDB**: LocalPaperHub에서 NP2 데이터 저장
- **Blob Storage**: pdfBase64를 Blob으로 변환하여 저장

### MIME 타입
- `application/json` (JSON 기반 형식)

## 버전 히스토리

| 버전 | 날짜 | 변경 사항 |
|------|------|----------|
| 1.0 | 2026-01-25 | 초기 버전 |

## 관련 파일

| 파일 | 설명 |
|------|------|
| `Client/Web/src/services/local-paperhub.service.ts` | 클라이언트 NP2 처리 |
| `Client/Web/src/services/nproj-generator.service.ts` | NPROJ 생성 |
| `Server/src/services/nc-paperhub.service.ts` | 서버 SOBP 할당 |
| `Server/src/routes/nc-paperhub.ts` | API 라우트 |
