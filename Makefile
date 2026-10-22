# OpenSourceT3 — Windows(MSYS2 UCRT64) / Linux / macOS 공용 Makefile
# [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
#
#   make            빌드 → build/opensourcet3(.exe)
#   make run        빌드 후 실행
#   make selftest   빌드 후 모듈 연결 확인
#   make check      경고를 오류로 취급해 빌드 + selftest (PR 올리기 전에 꼭 실행, CI와 동일)
#   make clean      빌드 결과 삭제
#   make release    최적화 빌드
#
# Windows에서는 반드시 "MSYS2 UCRT64" 터미널(또는 VSCode 작업)에서 실행한다.

# make의 기본값 cc는 MSYS2에 없을 수 있으므로 gcc로
ifeq ($(origin CC),default)
  CC := gcc
endif
TARGET  := opensourcet3
BUILD   := build

ifeq ($(OS),Windows_NT)
  EXE := .exe
else
  EXE :=
endif
BIN := $(BUILD)/$(TARGET)$(EXE)

SRC := $(wildcard src/*.c) lib/cjson/cJSON.c
OBJ := $(patsubst %.c,$(BUILD)/obj/%.o,$(SRC))
DEP := $(OBJ:.o=.d)

# libcurl: pkg-config가 있으면 사용, 없으면 기본 이름
CURL_CFLAGS := $(shell pkg-config --cflags libcurl 2>/dev/null)
CURL_LIBS   := $(shell pkg-config --libs libcurl 2>/dev/null)
ifeq ($(strip $(CURL_LIBS)),)
  CURL_LIBS := -lcurl
endif

CSTD     := -std=c11
WARN     := -Wall -Wextra -Wpedantic -Wshadow -Wstrict-prototypes
DEFS     ?=
CPPFLAGS += -Iinclude -Ilib/cjson -D_POSIX_C_SOURCE=200809L $(CURL_CFLAGS) $(DEFS)
OPT      ?= -g -O0
WERR     ?=
CFLAGS   += $(OPT) $(CSTD) $(WARN) $(WERR) -MMD -MP
LDLIBS   += $(CURL_LIBS) -lpthread

# cJSON은 외부 코드라 경고 수준을 낮춘다
$(BUILD)/obj/lib/%.o: WARN := -w

.PHONY: all run selftest check clean release

all: $(BIN)

$(BIN): $(OBJ)
	$(CC) $(LDFLAGS) -o $@ $^ $(LDLIBS)

$(BUILD)/obj/%.o: %.c
	@mkdir -p $(dir $@)
	$(CC) $(CPPFLAGS) $(CFLAGS) -c -o $@ $<

run: $(BIN)
	./$(BIN)

selftest: $(BIN)
	./$(BIN) --selftest

check:
	$(MAKE) WERR=-Werror
	./$(BIN) --selftest

release:
	$(MAKE) clean
	$(MAKE) OPT=-O2

clean:
	rm -rf $(BUILD)

-include $(DEP)
