/*
 * ui.c — 채팅 인터페이스 (콘솔)
 * [담당: 응가] 이 파일은 응가만 수정한다. 규격(함수 모양)은 include/ui.h
 *
 * ─────────────────────────────────────────────────────────────
 *  현재 상태: 깡통(최소 동작) 구현
 *   첫 실행 설정 → 메뉴 → 캐릭터 선택 → 목적 선택 → 대화 흐름이
 *   "돌아가기만" 하도록 만든 뼈대. 화면 디자인은 거의 없다.
 *
 *  TODO(응가):
 *   [ ] 화면 꾸미기 (구분선, 색상 등) — 색상은 Windows/Linux 모두 되는 방식으로
 *   [ ] 목적 선택 화면: 분류(학습/실무/상담/대화)별로 나눠 보여 주기
 *   [ ] 대화 화면: 이전 대화 다시 보여 주기 (memory_load), 명령어 도움말
 *   [ ] 새 캐릭터 만들기: 진행률 표시 개선, 생성 후 바로 대화로 이동
 *   [ ] 설정 메뉴: 모델 이름·회사 변경, 캐릭터 삭제
 *   [ ] 학습 모드 UI (역할표)
 * ─────────────────────────────────────────────────────────────
 */
#include "ui.h"
#include "api.h"
#include "config.h"
#include "memory.h"
#include "persona.h"
#include "platform.h"
#include "purpose.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ---------- 입력 도우미 ---------- */

/* 프롬프트를 출력하고 한 줄 입력. 입력이 끝나면(EOF) NULL */
static char *ask(const char *prompt)
{
    printf("%s", prompt);
    char *line = NULL;
    if (platform_read_line(&line) != ERR_OK) return NULL;
    return line;
}

/* 0~max 숫자 입력. EOF면 -1, 잘못된 입력이면 다시 묻기 */
static int ask_number(const char *prompt, int max)
{
    for (;;) {
        char *s = ask(prompt);
        if (!s) return -1;
        char *end = NULL;
        long v = strtol(s, &end, 10);
        int ok = end != s && *end == '\0' && v >= 0 && v <= max;
        free(s);
        if (ok) return (int)v;
        printf("  0 ~ %d 사이 숫자를 입력하세요.\n", max);
    }
}

void ui_show_error(int code, const char *context)
{
    printf("\n[오류] %s: %s\n", context ? context : "", err_to_string(code));
}

/* ---------- 첫 실행 설정 ---------- */

int ui_setup_config(AppConfig *cfg)
{
    if (!cfg) return ERR_INVALID_ARG;
    ProviderInfo *ps = NULL;
    size_t n = 0;
    int r = provider_list_load(cfg, &ps, &n);
    if (r != ERR_OK || n == 0) { ui_show_error(r, "API 회사 목록 읽기"); return r ? r : ERR_NOT_FOUND; }

    printf("\n=== 처음 설정 ===\n사용할 AI 회사를 고르세요.\n");
    for (size_t i = 0; i < n; i++) printf("  %zu) %s\n", i + 1, ps[i].name);
    printf("  0) 취소\n");
    int c = ask_number("> ", (int)n);
    if (c <= 0) { provider_list_free(ps, n); return ERR_CANCELLED; }

    const ProviderInfo *p = &ps[c - 1];
    printf("\n[%s API 키 발급 방법]\n%s", p->name, p->guide);
    if (p->note[0]) printf("※ %s\n", p->note);
    printf("※ 키는 이 컴퓨터의 %s/config.json 에만 저장됩니다. 다른 사람에게 보여 주지 마세요.\n\n",
           cfg->data_dir);

    char *key = ask("API 키를 붙여 넣으세요: ");
    if (!key || !*key) { free(key); provider_list_free(ps, n); return ERR_CANCELLED; }
    snprintf(cfg->api_key, sizeof cfg->api_key, "%s", key);
    free(key);

    printf("\n모델 이름은 %s 에서 확인할 수 있습니다.\n", p->models_url);
    char *light = ask("일상 대화용(저비용) 모델 이름: ");
    char *heavy = ask("인격 생성·복잡한 작업용(고성능) 모델 이름: ");
    if (light) snprintf(cfg->model_light, sizeof cfg->model_light, "%s", light);
    if (heavy) snprintf(cfg->model_heavy, sizeof cfg->model_heavy, "%s", heavy);
    free(light);
    free(heavy);

    config_apply_provider(cfg, p);
    provider_list_free(ps, n);

    r = config_save(cfg);
    if (r != ERR_OK) ui_show_error(r, "설정 저장");
    else printf("설정을 저장했습니다.\n");
    return r;
}

/* ---------- 목적 선택 ---------- */

/* out에 고른 목적을 복사. 취소면 ERR_CANCELLED */
static int choose_purpose(const AppConfig *cfg, Purpose *out)
{
    Purpose *list = NULL;
    size_t n = 0;
    int r = purpose_list_load(cfg, &list, &n);
    if (r != ERR_OK) { ui_show_error(r, "목적 목록 읽기"); return r; }

    printf("\n=== 무엇을 하고 싶나요? ===\n");
    for (size_t i = 0; i < n; i++)
        printf("  %2zu) [%s] %s — %s\n", i + 1, list[i].category, list[i].name, list[i].description);
    printf("  %2zu) 기타 (직접 입력)\n", n + 1);
    printf("   0) 뒤로\n");

    int c = ask_number("> ", (int)n + 1);
    if (c <= 0) {
        r = ERR_CANCELLED;
    } else if ((size_t)c == n + 1) {
        char *text = ask("원하는 목적을 적어 주세요: ");
        r = (text && *text) ? purpose_make_custom(text, out) : ERR_CANCELLED;
        free(text);
    } else {
        r = purpose_copy(&list[c - 1], out);
    }
    purpose_list_free(list, n);
    return r;
}

/* ---------- 대화 ---------- */

static void print_chunk(const char *chunk, void *user)
{
    (void)user;
    fputs(chunk, stdout);
    fflush(stdout);
}

static void chat_loop(const char *id, const char *name, const Purpose *purpose)
{
    printf("\n=== %s와(과) 대화 — %s ===\n", name, purpose->name);
    if (purpose->crisis_notice) printf("%s\n", purpose_crisis_notice());
    printf("(/나가기: 메뉴로, /초기화: 대화 기록 지우기)\n\n");

    for (;;) {
        char *line = ask("나> ");
        if (!line) break;
        if (strcmp(line, "/나가기") == 0 || strcmp(line, "/q") == 0) { free(line); break; }
        if (strcmp(line, "/초기화") == 0) {
            memory_clear(id);
            printf("대화 기록을 지웠습니다.\n");
            free(line);
            continue;
        }
        if (!*line) { free(line); continue; }

        ChatRequest req = { id, purpose, line, 0 };
        char *reply = NULL;
        printf("%s> ", name);
        int r = api_chat(&req, print_chunk, NULL, &reply);
        printf("\n\n");
        if (r != ERR_OK) ui_show_error(r, "대화");
        free(reply);
        free(line);
    }
}

static void menu_chat(AppConfig *cfg)
{
    PersonaInfo *list = NULL;
    size_t n = 0;
    int r = persona_list(&list, &n);
    if (r != ERR_OK || n == 0) {
        ui_show_error(r ? r : ERR_NOT_FOUND, "캐릭터 목록");
        free(list);
        return;
    }
    printf("\n=== 캐릭터 선택 ===\n");
    for (size_t i = 0; i < n; i++)
        printf("  %zu) %s (%s)\n", i + 1, list[i].name, list[i].work);
    printf("  0) 뒤로\n");
    int c = ask_number("> ", (int)n);
    if (c > 0) {
        PersonaInfo chosen = list[c - 1];
        Purpose purpose;
        if (choose_purpose(cfg, &purpose) == ERR_OK) {
            chat_loop(chosen.id, chosen.name, &purpose);
            purpose_free(&purpose);
        }
    }
    free(list);
}

static void on_progress(const char *step, int percent, void *user)
{
    (void)user;
    printf("  [%3d%%] %s\n", percent, step);
    fflush(stdout);
}

static void menu_create(void)
{
    printf("\n=== 새 캐릭터 만들기 ===\n");
    char *name = ask("캐릭터 이름: ");
    if (!name || !*name) { free(name); return; }
    char *work = ask("작품명 (모르면 Enter): ");
    char *keywords = ask("추가 키워드·설정 (없으면 Enter): ");

    PersonaCreateRequest req = { name, work, keywords };
    Persona p;
    int r = persona_create(&req, on_progress, NULL, &p);
    if (r == ERR_OK) {
        printf("'%s' 캐릭터를 만들었습니다. (ID: %s)\n", p.info.name, p.info.id);
        persona_free(&p);
    } else {
        ui_show_error(r, "캐릭터 만들기");
    }
    free(name);
    free(work);
    free(keywords);
}

/* ---------- 메인 루프 ---------- */

int ui_run(AppConfig *cfg)
{
    if (!cfg) return ERR_INVALID_ARG;
    printf("\nOpenSourceT3 %s — 캐릭터 채팅\n", OST3_VERSION);
    for (;;) {
        printf("\n=== 메뉴 ===\n"
               "  1) 캐릭터와 대화하기\n"
               "  2) 새 캐릭터 만들기\n"
               "  3) API 설정 다시 하기\n"
               "  0) 종료\n");
        int c = ask_number("> ", 3);
        switch (c) {
        case 1: menu_chat(cfg); break;
        case 2: menu_create(); break;
        case 3: ui_setup_config(cfg); break;
        default:
            printf("종료합니다.\n");
            return ERR_OK;
        }
    }
}
