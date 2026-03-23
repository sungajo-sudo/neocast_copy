# NeoCAST Modern Soft Design System

이 문서는 NeoCAST 프로젝트의 **"Modern Soft"** 테마 디자인 표준을 정의합니다. (다크모드 미지원)

---

## 🎨 Color Tokens (Source of Truth)
모든 색상은 Tailwind CSS 변수로 매핑되어야 합니다.

| Token | Hex/Value | Usage |
|---|---|---|
| **Primary (Brand)** | `#6366f1` | Indigo-500, 메인 액션 및 브랜드 아이덴티티 |
| **Secondary (Glow)** | `#a855f7` | Purple-500, 그래디언트 및 강조 포인트 |
| **App Background** | `#fffcf9` | 아주 연한 미색, 메인 배경 배경 |
| **Grid Surface** | `#ffffff` | 흰색, 카드 및 그리드 요소의 배경 |
| **App Border** | `#fff1e6` | 연한 주황빛, 카드 테두리로 부드러운 느낌 제공 |
| **Text (Primary)** | `#0f172a` | Slate-900, 제목 및 본문 텍스트 |
| **Text (Secondary)** | `#64748b` | Slate-500, 보조 문구 및 캡션 |

---

## ✨ Design Atoms (Styles)

### Typography
- **Headings (EN/KR)**: `Inter`, `Noto Sans KR` (Bold 700~900)
- **Body**: `Inter`, `Noto Sans KR` (Regular 400 ~ Medium 500)
- **Monospace**: `JetBrains Mono` (Timer, Numbers, Code)

### Shapes & Elevation
- **Card Radius**: `30px` (rounded-modern) - NeoCAST의 시그니처 둥근 테두리
- **Button Radius**: `50px` (rounded-pill) - 알약 모양의 부드러운 버튼
- **Main Shadow**: `0 30px 60px rgba(0, 0, 0, 0.05)` (shadow-modern) - 깊고 부드러운 그림자
- **Brand Glow**: `0 20px 40px rgba(99, 102, 241, 0.2)` (shadow-brand) - Indigo 광채 효과

---

## 🧩 Component Rules (for AI)
새로운 컴포넌트를 생성할 때 아래 규칙을 따릅니다:

1.  **Card Layout**: `bg-white border-2 border-app-border rounded-modern shadow-modern` 속성을 기본으로 가집니다.
2.  **Indigo Gradient**: 브랜드 이미지가 필요한 곳에는 항상 `bg-gradient-to-br from-[#6366f1] to-[#a855f7]`을 사용합니다.
3.  **Soft Transitions**: 모든 인터랙션(Hover, Active)에는 `duration-300 ease-in-out`을 적용합니다.
4.  **Information Density**: B2B SaaS임을 고려하여 여백은 충분히 주되(Padding `p-6` 이상) 폰트 크기 계층을 명확히 합니다.
