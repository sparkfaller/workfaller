# Patch Note - 2025-12-18

**Version:** v1.1.1
**Editor:** Sparkfaller

## 🐛 Bug Fixes & Stability (New)

### Messenger
- **Group Chat Creation**:
  - **Critical Fix**: 데이터베이스 정책(RLS)의 무한 재귀 오류를 수정하여 그룹 채팅방이 정상적으로 생성되도록 조치했습니다.
  - **Validation**: 그룹 이름 입력 및 최소 1명 이상의 사용자 선택을 강제하는 유효성 검사를 추가했습니다.
  - **UI Fix**: 그룹 생성 모달의 '취소' 버튼 텍스트 색상을 수정하여 배경색과 겹치는 문제를 해결했습니다.
  - **Error Handling**: 그룹 생성 및 파일 업로드 실패 시, 사용자에게 구체적인 오류 원인을 알려주는 토스트 메시지를 추가했습니다.

### Database & Security
- **RLS Policies**:
  - `is_room_member` 보안 함수(Security Definer)를 도입하여 채팅방 멤버십 확인 시 발생하는 성능 저하 및 오류를 방지했습니다.
  - 스토리지 버킷(`chat-attachments`)에 대한 접근 권한 정책을 재설정하여 파일 업로드/다운로드 오류를 해결했습니다.

---

## 🎨 UI/UX Improvements (v1.1.0)

### Messenger
- **Group Chat Creation Modal**:
  - 기존의 체크박스 목록을 모던한 카드형 사용자 선택 인터페이스로 교체했습니다.
  - 선택된 사용자는 파란색 테두리와 빛(Glow) 효과로 강조되어 시인성을 높였습니다.
  - 마우스 호버 상태 및 전반적인 시각적 계층 구조를 개선했습니다.

## 🛠️ Refactoring & Codebase Improvements (v1.1.0)

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
