# 모듈 인터페이스 (v0.2)

> 이 문서와 `include/*.h` 는 **공통 파일**입니다. 바꿀 때는 `[공통]` PR + 셋 다 승인 (CONTRIBUTING.md 4장).
> 함수별 자세한 설명은 각 헤더 파일의 주석에 있습니다.

## 1. 모듈과 담당

| 모듈 | 헤더 | 구현 | 담당 | 제안서 그림 2의 해당 부분 |
|---|---|---|---|---|
| 공통 타입 | `common.h` | `common.c` | 공통 | — |
| 운영체제 차이 처리 | `platform.h` | `platform.c` | 공통 | — |
| 설정·API 회사 목록 | `config.h` | `config.c` | 공통 | 사용자 API 키 입력 |
| 사용 목적 | `purpose.h` | `purpose.c` | 공통 | 사용자 입력 처리(의도 분류) |
| 채팅 화면 | `ui.h` | `ui.c` | 곽수호 | 사용자 |
| API 엔진 | `api.h` | `api.c` | 오승민 | 대화 처리 및 모델 라우팅, LLM API 연동, 출력 후처리, 웹 검색 |
| 대화 기록 | `memory.h` | `memory.c` | 오승민 | 대화 기록 및 기억 관리, 로컬 저장소(대화 기록) |
| 페르소나 | `persona.h` | `persona.c` | 손석현 | 페르소나 추론 모듈, 자료 정제·필터링, 로컬 저장소(페르소나) |

## 2. 호출 흐름

```
[대화 한 턴]
ui.c ──api_chat(req, on_chunk)──▶ api.c
                                   ├─ persona_load(id)               ▶ persona.c
                                   ├─ persona_build_prompt(p, 목적)   ▶ persona.c   (캐릭터 설명문)
                                   ├─ memory_load(id) + memory_recent ▶ memory.c
                                   ├─ 요청 구성: 안전 지시문 + 캐릭터 설명문 + 목적 지시문 + 최근 대화 + 입력
                                   ├─ 목적의 tier로 모델 선택 (light / heavy)
                                   ├─ 작업 스레드(pthread)에서 libcurl 요청, 조각마다 on_chunk
                                   └─ memory_append(입력, 답변)        ▶ memory.c
ui.c ◀──────── 답변 ──────────────┘

[새 캐릭터 만들기]
ui.c ──persona_create(이름, 작품, 키워드, on_progress)──▶ persona.c
                                                         ├─ api_search(...)          ▶ api.c
                                                         ├─ 근거 신뢰도 평가 (손석현)
                                                         ├─ api_complete(TIER_HEAVY)  ▶ api.c   (인격 추론)
                                                         ├─ persona_validate
                                                         └─ data/personas/<id>.json 저장
ui.c ◀──── Persona + 진행률 ─────────────────────────────┘
```

## 3. 공통 규칙

| 규칙 | 내용 |
|---|---|
| 반환값 | 모든 공개 함수는 `ErrCode`(int). 0 = 성공. 결과는 마지막 출력 인자 |
| 메모리 | 결과를 돌려주는 함수가 할당, 받은 쪽이 해제 (문자열 `free()`, 구조체 `*_free()`) |
| 문자열 | 전부 UTF-8 |
| 파일·폴더 | `platform.h` 함수만 사용 (Windows 한글 경로 대응), 경로 구분자 `/` |
| 저장 위치 | `data/` = 사용자 데이터 (git 제외) / `assets/` = 프로그램 자료 (git 포함) |
| 설정 전달 | `main.c` 가 `memory_set_config`, `persona_set_config`, `api_init` 으로 같은 `AppConfig` 를 넘김 |
| 더미 표시 | 아직 안 된 부분은 `TODO(이름)` 주석, 기능 자체가 없으면 `ERR_NOT_IMPLEMENTED` 반환 |

## 4. 결정 기록

| 결정 | 이유 |
|---|---|
| **캐릭터 설명문은 손석현이 만들고(`persona_build_prompt`), 오승민은 받아서 요청을 조립** | JSON 구조를 아는 사람이 고르는 게 맞음. 손석현이 구조를 바꿔도 오승민 코드가 안 깨짐. 제안서 그림 2의 "페르소나 구조화 → 시스템 프롬프트 생성"과 일치 |
| **API는 OpenAI 호환 형식 하나로** OpenAI·Gemini·Claude 지원 | 요청 형식 하나만 구현하면 됨 (회사별로 `base_url` 만 다름). Gemini 호환은 베타, Claude 호환은 공식적으로 테스트·비교용이며 JSON 출력 모드 미지원 → 생성 결과는 반드시 `persona_validate` |
| **콘솔 UI** | 제안서에 GUI 지정 없음. Windows·Linux 공통으로 가장 단순. 나중에 `ui.c` 만 바꾸면 GUI 가능 |
| **cJSON** | 파일 하나라 넣기 쉬움. MIT 라이선스로 GPL v3와 호환 |
| **사용 목적은 데이터 파일** (`assets/purposes.json`) | 목적 추가·수정에 코드 수정·재빌드 불필요 |
| **검열은 목적 단계가 아니라 대화 중에** | 목적 단계 차단은 "기타"로 쉽게 우회됨. 고정 안전 지시문(`SAFETY_PROMPT`) + 모델 거절 응답 처리로 대응 |
| **상담 계열 목적에 위기 안내** | 실제로 힘든 사용자가 있을 수 있음. 화면 안내 + 목적 지시문에 전문 도움 권유 포함 |
| **캐릭터 ID = 파일 이름** (영문 소문자·숫자·`_`) | 페르소나 JSON 형식을 바꾸지 않고 ID 확보. 경로 공격(`../`) 방지 |
| **비교용 모드** (`ChatRequest.baseline`) | 제안서의 "단순 프롬프트 방식과 비교한 인격 일관성(OOC) 검증"용 |
| 페르소나 생성은 고성능, 대화는 저비용 모델 | 제안서의 모델 라우팅 |

## 5. 더미 → 실제 구현으로 바꾸는 방법

1. 내 파일 맨 위의 `TODO(이름)` 목록을 확인합니다.
2. 함수 하나씩 실제 구현으로 바꿉니다. **함수 모양(헤더)은 그대로** 둡니다.
3. `make check` 로 selftest가 통과하는지 확인합니다.
4. 실제 API를 부르는 부분은 **API 키가 없으면 네트워크 전에 오류를 돌려주게** 만들어, CI의 selftest가 SKIP으로 넘어가게 합니다.
