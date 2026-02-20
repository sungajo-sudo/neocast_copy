# 랜딩 페이지 i18n 완성 및 RTL 언어 지원 개선

## 변경 일자
2026-01-26

## 변경 요약
랜딩 페이지에 새로 추가된 섹션(newConcept, targetAudience, technology)의 다국어 번역을 15개 언어에 완성하고, 아랍어(RTL) 환경에서 언어 선택 팝업이 화면을 벗어나는 문제를 수정했습니다.

## 변경 통계
- 수정된 파일: 21개
- 추가된 이미지: 6개
- 총 변경 라인: +1,206 / -72

---

## 1. 랜딩 페이지 개선

### LandingPage.tsx
- **새 섹션 추가**: Ncode Concept, Target Audience, Technology 섹션 추가
- **인증 상태 인식**: 로그인 상태에 따라 버튼 동작 변경 (로비로 이동 vs 로그인 페이지)
- **헤더 로고 제거**: 글로벌 헤더 사용으로 중복 로고 제거
- **이미지 레이아웃 조정**: 이미지 너비를 80%로 조정하여 균형 개선

### 추가된 이미지
- `ncode-concept.png`: Ncode 개념 설명 이미지
- `target-audience.png`: 타겟 오디언스 이미지
- `tech-ncode.png`, `tech-smartpen.png`, `tech-paperhub.png`, `tech-pod.png`: 기술 소개 이미지

---

## 2. 다국어(i18n) 완성 - 15개 언어

### 추가된 번역 키
```
landing.newConcept.title/subtitle/description/feature1/feature2
landing.targetAudience.title/subtitle/description
landing.targetAudience.educator/tutor/consultant/counselor (title, description)
landing.technology.title/subtitle
landing.technology.ncode/smartpen/paperhub/pod (title, concept, description)
landing.technology.footer (company, description)
auth.rememberEmail
```

### 번역 완료 언어
| 언어 | 파일 |
|------|------|
| 한국어 | ko.json |
| 영어 (US) | en-US.json |
| 영어 (UK) | en-GB.json |
| 일본어 | ja.json |
| 중국어 간체 | zh-CN.json |
| 중국어 번체 | zh-TW.json |
| 독일어 | de.json |
| 프랑스어 | fr.json |
| 스페인어 | es.json |
| 필리핀어 | fil.json |
| 인도네시아어 | id.json |
| 말레이어 | ms.json |
| 태국어 | th.json |
| 베트남어 | vi.json |
| 아랍어 | ar.json |

### 구조 수정
- technology 섹션의 잘못된 구조 수정 (7개 언어 파일)
  - 기존: `{ title, company, concept }` + `footer: { title, description }`
  - 수정: `{ title, concept, description }` + `footer: { company, description }`

---

## 3. RTL(아랍어) 지원 개선

### LanguageSelector.tsx
- **문제**: 아랍어(RTL) 환경에서 언어 선택 팝업이 화면 왼쪽으로 벗어남
- **원인**: 드롭다운이 `right-0`으로 고정되어 RTL에서 화면 밖으로 위치
- **해결**: RTL 언어 감지 후 `left-0` 적용

```tsx
// RTL 감지
const isRtl = 'rtl' in currentLang && currentLang.rtl;

// 조건부 위치 지정
className={`... ${isRtl ? 'left-0' : 'right-0'}`}
```

---

## 4. 인증/네비게이션 개선

### App.tsx
- **로그아웃 순서 수정**: navigate 호출 후 상태 초기화 (리다이렉트 경쟁 조건 방지)
- **홈 경로 변경**: 인증 여부와 관계없이 `/` 경로에서 LandingPage 표시
- **로고 스타일 분리**: 연결 상태에 따라 애니메이션/정적 그라데이션 적용

### AuthPanel.tsx
- **ID 보관하기 기능 추가**: 로그인 시 이메일 저장 옵션
- localStorage 키: `neocast:rememberedEmail`, `neocast:rememberEmailEnabled`
- 기본값: 활성화 (사용자 편의성)

---

## 변경된 파일 목록

### 컴포넌트
- `Client/Web/src/App.tsx`
- `Client/Web/src/components/auth/AuthPanel.tsx`
- `Client/Web/src/components/common/LanguageSelector.tsx`
- `Client/Web/src/pages/LandingPage.tsx`
- `Client/Web/src/pages/LoginPage.tsx`

### i18n 파일 (15개)
- `Client/Web/src/i18n/locales/ko.json`
- `Client/Web/src/i18n/locales/en-US.json`
- `Client/Web/src/i18n/locales/en-GB.json`
- `Client/Web/src/i18n/locales/ja.json`
- `Client/Web/src/i18n/locales/zh-CN.json`
- `Client/Web/src/i18n/locales/zh-TW.json`
- `Client/Web/src/i18n/locales/de.json`
- `Client/Web/src/i18n/locales/fr.json`
- `Client/Web/src/i18n/locales/es.json`
- `Client/Web/src/i18n/locales/fil.json`
- `Client/Web/src/i18n/locales/id.json`
- `Client/Web/src/i18n/locales/ms.json`
- `Client/Web/src/i18n/locales/th.json`
- `Client/Web/src/i18n/locales/vi.json`
- `Client/Web/src/i18n/locales/ar.json`
