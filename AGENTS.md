# AGENTS.md — AI 코딩 도구용 작업 규칙

이 파일은 Codex, Claude 등 AI 코딩 도구가 이 저장소에서 작업할 때 **반드시** 따라야 할 규칙이다.
사람 팀원용 규칙은 `CONTRIBUTING.md`, 모듈 규격은 `docs/INTERFACE.md` 에 있다.

## 1. 프로젝트 요약

캐릭터 이름만 입력하면 웹 검색 + LLM으로 근거 기반 페르소나(JSON)를 만들고, 사용자 API 키로 연결한 LLM에 입혀
대화·학습·상담·실무에 쓰는 **React 웹앱** (Vite, JavaScript, Tailwind CSS). 3인 팀 수업 프로젝트(오픈소스, GPL v3).
백엔드 코드는 없다. 브라우저가 AI 회사에 직접 요청하고, 로그인(선택)한 경우만 Supabase에 저장한다.

## 2. 지켜야 할 원칙 (제안서 + 팀 합의) — 절대 어기지 않는다

제안서(`docs/*.docx`)는 C 버전 기준이었고, 팀 합의로 웹앱으로 바꿨다(README "제안서에서 바뀐 점"). 나머지 원칙은 그대로다.

- **BYOK**: 사용자가 입력한 API 키로만 LLM을 호출한다. 키를 코드·로그·커밋·Supabase에 넣지 않는다.
  키는 `src/common/config.js` 를 통해서만 브라우저 저장소에 저장한다.
- **우리 서버 없음**: 백엔드·서버리스 함수·프록시를 추가하지 않는다. AI 요청은 브라우저에서 AI 회사로 직접 보낸다.
  (꼭 필요하면 사용자에게 먼저 알리고 공통 PR로 제안만 한다.)
- **로컬 우선**: 모든 데이터는 먼저 브라우저(IndexedDB)에 저장한다. Supabase 동기화는 로그인한 경우에만, `src/storage/` 를 통해서만.
  분석·광고·텔레메트리를 추가하지 않는다.
- 페르소나는 **JSON** 으로 저장하고, 대화 때는 **필요한 부분만 골라** 프롬프트에 넣는다 (토큰 절약, `persona/prompt.js`).
- **모델 라우팅**: 인격 생성·복잡한 추론은 고성능(`tier: 'heavy'`), 일상 대화는 저비용(`tier: 'light'`).
- 인격 일관성은 **단순 프롬프트 방식과 비교**해 검증한다 (`apiChat({ baseline: true })`, `buildBaselinePrompt`).
- GPL v3와 호환되지 않는 라이브러리를 추가하지 않는다.

## 3. 파일 소유권 — 가장 중요

| 담당 | 수정 가능한 파일 |
|---|---|
| 곽수호 | `src/ui/` |
| 오승민 | `src/api/`, `src/memory/`, `src/storage/` |
| 손석현 | `src/persona/`, `docs/persona-schema.md`, `src/assets/personas/` |
| 공통 | 그 밖의 모든 파일 (`src/common/`, `src/main.jsx`, `src/test/`, `src/assets/*.json`, `supabase/`, `package.json`, 설정 파일, 문서) |

규칙:

1. 작업을 시작하기 전에 **누구의 작업인지** 확인한다. 모르면 사용자에게 묻는다.
2. **그 사람의 폴더만 수정한다.** 다른 사람의 폴더와 공통 파일은 읽기만 한다.
3. 공통 파일 수정이 꼭 필요하면 **수정하지 말고** 사용자에게 "공통 파일 변경이 필요하다"고 알리고 이유와 변경안을 제시한다.
   사용자가 "공통 파일 PR로 진행하라"고 **명시적으로** 지시한 경우에만 수정한다. 그때도 모듈 작업과 섞지 않는다.
4. `docs/INTERFACE.md` 의 공개 함수 모양(이름·인자·반환값)을 바꾸지 않는다. 다른 모듈 기능은 공개 함수로만 쓴다.
5. 다른 모듈의 기능이 부족해도 대신 고치거나 우회 구현을 만들지 않는다. `TODO(그 사람):` 으로 요청을 남긴다.
6. 라이브러리 설치(`npm install 무엇`)는 `package.json` 을 바꾸므로 공통 PR이다.

## 4. 코드 규칙

- 실패는 `AppError(ErrCode.xxx, '설명')` 로 던진다. 화면은 `errorMessage(err)` 로 보여 준다.
- 오래 걸리는 함수는 `signal`(AbortController)을 받고, 중단되면 `ErrCode.CANCELLED`.
- AI 회사별 차이는 `src/api/providers/*.js` 안에서만 처리한다 (`{ chat, complete, search, listModels }` 모양 유지).
- 화면 스타일은 Tailwind 클래스. 공통 모양은 `src/ui/styles.css` (`btn`, `card`, `input` …). 밝은/어두운 화면 둘 다 확인.
- 한글 입력: Enter로 보내는 입력칸은 `e.nativeEvent.isComposing` 일 때 보내지 않는다.
- 들여쓰기 공백 2칸, ES 모듈, 파일 맨 위 주석에 `[담당: 이름]` 또는 `[공통 파일]`.
- 주석은 한국어. 팀원 모두 웹·오픈소스 초보이므로 **왜 그렇게 했는지** 짧게 설명을 단다. 남은 일은 `TODO(이름):`.

## 5. 빌드와 확인

```bash
npm run check     # vitest 테스트 + vite build
```

- 작업을 마치기 전에 **반드시 `npm run check` 를 통과**시킨다. CI가 Linux·Windows에서 같은 검사를 한다.
- 기능을 바꾸면 그 폴더의 `*.test.js(x)` 에 테스트를 추가한다.
- 테스트는 **API 키 없이** 돌아가야 한다: 테스트 모드(`provider: 'test'`) 또는 `vi.stubGlobal('fetch', …)` 가짜 응답을 쓴다.
  실제 AI 회사로 요청을 보내는 테스트를 만들지 않는다.

## 6. 하지 말 것

- API 키, `.env`, 실제 대화 기록을 커밋하지 않는다.
- 저작권이 있는 작품 속 캐릭터의 설정·대사·이미지를 `src/assets/` 에 넣지 않는다 (샘플은 자체 창작만).
- 안전 지시문(`src/api/api.js` 의 `SAFETY_PROMPT`)을 약화하거나, 사용자가 끄거나, 캐릭터 설명문 뒤로 옮기지 않는다.
- 상담 목적의 위기 상담 안내(`CRISIS_NOTICE`)를 없애지 않는다.
- Supabase 표의 RLS(`supabase/schema.sql`)를 끄거나 느슨하게 하지 않는다.
- Google 로그인 범위(scope)를 `email`, `profile`, `openid` 밖으로 넓히지 않는다 (Google 심사 대상이 됨).
- 커밋 메시지는 `[영역] 내용` 형식 (`CONTRIBUTING.md` 5장).
