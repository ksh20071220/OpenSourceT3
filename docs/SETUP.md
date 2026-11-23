# 개발 환경과 배포

## 1. 개발 환경 (Windows 기준, macOS·Linux도 같음)

필요한 것: **Node.js 22 이상**, **git**, 편집기 **VSCode**

1. https://nodejs.org/ 에서 **LTS** 버전을 받아 설치합니다. (설치 중 옵션은 기본값 그대로)
2. https://git-scm.com/ 에서 Git을 설치합니다. (이미 있으면 생략)
3. 새 터미널(PowerShell 또는 VSCode 터미널)을 열고 확인합니다.

   ```bash
   node -v     # v22 이상
   npm -v
   git --version
   ```

4. 저장소를 받고 실행합니다.

   ```bash
   git clone https://github.com/ksh20071220/OpenSourceT3.git
   cd OpenSourceT3
   npm install        # 처음 한 번 (라이브러리 설치)
   npm run dev        # 브라우저에서 http://localhost:5173 열기
   ```

5. VSCode에서 폴더를 열면 추천 확장(Tailwind CSS, EditorConfig) 설치 알림이 뜹니다. 설치하면 클래스 이름 자동 완성이 됩니다.

### 자주 쓰는 명령

```bash
npm run dev       # 개발 서버 (파일을 저장하면 화면이 바로 바뀜)
npm test          # 테스트만
npm run check     # 테스트 + 빌드  ← PR 올리기 전에 꼭
npm run build     # 배포용 빌드 → dist/
npm run preview   # 빌드 결과 미리 보기
```

### AI 없이 개발하기

앱에서 **AI 연결하기 → 테스트 모드**를 고르면 키 없이 더미 답변으로 모든 화면을 확인할 수 있습니다. 요금이 들지 않습니다.

## 2. 자주 생기는 문제

| 증상 | 해결 |
|---|---|
| `npm: command not found` / `'npm'은(는) ... 아닙니다` | Node.js 설치 후 터미널(VSCode 포함)을 껐다 켜기 |
| PowerShell에서 `npm.ps1 ... 실행할 수 없습니다` | PowerShell에서 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 한 번 실행, 또는 VSCode 터미널을 "Command Prompt"로 |
| 화면이 하얗게만 나옴 | 브라우저 F12 → Console 의 빨간 오류를 팀 채팅에 공유 |
| AI 호출에서 "서버에 연결하지 못했습니다" | 인터넷 확인. 회사 방화벽·광고 차단 확장이 막는 경우도 있음 |
| Claude로 캐릭터 만들기가 실패 | Claude 콘솔 설정에서 **웹 검색(Web search)** 사용을 켜기 |
| 줄바꿈 때문에 파일 전체가 바뀐 것처럼 보임 | `.gitattributes` 가 처리함. `git config core.autocrlf false` 후 다시 받기 |

## 3. Vercel 배포 (팀장, 한 번만)

1. https://vercel.com/ 에 GitHub 계정으로 로그인 → **Add New… → Project**
2. `OpenSourceT3` 저장소 **Import** → Framework Preset이 **Vite** 로 잡혔는지 확인 → **Deploy**
3. 이후 `main` 에 합쳐질 때마다 자동으로 다시 배포됩니다. PR마다 미리 보기 주소도 생깁니다.

`vercel.json` 이 모든 주소를 `index.html` 로 보내 주므로 `/chat/...` 같은 주소에서 새로고침해도 됩니다.

## 4. 로그인 기능 켜기 (선택, 팀장, 한 번만)

설정하지 않으면 로그인 버튼이 숨겨지고 앱은 "브라우저에만 저장" 모드로 동작합니다.

### 4-1. Supabase 프로젝트

1. https://supabase.com/ 가입 → **New project** (지역: Northeast Asia (Seoul), DB 비밀번호는 따로 보관)
2. 왼쪽 **SQL Editor** → `supabase/schema.sql` 내용을 붙여 넣고 **Run**
3. **Project Settings → API** 에서 두 값을 복사합니다.
   - Project URL → `VITE_SUPABASE_URL`
   - anon public key → `VITE_SUPABASE_ANON_KEY`
4. 내 컴퓨터: `.env.example` 을 `.env` 로 복사해 두 값을 넣습니다. (`.env` 는 git에 올라가지 않음)
5. Vercel: 프로젝트 **Settings → Environment Variables** 에 같은 이름으로 넣고 다시 배포합니다.

> 무료 플랜은 한동안 접속이 없으면 프로젝트가 일시 정지될 수 있습니다. 발표 전에 한 번 접속해 두세요.

### 4-2. Google 로그인

1. https://console.cloud.google.com/ → 새 프로젝트 만들기
2. **API 및 서비스 → OAuth 동의 화면(Google Auth Platform)**
   - 사용자 유형: **외부**
   - 앱 이름, 지원 이메일 입력
   - 범위(Scopes): 기본(`email`, `profile`, `openid`)만. **다른 범위를 추가하지 않습니다** (추가하면 Google 심사 대상)
   - 앱 홈페이지: Vercel 주소, 개인정보처리방침: `Vercel 주소/privacy`
   - 다 되면 **앱 게시(In production)**. 게시하지 않으면 등록한 테스트 사용자만 로그인됩니다
3. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 애플리케이션 유형: **웹 애플리케이션**
   - 승인된 JavaScript 원본: `http://localhost:5173`, Vercel 주소
   - 승인된 리디렉션 URI: Supabase 대시보드 **Authentication → Sign In / Providers → Google** 에 나오는 Callback URL
     (`https://<프로젝트>.supabase.co/auth/v1/callback`)
4. 만들어진 **클라이언트 ID / 보안 비밀** 을 Supabase의 Google 제공자 설정에 붙여 넣고 **Enable**
5. Supabase **Authentication → URL Configuration**
   - Site URL: Vercel 주소
   - Redirect URLs: `http://localhost:5173`, Vercel 주소

브랜드 인증을 받지 않으면 구글 로그인 화면에 앱 이름 대신 `xxxx.supabase.co` 가 보입니다. 동작에는 문제없습니다.
