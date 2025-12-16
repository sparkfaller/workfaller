# 그룹웨어 Supabase 설정 가이드

## 1. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에 접속하여 로그인
2. "New Project" 버튼 클릭
3. 프로젝트 이름, 데이터베이스 비밀번호 설정
4. Region 선택 (한국의 경우 Northeast Asia (Seoul) 추천)
5. 프로젝트 생성 완료 대기

## 2. 환경 변수 설정

1. Supabase 대시보드에서 Settings > API 메뉴로 이동
2. Project URL과 anon public key 복사
3. `.env.local` 파일을 열어 다음 값을 입력:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 3. 데이터베이스 스키마 설정

1. Supabase 대시보드에서 SQL Editor 메뉴로 이동
2. `supabase-setup.sql` 파일의 내용을 복사하여 붙여넣기
3. "Run" 버튼을 클릭하여 실행

이 스크립트는 다음을 생성합니다:
- 사용자 프로필 테이블 (profiles)
- 부서 테이블 (departments)
- 게시글 테이블 (posts)
- 댓글 테이블 (comments)
- 업무 테이블 (tasks)
- 일정 테이블 (calendars)
- Row Level Security (RLS) 정책
- 자동 트리거 (회원가입 시 프로필 생성 등)

## 4. 인증 설정 (선택사항)

1. Authentication > Providers 메뉴로 이동
2. Email 인증이 기본적으로 활성화되어 있음
3. 필요시 Google, GitHub 등 소셜 로그인 추가 가능
4. Email Templates에서 회원가입 이메일 템플릿 커스터마이징 가능

## 5. 애플리케이션 실행

```bash
npm run dev
```

## 주요 기능

### 현재 구현된 기능
- ✅ 로그인/로그아웃
- ✅ 사용자 인증 및 세션 관리
- ✅ 보호된 라우트
- ✅ 대시보드 UI

### 추가 개발 예정 기능
- 📝 게시판 (공지사항, 자유게시판)
- 📋 업무 관리 (할 일, 진행 상황)
- 📅 일정 관리 (캘린더)
- 👥 주소록
- 💬 실시간 메시징
- ✍️ 전자결재
- 📊 통계 및 리포트

## 데이터베이스 구조

### profiles
사용자 프로필 정보 (이메일, 이름, 부서, 직급 등)

### departments
부서 정보

### posts
게시글 (공지사항, 발표, 토론)

### comments
게시글 댓글

### tasks
업무/할 일 관리

### calendars
일정 관리 (회의, 이벤트, 마감일)

## 보안

- Row Level Security (RLS)가 모든 테이블에 활성화되어 있습니다
- 사용자는 자신의 데이터만 수정/삭제할 수 있습니다
- 인증된 사용자만 데이터를 생성할 수 있습니다

## 문제 해결

### 로그인이 안 되는 경우
1. `.env.local` 파일의 환경 변수가 올바른지 확인
2. Supabase 프로젝트가 활성 상태인지 확인
3. 브라우저 콘솔에서 에러 메시지 확인

### 데이터베이스 연결 오류
1. SQL 스크립트가 정상적으로 실행되었는지 확인
2. Supabase 대시보드의 Database > Tables에서 테이블 생성 확인

## 그룹 드라이브 (Storage) 설정

그룹 드라이브 기능을 사용하려면 Supabase Storage 버킷 설정이 필요합니다.

1. Supabase 대시보드 > Storage 메뉴로 이동
2. "New Bucket" 버튼 클릭
3. 버킷 이름: `drive` 입력
4. "Public bucket" 체크 (선택사항이지만 다운로드 편의를 위해 권장)
5. "Save" 클릭
6. `supabase-setup.sql`의 하단에 있는 Storage 정책 스크립트를 SQL Editor에서 실행하여 권한 설정
