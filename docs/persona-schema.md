# 페르소나 JSON 형식 (schema_version 1.0 초안)

> **담당: 손석현.** 이 문서와 `src/persona.c`, `assets/personas/` 는 손석현이 관리합니다.
> 다른 모듈은 JSON을 직접 읽지 않고 `persona.h` 함수만 쓰므로, 아래 형식은 손석현이 자유롭게 바꿔도 됩니다.
> 단, `schema_version`, `character.name`, `character.source` 는 다른 기능(목록 화면 등)이 쓰므로 유지합니다.

## 저장 위치와 ID

- 사용자 페르소나: `data/personas/<id>.json` (git 제외)
- 샘플: `assets/personas/<id>.json` (git 포함, **자체 창작 캐릭터만**)
- **ID = 파일 이름** (확장자 제외). 영문 소문자·숫자·`_` 만 사용. 예: `yunseo`, `char_1`

## 예시

`assets/personas/yunseo.json` 참고 (팀 회의에서 정한 초안 그대로).

## 필드

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `schema_version` | 문자열 | ✔ | 형식 버전. 구조를 바꾸면 올림 |
| `character.name` | 문자열 | ✔ | 캐릭터 이름 (목록 화면 표시) |
| `character.source` | 문자열 | ✔ | 작품명 또는 "자체 창작" |
| `character.setting_version` | 문자열 | | 설정 기준 (예: 원작 몇 권까지) |
| `personality.traits[]` | 배열 | | 성격 특성 |
| `  .name` | 문자열 | | 특성 이름 |
| `  .strength` | 0~1 숫자 | | 특성 강도 |
| `  .confidence` | `"low"` / `"medium"` / `"high"` | | 추론 확신도 |
| `  .basis` | `"explicit"` / `"inferred"` | | 자료에 명시됨 / 추론함 |
| `  .evidence_ids` | 문자열 배열 | | 근거 (`evidence[].id`) |
| `personality.values` | 문자열 배열 | | 가치관 |
| `personality.speech_style` | 객체 | | `tone`, `formality`(`formal`/`informal`), `expressiveness`(`low`/`medium`/`high`) |
| `evidence[]` | 배열 | | 근거 자료 |
| `  .id` | 문자열 | | `E001` 형식 |
| `  .situation`, `.action` | 문자열 | | 장면형 근거 |
| `  .observation` | 문자열 | | 설명형 근거 |
| `  .source` | 문자열 | | 출처 |
| `behavior_rules[]` | 배열 | | 상황별 행동 원칙: `condition`, `priority`, `response`, `exception`, `evidence_ids` |
| `expertise` | 객체 | | `strengths`, `limitations` (학습·실무 목적에서 우선 참조) |
| `uncertainties[]` | 배열 | | 자료로 확인 못 한 부분: `question`, `status` (`unresolved` / `inferred`) |

## 검토 제안 (손석현이 결정)

팀 회의 때 나온 의견입니다. 채택 여부는 손석현이 정하고, 정하면 위 표에 반영합니다.

1. **`evidence[].type` 추가** (`"scene"` / `"description"`): 지금 E001은 장면형, E002는 설명형으로 모양이 달라서 코드에서 구분하기 쉽게.
2. **`evidence[].reliability` 추가** (`"high"` / `"medium"` / `"low"`) 와 `url`: 제안서의 "공식 자료는 높은 신뢰도, 커뮤니티 추측은 낮은 신뢰도" 기록을 위해.
3. **`personality.speech_style.sample_lines` 추가** (대사 예시 몇 줄): 저비용 모델은 설명보다 예시로 말투를 더 잘 따라 함.
4. **`uncertainties` 활용**: 대화 중 해당 상황이 오면 "성격에 맞게 추론하라"는 지시로 바꿔 넣기 (제안서의 "명시되지 않은 특성은 추론으로 보완").

## 대화 때 넣을 부분 (토큰 절약)

`persona_build_prompt` 가 매번 전부 넣지 않고 골라 넣습니다. 지금 더미는 이름·말투·가치관(+ 학습·실무 목적이면 전문성)만 넣습니다.
`evidence` 는 생성·검증용이라 보통 대화 요청에는 넣지 않습니다.
