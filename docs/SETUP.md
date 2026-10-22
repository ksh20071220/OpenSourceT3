# 개발 환경 설치

필요한 것: **gcc, make, libcurl, pthread, git** (+ 편집기 VSCode)

## Windows (MSYS2 UCRT64)

Windows에서는 **MSYS2** 로 gcc·make·libcurl을 한 번에 설치합니다. pthread는 gcc에 포함되어 있습니다.

1. https://www.msys2.org/ 에서 설치 프로그램을 받아 설치합니다. (기본 경로 `C:\msys64` 그대로)
2. 시작 메뉴에서 **"MSYS2 UCRT64"** 를 엽니다. (MSYS, MINGW64가 아니라 **UCRT64**)
3. 아래를 입력합니다. 중간에 창이 닫히면 다시 열고 같은 명령을 한 번 더 실행합니다.

   ```bash
   pacman -Syu
   pacman -S --needed git make \
     mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-gdb \
     mingw-w64-ucrt-x86_64-curl mingw-w64-ucrt-x86_64-pkgconf
   ```

4. 확인: `gcc --version`, `make --version`, `pkg-config --modversion libcurl` 이 모두 버전을 출력하면 성공입니다.
5. (VSCode 디버깅용) Windows **환경 변수 Path** 에 `C:\msys64\ucrt64\bin` 을 추가합니다.

### VSCode 설정

1. VSCode에서 저장소 폴더를 엽니다. 오른쪽 아래에 **추천 확장 설치** 알림이 뜨면 설치합니다. (C/C++, EditorConfig)
2. 터미널(`Ctrl+\``)을 열면 자동으로 **MSYS2 UCRT64** 터미널이 열립니다 (`.vscode/settings.json` 에 설정됨).
3. `Ctrl+Shift+B` → 빌드, `F5` → 디버깅(별도 콘솔 창에서 실행).
4. 명령 팔레트(`Ctrl+Shift+P`) → **Tasks: Run Task** 에서 `실행`, `자체 테스트`, `PR 전 확인` 을 고를 수 있습니다.

MSYS2를 `C:\msys64` 가 아닌 곳에 설치했다면 `.vscode/` 안의 경로를 **각자 컴퓨터에서만** 바꾸고 커밋하지 마세요.

## Linux (Ubuntu / Debian)

```bash
sudo apt update
sudo apt install build-essential gdb pkg-config libcurl4-openssl-dev git
```

## macOS

```bash
xcode-select --install     # clang, make, libcurl 포함
```

## 빌드와 실행

```bash
make            # 빌드 → build/opensourcet3 (Windows는 .exe)
make run        # 실행
make selftest   # 모든 모듈 연결 확인
make check      # 경고를 오류로 취급 + selftest  ← PR 전에 꼭
make clean      # 빌드 결과 삭제
```

**항상 저장소 맨 위 폴더에서 실행합니다.** (`assets/`, `data/` 를 상대 경로로 찾기 때문)

## 자주 생기는 문제

| 증상 | 해결 |
|---|---|
| `make: command not found` | Windows: "MSYS2 UCRT64" 터미널에서 실행했는지 확인. `pacman -S make` |
| `curl/curl.h: No such file or directory` | Windows: `mingw-w64-ucrt-x86_64-curl` 설치 (UCRT64용). Linux: `libcurl4-openssl-dev` 설치 |
| 실행하면 `libcurl-4.dll` 을 찾을 수 없다 | MSYS2 UCRT64 터미널에서 실행하거나, Path에 `C:\msys64\ucrt64\bin` 추가 |
| 한글이 깨져 보임 | VSCode 터미널 또는 Windows 터미널에서 실행. 오래된 `cmd.exe` 창은 글꼴에 따라 깨질 수 있음 |
| 줄바꿈 때문에 파일 전체가 바뀐 것처럼 보임 | `.gitattributes` 가 처리함. `git config core.autocrlf false` 로 맞추고 다시 받기 |
