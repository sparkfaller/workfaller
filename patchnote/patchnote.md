# Patch Note - 2025-12-18

**Version:** v1.1.0
**Editor:** @logouter024516

## 🎨 UI/UX Improvements

### Messenger
- **Group Chat Creation Modal**:
  - 기존의 체크박스 목록을 모던한 카드형 사용자 선택 인터페이스로 교체했습니다.
  - 선택된 사용자는 파란색 테두리와 빛(Glow) 효과로 강조되어 시인성을 높였습니다.
  - 마우스 호버 상태 및 전반적인 시각적 계층 구조를 개선했습니다.

## 🛠️ Refactoring & Codebase Improvements

### Global Responsiveness
- **Unit Conversion (px → rem)**:
  - 애플리케이션 전체에서 하드코딩된 픽셀(`px`) 값을 상대 단위인 `rem`으로 변환했습니다.
  - 이 변경으로 다양한 화면 크기와 사용자 설정에 대한 확장성, 접근성 및 일관성이 향상되었습니다.
  - **Affected Components & Pages**:
    - `src/components/Layout.tsx`
    - `src/components/ProtectedRoute.tsx`
    - `src/pages/Settings.tsx`
    - `src/pages/Signup.tsx`
    - `src/pages/OrgSetup.tsx`
    - `src/pages/Tasks.tsx`
    - `src/pages/Messenger.tsx`
    - `src/main.tsx`
    - `src/contexts/UIContext.tsx`
    - `src/index.css`
