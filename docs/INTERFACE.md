# 모듈 규격 (INTERFACE)

> **[공통 문서]** 여기 적힌 함수 이름·인자·반환값이 모듈 사이의 약속입니다. 바꾸려면 `[공통]` PR + 세 명 승인.
> 다른 사람 모듈의 기능은 **여기 적힌 공개 함수로만** 씁니다. 상대 폴더의 내부 파일을 직접 import 하지 않습니다.

## 1. 공통 규칙

- 실패하면 `AppError` 를 **던진다(throw)**. `err.code` 는 `ErrCode` 값 (`src/common/errors.js`).
  추가 정보는 `err.details` (예: `WRONG_PASSWORD` → `{ remaining }`, `LOCKED` → `{ retryAfter }` 초).
  화면은 `try/catch` 로 잡고 `errorMessage(err)` 로 한국어 안내를 보여 준다.
- 오래 걸리는 함수는 `signal`(AbortController.signal)을 받는다. 중단되면 `ErrCode.CANCELLED`.
- 모든 비동기 함수는 `Promise` 를 돌려준다 (`async`).
- 남은 일은 `TODO(이름):` 주석으로 표시한다.

## 2. 호출 흐름

```
[ui] 캐릭터 선택 → 목적 선택 → 메시지 입력
   └─ api.apiChat({ personaId, purpose, userText, onChunk })
        ├─ persona.getPersona()           캐릭터 불러오기
        ├─ persona.buildPersonaPrompt()   필요한 부분만 고른 설명문 (baseline이면 buildBaselinePrompt)
        ├─ memory.loadHistory() → recentMessages()   최근 대화
        ├─ 안전 지시문 + 설명문 + 목적 지시문 + 대화 + 입력 → AI 회사 (목적 tier로 모델 선택, 스트리밍)
        └─ memory.appendMessages()        입력·답변 저장

[ui] 캐릭터 만들기(검색)
   └─ persona.createPersonaFromSearch({ name, source, keywords, onProgress })
        ├─ api.apiSearch()      웹 검색 + 정리 (고성능 모델)
        ├─ api.apiComplete()    인격 추론 → JSON (고성능 모델)
        ├─ validatePersona()    형식 검사 (틀리면 한 번 고치기)
        └─ savePersona()        → storage.personasStore

storage.* 는 항상 브라우저(IndexedDB)에 먼저 저장하고, 로그인했으면 Supabase에도 올린다.
```

## 3. common/ — 공통

| 파일 | 함수 | 설명 |
|---|---|---|
| `errors.js` | `ErrCode`, `AppError(code, message, cause)`, `errorMessage(err)`, `isAbortError(err)` | 오류 |
| `config.js` | `loadConfig()` → `AppConfig` | 저장된 AI 연결 설정 |
| | `saveConfig(cfg)` | 키는 `rememberKey` 에 따라 localStorage / sessionStorage |
| | `clearApiKey()`, `isConfigured(cfg)`, `modelForTier(cfg, 'light'\|'heavy')` | |
| `providers.js` | `listProviders()`, `getProvider(id)`, `TEST_PROVIDER` | AI 회사 목록 (+ 테스트 모드) |
| `purposes.js` | `listPurposes()`, `purposesByCategory()`, `getPurpose(id, customText?)`, `makeCustomPurpose(text)` | 사용 목적 |
| | `CATEGORIES`, `CUSTOM_PURPOSE_ID`, `CRISIS_NOTICE` | |
| `auth.js` | `isCloudEnabled()`, `signInWithGoogle()`, `signOut()`, `getCurrentUser()`, `onAuthChange(cb)` → 해제 함수 | 구글 로그인 (Supabase 설정 없으면 꺼짐) |
| `ids.js` | `newId(prefix)`, `isValidId(id)` | ID 규칙: 영문 소문자·숫자·`_` |

```js
/** AppConfig */
{ provider: 'openai'|'gemini'|'claude'|'test', apiKey, modelLight, modelHeavy, temperature: number|null, rememberKey: boolean }

/** Purpose (purposes.json) */
{ id, name, category: '학습'|'실무'|'상담'|'대화'|'기타', tier: 'light'|'heavy', use_expertise, crisis_notice, description, instruction }
```

## 4. api/ — 오승민

| 함수 | 반환 | 설명 |
|---|---|---|
| `apiChat({ personaId, purpose?, userText, baseline?, onChunk?, signal?, config? })` | `Promise<string>` 답변 전체 | 대화 한 턴. 위 흐름 참고. 중단돼도 받은 데까지 기록 |
| `apiComplete({ system?, prompt, tier='heavy', json=false, signal?, config?, meta? })` | `Promise<string>` | 범용 호출 (페르소나 엔진용). `json` 이면 JSON 객체로 답하게 요청 |
| `apiSearch({ query, system?, signal?, config? })` | `Promise<{ text, sources: [{title, url}] }>` | AI 회사 내장 웹 검색 (고성능 모델) |
| `apiListModels(config?)` | `Promise<string[]>` | 이 키로 쓸 수 있는 모델 (요금 없음) |
| `apiTestConnection(config?)` | `Promise<true>` | 키 확인 |
| `buildSystemPrompt({ characterPrompt, purpose })` | `string` | 안전 지시문이 항상 맨 앞 |
| `SAFETY_PROMPT` | `string` | 고정 안전 지시문 (약화·끄기 금지) |

회사별 차이는 `api/providers/*.js` 안에서만 처리한다 (`{ chat, complete, search, listModels }` 모양을 똑같이 맞춤).

| 회사 | 대화·JSON | 웹 검색 |
|---|---|---|
| OpenAI | `chat/completions` (스트리밍) | Responses API + `web_search` 도구 |
| Gemini | OpenAI 호환 `chat/completions` | `generateContent` + `google_search` 도구 |
| Claude | Messages API (`anthropic-dangerous-direct-browser-access` 헤더) | `web_search` 도구 (콘솔에서 켜야 함) |
| 테스트 | 더미 답변 | 더미 결과 |

## 5. memory/ — 오승민

| 함수 | 반환 | 설명 |
|---|---|---|
| `loadHistory(personaId)` | `Promise<Message[]>` | 없으면 `[]` |
| `appendMessages(personaId, messages)` | `Promise<void>` | `user` / `assistant` 만 저장 |
| `clearHistory(personaId)` | `Promise<void>` | |
| `recentMessages(history, n=20)` | `Message[]` | LLM에 보낼 최근 부분 |
| `listConversations()` | `Promise<[{ personaId, last, count, updatedAt }]>` | 대화 목록 화면용 (최근 순) |
| `RECENT_MESSAGES` | `20` | |

```js
/** Message */
{ role: 'user'|'assistant', content, at: 밀리초, purposeId: string|null }
```

## 6. storage/ — 오승민

| 함수 | 설명 |
|---|---|
| `personasStore` / `conversationsStore` | `.list()`, `.get(key)`, `.put(record)` → 저장된 기록, `.remove(key)` |
| `setActiveUser(userId \| null)`, `getActiveUser()` | 로그인 계정 전환 (DB 이름이 계정마다 다름) |
| `syncFromCloud()` → `{ down, up }` | 계정 ↔ 이 기기 맞추기 (`updatedAt` 최신 우선) |
| `hasGuestData()`, `copyGuestDataToAccount()` | 로그인 전 데이터를 계정으로 옮기기 |
| `exportAll()`, `importAll(backup)` | 백업 파일 |
| `clearLocalData()`, `deleteAccountData()` | 삭제 |

`personasStore` 는 persona 모듈만, `conversationsStore` 는 memory 모듈만 직접 쓴다. 화면은 persona·memory 함수를 쓴다.

### 6-1. storage/keyVault.js — API 키 계정 저장 (로그인한 경우만)

| 함수 | 반환 | 설명 |
|---|---|---|
| `MIN_PASSWORD_LENGTH` | `8` | API 키 비밀번호 최소 길이 |
| `getAccountKeyInfo()` | `Promise<null \| { provider, modelLight, modelHeavy, updatedAt, lockedSeconds }>` | 계정에 저장돼 있는지 (키는 주지 않음) |
| `saveKeyToAccount({ provider, apiKey, modelLight, modelHeavy }, password)` | `Promise<void>` | 브라우저에서 잠근 뒤 저장 (덮어쓰기). 비밀번호가 짧으면 `INVALID_ARG` |
| `unlockKeyFromAccount(password)` | `Promise<{ provider, apiKey, modelLight, modelHeavy }>` | 틀리면 `WRONG_PASSWORD`, 잠기면 `LOCKED`, 없으면 `NOT_FOUND` |
| `changeKeyPassword(oldPassword, newPassword)` | `Promise<void>` | 예전 비밀번호로 풀고 새 비밀번호로 다시 잠금 |
| `deleteKeyFromAccount()` | `Promise<void>` | 비밀번호를 잊었을 때 / 계정 데이터 삭제 때 |

동작: 비밀번호 + salt → PBKDF2-SHA256(60만 번) → 앞 32바이트로 API 키를 AES-GCM 암호화, 뒤 32바이트는 확인용 값으로만 서버에 보냄
(서버는 bcrypt로 한 번 더 감싸 저장). 틀린 횟수는 DB 함수 `unlock_user_key` 가 세고 5번이면 30초 잠근다.
`user_keys` 표는 직접 읽을 수 없고 `save_user_key` / `get_user_key_info` / `unlock_user_key` / `delete_user_key` 함수로만 다룬다.

## 7. persona/ — 손석현

| 함수 | 반환 | 설명 |
|---|---|---|
| `listPersonas()` | `Promise<Record[]>` | 최근 바뀐 순 |
| `getPersona(id)` | `Promise<Record \| null>` | |
| `savePersona(persona, { id?, origin?, sources? })` | `Promise<Record>` | 형식이 틀리면 `INVALID_ARG` 던지고 저장 안 함. `id` 가 있으면 덮어쓰기 |
| `deletePersona(id)` | `Promise<void>` | 대화 기록도 같이 삭제 |
| `createPersonaFromSearch({ name, source?, keywords?, onProgress?, signal? })` | `Promise<Record>` | 검색으로 만들기 |
| `createPersonaFromText({ name, source?, text, onProgress?, signal? })` | `Promise<Record>` | 설정 글로 만들기 |
| `importPersonaJson(text)` / `exportPersonaJson(record)` | `Record` / `string` | 파일 가져오기·내보내기 |
| `ensureSamples()` | `Promise<void>` | 처음 한 번 샘플(윤서) 넣기 |
| `validatePersona(p)` | `{ ok, errors[], warnings[] }` | |
| `emptyPersona(name?, source?)` | 페르소나 | 양식 입력의 시작점 |
| `buildPersonaPrompt(persona, purpose, userText)` | `string` | 대화용 설명문 (필요한 부분만) |
| `buildBaselinePrompt(persona)` | `string` | 비교용: 이름·작품명만 |

```js
/** Record (저장 기록) */
{ id, persona: 페르소나 JSON, origin: 'search'|'text'|'form'|'import'|'sample', sources: [{title, url}], createdAt, updatedAt }

/** onProgress 인자 */
{ percent: 0~100, step: '화면에 보여 줄 단계 이름' }
```

## 8. ui/ — 곽수호

다른 모듈이 부르는 함수는 없습니다. 화면 주소:

| 주소 | 화면 |
|---|---|
| `/` | 홈 (내 캐릭터) |
| `/setup` | AI 연결 |
| `/create`, `/create/form` | 새 캐릭터 만들기, 직접 입력 |
| `/characters/:id`, `/characters/:id/edit` | 프로필 + 목적 선택, 수정 |
| `/chat/:id?p=목적ID[&c=기타 글][&b=1]` | 대화 (`b=1` 은 비교용 단순 프롬프트) |
| `/chats` | 대화 목록 |
| `/settings`, `/privacy` | 설정, 개인정보 처리방침 |
