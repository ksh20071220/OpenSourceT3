# 협업 규칙

> 세 명이 서로를 기다리지 않고, 서로의 코드를 망가뜨리지 않으면서 개발하기 위한 규칙입니다.
> Git이 처음이라면 아래 **"작업 순서"** 를 그대로 따라 하면 됩니다.

## 1. 핵심 규칙 세 가지

1. **내 파일만 고친다.** 아래 표에서 내 이름이 적힌 파일만 수정합니다.
2. **공통 파일은 PR로 제안하고, 셋 다 확인한 뒤에만 합친다.** (4장)
3. **`main` 브랜치에 직접 올리지 않는다.** 항상 내 브랜치에서 작업하고 PR(Pull Request)로 합칩니다.

## 2. 파일 담당

| 담당 | 파일 |
|---|---|
| **응가 (곽수호)** | `src/ui.c` |
| **똥 (오승민)** | `src/api.c`, `src/memory.c` |
| **변 (손석현)** | `src/persona.c`, `docs/persona-schema.md`, `assets/personas/` |
| **공통** (관리: 팀장) | 그 밖의 모든 파일: `include/*.h`, `src/main.c`, `src/common.c`, `src/platform.c`, `src/config.c`, `src/purpose.c`, `lib/`, `assets/providers.json`, `assets/purposes.json`, `Makefile`, `.github/`, `.vscode/`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `docs/INTERFACE.md`, `docs/ROADMAP.md`, `docs/SETUP.md`, `.gitignore` 등 |

- `include/` 의 헤더는 **모듈 사이의 약속(규격)** 이라 공통 파일입니다. `api.h`를 똥이 혼자 바꾸면 그걸 부르는 응가·변의 코드가 깨지기 때문입니다.
- 다른 사람 모듈의 기능이 필요하면 **헤더에 있는 함수만** 부릅니다. 상대의 `.c` 파일을 열어 고치지 않습니다.
- 상대 기능이 아직 더미여도 괜찮습니다. 더미가 정해진 모양대로 결과를 돌려주므로 내 쪽 개발을 계속할 수 있습니다.

## 3. 작업 순서 (Git 처음 쓰는 사람용)

### 처음 한 번만

```bash
git clone https://github.com/ksh20071220/OpenSourceT3.git
cd OpenSourceT3
git config user.name "내 이름"
git config user.email "GitHub에 등록한 이메일"
make check          # 빌드와 자체 테스트가 통과하는지 확인
```

### 작업할 때마다

```bash
# 1) 최신 main 받기
git switch main
git pull

# 2) 작업용 브랜치 만들기 (이름 규칙은 5장)
git switch -c ui/purpose-menu

# 3) 내 파일 수정 → 빌드·확인
make check

# 4) 저장(커밋)
git add src/ui.c
git commit -m "[ui] 목적 선택 화면을 분류별로 나눔"

# 5) GitHub에 올리기
git push -u origin ui/purpose-menu
```

6) GitHub 저장소 페이지에 뜨는 **Compare & pull request** 버튼을 눌러 PR을 만듭니다. 양식의 체크리스트를 채웁니다.
7) PR을 만들면 **Windows와 Linux에서 자동으로 빌드·테스트**가 돌아갑니다. 초록색 체크가 떠야 합니다.
8) 팀원 리뷰(승인)를 받으면 **Squash and merge** 로 합칩니다.
9) 합친 뒤에는 다시 1)부터. 다 쓴 브랜치는 지워도 됩니다: `git branch -d ui/purpose-menu`

### 작업 중에 main이 바뀌었을 때

```bash
git switch main && git pull
git switch ui/purpose-menu
git merge main          # 충돌이 나면 표시된 부분을 고치고 git add → git commit
```

내 파일만 고친다는 규칙을 지키면 충돌은 거의 나지 않습니다.

## 4. 공통 파일을 바꿔야 할 때

개발하다 보면 헤더에 함수를 추가하거나 구조체에 필드를 넣어야 할 때가 반드시 생깁니다. 그때는:

1. **공통 파일만 바꾸는 PR을 따로** 만듭니다. (내 모듈 작업과 섞지 않기)
2. PR 제목 앞에 `[공통]` 을 붙이고, **왜 바꾸는지, 누구 코드에 영향이 있는지** 적습니다.
3. 헤더를 바꿨다면 그 함수를 쓰는 **다른 사람 파일이 깨지지 않게 더미까지 맞춰서** 빌드가 통과해야 합니다.
   (이 경우에만 예외적으로 다른 사람의 더미 부분을 최소한으로 고칠 수 있고, PR에 그 사실을 적습니다.)
4. **나머지 두 명 모두 승인**한 뒤에 합칩니다.

PR에 공통 파일이 포함되면 자동 검사가 경고를 띄워 알려 줍니다.

## 5. 이름 규칙

**브랜치**: `영역/작업-내용` (영어 소문자, `-` 로 연결)

| 영역 | 예시 |
|---|---|
| `ui/` | `ui/purpose-menu` |
| `api/` | `api/curl-request`, `api/streaming` |
| `memory/` | `memory/file-save` |
| `persona/` | `persona/build-prompt` |
| `common/` | `common/add-chat-cancel` |
| `docs/` | `docs/setup-mac` |

**커밋 메시지**: `[영역] 무엇을 했는지` (한국어 OK)

```
[api] OpenAI 호환 요청 보내기 구현
[persona] 행동 규칙을 입력과 관련된 것만 고르도록 변경
[공통] api.h에 대화 취소 함수 추가
```

## 6. PR 규칙

- **작게 자주** 올립니다. 기능 하나 = PR 하나.
- 올리기 전에 `make check` 가 통과해야 합니다.
- PR 양식의 체크리스트를 채웁니다.
- 리뷰어는 "됐다/안 됐다"만이 아니라 **이해 안 되는 부분을 질문**합니다. 셋 다 처음이니 질문이 곧 리뷰입니다.

## 7. 코드 규칙

- **C11 표준**, 들여쓰기 **공백 4칸**, 파일 인코딩 **UTF-8**, 줄바꿈 **LF** (설정 파일이 자동 처리)
- 공개 함수 이름은 모듈 이름으로 시작: `api_`, `memory_`, `persona_`, `ui_`, `platform_`, `config_`, `purpose_`
- 모듈 안에서만 쓰는 함수·변수는 `static`
- 모든 공개 함수는 `ErrCode` 를 반환하고, 결과는 마지막 인자로 돌려줌 (`include/common.h` 규칙)
- 결과를 돌려주는 함수가 메모리를 할당하고, 받은 쪽이 해제
- **운영체제별 코드 금지**: 각자 파일에서 `<windows.h>`, `<unistd.h>`, `<dirent.h>` 를 쓰지 않고 `platform.h` 함수를 씀
  - 파일 열기 `fopen` → `platform_fopen`, `strdup` → `ost3_strdup`, 경로 구분자는 항상 `/`
- 주석은 한국어로 자유롭게. 아직 안 한 일은 `TODO(이름):` 으로 표시
- API 키·개인 데이터는 절대 코드나 커밋에 넣지 않음 (`data/` 는 git 제외)
- `assets/personas/` 에는 **자체 창작 캐릭터만** 넣음 (저작권)

## 8. 팀장이 GitHub에서 한 번 해 둘 설정

1. **Settings → Collaborators**: 팀원 두 명 초대
2. **`.github/CODEOWNERS`**: 팀원 GitHub 아이디 채우기 → 모든 PR에 나머지 두 명이 리뷰어로 자동 지정됨
3. **Settings → Branches → Add branch protection rule** (`main`):
   - Require a pull request before merging → Required approvals: **1**
   - Require status checks to pass → `linux`, `windows` 선택 (첫 PR이 한 번 돌아간 뒤에 목록에 나타남)
4. **Settings → General → Pull Requests**: Allow squash merging 만 켜 두기 (기록이 깔끔해짐)

공통 파일의 "셋 다 승인" 규칙은 GitHub가 자동으로 강제하지 못하므로 팀 약속으로 지킵니다.
