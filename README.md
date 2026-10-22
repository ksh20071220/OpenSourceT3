# OpenSourceT3

**저비용 고성능 LLM 기반 커스텀 캐릭터 채팅 프로그램** (1반 3팀)

캐릭터 이름만 입력하면 웹 검색과 LLM으로 캐릭터의 성격·가치관·말투·행동 원칙을 조사해 **근거 기반 페르소나(JSON)** 를 만들고,
사용자 본인의 API 키로 연결한 LLM에 입혀 대화·학습·상담·실무에 쓸 수 있게 하는 **비영리 오픈소스 프로그램**입니다.
복잡한 프롬프트 없이 **단어와 클릭만으로** 범용 AI에 캐릭터와 사용 목적을 입히는 것이 목표입니다.

## 주요 특징

- **근거 기반 인격 추론**: 수집한 설정·대사·행적의 신뢰도를 평가하고, 자료에 없는 특성은 맥락으로 추론
- **로컬 우선**: 페르소나·대화 기록·API 키는 모두 사용자 컴퓨터에만 저장, 중앙 서버 없음
- **BYOK (내 API 키 사용)**: OpenAI, Google Gemini, Anthropic Claude 지원 (OpenAI 호환 형식)
- **모델 라우팅**: 인격 생성·복잡한 작업은 고성능 모델, 일상 대화는 저비용 모델
- **사용 목적 선택**: 학습·실무·상담·대화 등 26가지 + 직접 입력
- **Windows / Linux** 모두에서 빌드·실행

## 현재 상태: v0.1 뼈대

공통 파일은 완성돼 있고, 각자 맡은 파일은 **더미(깡통) 구현**입니다.
더미 상태로도 `캐릭터 선택 → 목적 선택 → 대화` 흐름이 끝까지 돌아가므로, 각자 자기 파일만 실제 구현으로 바꿔 나가면 됩니다.
남은 일은 [docs/ROADMAP.md](docs/ROADMAP.md)를 보세요.

## 빠른 시작

자세한 설치 방법은 **[docs/SETUP.md](docs/SETUP.md)** 를 보세요.

```bash
# Windows: "MSYS2 UCRT64" 터미널 / Linux: 일반 터미널
make            # 빌드
make run        # 실행
make check      # PR 올리기 전 확인 (경고 없는 빌드 + 자체 테스트)
```

VSCode에서는 `Ctrl+Shift+B` 로 빌드할 수 있습니다.

## 폴더 구조

```
include/        모듈 간 규격(헤더)                          [공통]
src/
  main.c, common.c, platform.c, config.c, purpose.c        [공통]
  ui.c                                                      [곽수호]
  api.c, memory.c                                           [오승민]
  persona.c                                                 [손석현]
lib/cjson/      JSON 라이브러리 (cJSON, MIT)                 [공통]
assets/
  providers.json  API 회사 목록·키 발급 안내               [공통]
  purposes.json   사용 목적 목록                           [공통]
  personas/       샘플 페르소나 (자체 창작만)              [손석현]
data/           사용자 데이터: 설정·API 키·페르소나·대화 기록 (git 제외)
docs/           제안서와 개발 문서
```

## 팀과 역할

| 역할 | 이름 | 담당 | 파일 |
|---|---|---|---|
| 팀장, UI | 곽수호 | 채팅 인터페이스, 캐릭터 선택, 목적 선택·학습 모드 UI, 일정·통합 관리 | `src/ui.c` + 공통 파일 관리 |
| API 엔진 | 오승민 | LLM API 연결, 검색, 프롬프트 구성, 대화 기록·기억 | `src/api.c`, `src/memory.c` |
| 페르소나 | 손석현 | 캐릭터 정보 분석, 인격 추론, JSON 생성·검증·불러오기 | `src/persona.c`, `docs/persona-schema.md` |

## 문서

| 문서 | 내용 |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | **협업 규칙**, Git 작업 순서 (처음이라면 꼭 읽기) |
| [AGENTS.md](AGENTS.md) | Codex·Claude 같은 AI 코딩 도구가 지켜야 할 규칙 |
| [docs/SETUP.md](docs/SETUP.md) | Windows / Linux 개발 환경 설치 |
| [docs/INTERFACE.md](docs/INTERFACE.md) | 모듈 간 규격과 호출 흐름 |
| [docs/persona-schema.md](docs/persona-schema.md) | 페르소나 JSON 형식 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 할 일과 제안서 항목별 담당 |
| docs/저비용_고성능_…_제안(…).docx | 개별 제안서 |

## 사용 시 주의

- API 키는 `data/config.json` 에 저장됩니다. 이 폴더는 git에 올라가지 않으며, 다른 사람과 공유하지 마세요.
- 본인 API 키로 사용하는 만큼 각 회사의 이용 정책이 적용되고, 위반 시 키가 정지될 수 있습니다.
- AI 캐릭터와의 대화는 전문 상담을 대신하지 않습니다.

## 라이선스

현재 저장소의 LICENSE는 MIT입니다. 제안서에 따라 **GPL v3로 변경할 예정**입니다(팀장 결정 후 반영).
포함된 cJSON은 MIT 라이선스이며 GPL v3와 함께 쓸 수 있습니다 (`lib/cjson/LICENSE`).
