/*
 * main.c — 프로그램 진입점
 * [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
 *
 * 사용법:
 *   opensourcet3              대화 프로그램 실행
 *   opensourcet3 --selftest   모든 모듈을 차례로 호출해 연결이 맞는지 확인 (CI에서도 사용)
 *   opensourcet3 --version
 */
#include "common.h"
#include "platform.h"
#include "config.h"
#include "purpose.h"
#include "api.h"
#include "memory.h"
#include "persona.h"
#include "ui.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ---------- selftest ---------- */

static int g_fail = 0;
static int g_has_key = 0;

static void check(const char *what, int code)
{
    if (code == ERR_OK) {
        printf("  [ OK ] %s\n", what);
    } else if (!g_has_key && (code == ERR_API || code == ERR_NETWORK
               || code == ERR_INVALID_ARG || code == ERR_NOT_IMPLEMENTED)) {
        /* 실제 구현이 들어온 뒤, API 키 없이 돌리면 네트워크 단계는 건너뜀 */
        printf("  [SKIP] %s (API 키 없음: %s)\n", what, err_to_string(code));
    } else {
        printf("  [FAIL] %s → %s\n", what, err_to_string(code));
        g_fail++;
    }
}

static void on_chunk(const char *chunk, void *user)
{
    (void)user;
    fputs(chunk, stdout);
    fflush(stdout);
}

static void on_progress(const char *step, int percent, void *user)
{
    (void)user;
    printf("         (%3d%%) %s\n", percent, step);
}

static int run_selftest(AppConfig *cfg)
{
    /* 실제 사용자 데이터를 건드리지 않도록 별도 폴더 사용 */
    snprintf(cfg->data_dir, sizeof cfg->data_dir, "%s", "build/selftest_data");
    g_has_key = config_has_api_key(cfg);
    printf("OpenSourceT3 %s selftest\n", OST3_VERSION);

    printf("\n[1] 공통: 설정·목록 파일\n");
    check("설정 저장 (config_save)", config_save(cfg));
    AppConfig loaded;
    config_defaults(&loaded);
    snprintf(loaded.data_dir, sizeof loaded.data_dir, "%s", cfg->data_dir);
    check("설정 불러오기 (config_load)", config_load(&loaded));

    ProviderInfo *providers = NULL;
    size_t np = 0;
    check("API 회사 목록 (providers.json)", provider_list_load(cfg, &providers, &np));
    printf("         회사 %zu곳\n", np);
    provider_list_free(providers, np);

    Purpose *purposes = NULL;
    size_t nu = 0;
    check("사용 목적 목록 (purposes.json)", purpose_list_load(cfg, &purposes, &nu));
    printf("         목적 %zu개\n", nu);
    const Purpose *study = NULL;
    for (size_t i = 0; i < nu; i++)
        if (purposes[i].use_expertise) { study = &purposes[i]; break; }

    Purpose custom;
    check("기타 목적 만들기 (purpose_make_custom)", purpose_make_custom("발표 연습 상대", &custom));
    purpose_free(&custom);

    printf("\n[2] 변: 페르소나\n");
    PersonaInfo *list = NULL;
    size_t nl = 0;
    check("캐릭터 목록 (persona_list)", persona_list(&list, &nl));
    printf("         캐릭터 %zu명\n", nl);
    char first_id[OST3_ID_MAX] = "yunseo";
    if (nl > 0) snprintf(first_id, sizeof first_id, "%s", list[0].id);
    free(list);

    Persona p;
    memset(&p, 0, sizeof p);
    int r = persona_load(first_id, &p);
    check("페르소나 불러오기 (persona_load)", r);
    if (r == ERR_OK) {
        printf("         %s (%s)\n", p.info.name, p.info.work);
        check("페르소나 검증 (persona_validate)", persona_validate(p.json));
        char *prompt = NULL;
        check("캐릭터 설명문 (persona_build_prompt)",
              persona_build_prompt(&p, study, "이 문제 어떻게 풀어?", &prompt));
        free(prompt);
        persona_free(&p);
    }

    PersonaCreateRequest creq = { "테스트 캐릭터", "자체 창작", "차분함" };
    Persona created;
    memset(&created, 0, sizeof created);
    r = persona_create(&creq, on_progress, NULL, &created);
    check("페르소나 생성 (persona_create)", r);
    if (r == ERR_OK) {
        check("생성한 페르소나 삭제 (persona_delete)", persona_delete(created.info.id));
        persona_free(&created);
    }

    printf("\n[3] 똥: 대화 기록\n");
    Conversation c, recent;
    conversation_init(&c);
    check("메시지 추가 (conversation_push)", conversation_push(&c, ROLE_USER, "안녕"));
    conversation_push(&c, ROLE_ASSISTANT, "응.");
    conversation_push(&c, ROLE_USER, "뭐 해?");
    check("최근 대화 고르기 (memory_recent)", memory_recent(&c, 2, &recent));
    printf("         %zu개 중 최근 %zu개\n", c.count, recent.count);
    conversation_free(&recent);
    conversation_free(&c);
    check("기록 초기화 (memory_clear)", memory_clear(first_id));

    printf("\n[4] 똥: API 엔진 (대화 한 턴)\n");
    ChatRequest req = { first_id, study, "안녕, 오늘 물리 공부 좀 도와줄래?", 0 };
    char *reply = NULL;
    printf("         답변: ");
    r = api_chat(&req, on_chunk, NULL, &reply);
    printf("\n");
    check("대화 (api_chat)", r);
    free(reply);
    reply = NULL;

    req.baseline = 1;
    r = api_chat(&req, NULL, NULL, &reply);
    check("비교용 단순 프롬프트 모드 (api_chat baseline)", r);
    free(reply);

    Conversation saved;
    r = memory_load(first_id, &saved);
    check("저장된 대화 불러오기 (memory_load)", r);
    if (r == ERR_OK) {
        printf("         저장된 메시지 %zu개\n", saved.count);
        conversation_free(&saved);
    }
    memory_clear(first_id);

    purpose_list_free(purposes, nu);

    printf("\n결과: %s (실패 %d개)\n", g_fail ? "실패" : "통과", g_fail);
    return g_fail ? 1 : 0;
}

/* ---------- main ---------- */

int main(int argc, char **argv)
{
    platform_init();

    int selftest = 0;
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--selftest") == 0) {
            selftest = 1;
        } else if (strcmp(argv[i], "--version") == 0) {
            printf("OpenSourceT3 %s\n", OST3_VERSION);
            return 0;
        } else {
            printf("사용법: %s [--selftest | --version]\n", argv[0]);
            return strcmp(argv[i], "--help") == 0 ? 0 : 2;
        }
    }

    AppConfig cfg;
    config_defaults(&cfg);
    int r = config_load(&cfg);
    if (r != ERR_OK && r != ERR_NOT_FOUND) {
        fprintf(stderr, "설정 파일을 읽지 못했습니다: %s\n", err_to_string(r));
    }

    /* 각 모듈에 설정 전달 (cfg는 main이 끝날 때까지 살아 있음) */
    memory_set_config(&cfg);
    persona_set_config(&cfg);
    r = api_init(&cfg);
    if (r != ERR_OK) {
        fprintf(stderr, "API 엔진 초기화 실패: %s\n", err_to_string(r));
        return 1;
    }

    int exit_code;
    if (selftest) {
        exit_code = run_selftest(&cfg);
    } else {
        if (!config_has_api_key(&cfg)) {
            r = ui_setup_config(&cfg);
            if (r != ERR_OK) { api_cleanup(); return r == ERR_CANCELLED ? 0 : 1; }
        }
        exit_code = ui_run(&cfg) == ERR_OK ? 0 : 1;
    }

    api_cleanup();
    fflush(stdout);
    return exit_code;
}
