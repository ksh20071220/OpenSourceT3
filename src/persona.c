/*
 * persona.c — 페르소나 생성 및 관리 (근거 평가·인격 추론)
 * [담당: 손석현] 이 파일은 손석현만 수정한다. 규격(함수 모양)은 include/persona.h
 *            JSON 형식 문서는 docs/persona-schema.md (손석현 관리)
 *
 * ─────────────────────────────────────────────────────────────
 *  현재 상태: 깡통(더미) 구현
 *   - persona_load / persona_list / persona_delete / persona_validate 는
 *     기본 동작을 한다 (샘플 assets/personas/yunseo.json 사용)
 *   - persona_create 는 검색·추론 없이 샘플을 복사해 이름만 바꾼다
 *   - persona_build_prompt 는 이름·말투·가치관 정도만 넣는다
 *
 *  TODO(손석현):
 *   [ ] persona_create: api_search()로 설정·대사·행적 수집 → 출처별 신뢰도 평가
 *       → api_complete(TIER_HEAVY)로 근거 기반 인격 추론 → JSON 생성 → 검증 → 저장
 *   [ ] persona_build_prompt: 사용자 입력과 관련된 behavior_rules, 목적에 맞는
 *       expertise, speech_style, uncertainties 만 골라 설명문 만들기 (토큰 절약)
 *   [ ] persona_validate: docs/persona-schema.md 의 필수 필드 전부 검사
 *   [ ] (그림 2) 참고 자료 캐시: <data_dir>/cache/ 에 검색 결과 보관
 * ─────────────────────────────────────────────────────────────
 */
#include "persona.h"
#include "api.h"
#include "platform.h"
#include "cJSON.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const AppConfig *g_cfg = NULL;

void persona_set_config(const AppConfig *cfg)
{
    g_cfg = cfg;
}

/* ID는 파일 이름이 되므로 영문 소문자·숫자·_ 만 허용 ("../" 같은 경로 공격 방지) */
static int valid_id(const char *id)
{
    if (!id || !*id || strlen(id) >= OST3_ID_MAX) return 0;
    for (const char *p = id; *p; p++)
        if (!((*p >= 'a' && *p <= 'z') || (*p >= '0' && *p <= '9') || *p == '_')) return 0;
    return 1;
}

/* base/personas/<id>.json 경로 만들기 */
static int persona_path(const char *base, const char *id, char *out, size_t size)
{
    char dir[OST3_PATH_MAX], file[OST3_ID_MAX + 8];
    snprintf(file, sizeof file, "%s.json", id);
    if (platform_join_path(dir, sizeof dir, base, "personas") != ERR_OK) return ERR_INVALID_ARG;
    return platform_join_path(out, size, dir, file);
}

static void fill_info(PersonaInfo *info, const char *id, const cJSON *root)
{
    memset(info, 0, sizeof *info);
    snprintf(info->id, sizeof info->id, "%s", id);
    const cJSON *ch = cJSON_GetObjectItemCaseSensitive(root, "character");
    const cJSON *name = cJSON_GetObjectItemCaseSensitive(ch, "name");
    const cJSON *src = cJSON_GetObjectItemCaseSensitive(ch, "source");
    snprintf(info->name, sizeof info->name, "%s", cJSON_IsString(name) ? name->valuestring : id);
    snprintf(info->work, sizeof info->work, "%s", cJSON_IsString(src) ? src->valuestring : "");
}

int persona_validate(const char *json)
{
    if (!json) return ERR_INVALID_ARG;
    cJSON *root = cJSON_Parse(json);
    if (!root) return ERR_PARSE;
    /* TODO(손석현): 필수 필드 전체 검사 (지금은 최소 필드만) */
    const cJSON *ver = cJSON_GetObjectItemCaseSensitive(root, "schema_version");
    const cJSON *ch = cJSON_GetObjectItemCaseSensitive(root, "character");
    const cJSON *name = cJSON_GetObjectItemCaseSensitive(ch, "name");
    int ok = cJSON_IsString(ver) && cJSON_IsObject(ch) && cJSON_IsString(name);
    cJSON_Delete(root);
    return ok ? ERR_OK : ERR_PARSE;
}

int persona_load(const char *id, Persona *out)
{
    if (!out) return ERR_INVALID_ARG;
    memset(out, 0, sizeof *out);
    if (!g_cfg || !valid_id(id)) return ERR_INVALID_ARG;

    /* 사용자 데이터 → 샘플 순서로 찾음 */
    const char *bases[2] = { g_cfg->data_dir, g_cfg->assets_dir };
    char *text = NULL;
    int r = ERR_NOT_FOUND;
    for (int i = 0; i < 2 && r == ERR_NOT_FOUND; i++) {
        char path[OST3_PATH_MAX];
        if (persona_path(bases[i], id, path, sizeof path) != ERR_OK) continue;
        r = platform_read_file(path, &text, NULL);
    }
    if (r != ERR_OK) return r;

    cJSON *root = cJSON_Parse(text);
    if (!root || persona_validate(text) != ERR_OK) {
        cJSON_Delete(root);
        free(text);
        return ERR_PARSE;
    }
    fill_info(&out->info, id, root);
    cJSON_Delete(root);
    out->json = text;
    return ERR_OK;
}

void persona_free(Persona *p)
{
    if (!p) return;
    free(p->json);
    p->json = NULL;
}

int persona_list(PersonaInfo **list, size_t *count)
{
    if (!list || !count) return ERR_INVALID_ARG;
    *list = NULL;
    *count = 0;
    if (!g_cfg) return ERR_INVALID_ARG;

    const char *bases[2] = { g_cfg->data_dir, g_cfg->assets_dir };
    PersonaInfo *items = NULL;
    size_t n = 0, cap = 0;

    for (int b = 0; b < 2; b++) {
        char dir[OST3_PATH_MAX];
        if (platform_join_path(dir, sizeof dir, bases[b], "personas") != ERR_OK) continue;
        char **names = NULL;
        size_t nn = 0;
        if (platform_list_dir(dir, ".json", &names, &nn) != ERR_OK) continue;
        for (size_t i = 0; i < nn; i++) {
            char id[OST3_ID_MAX];
            snprintf(id, sizeof id, "%.*s", (int)(strlen(names[i]) - 5), names[i]);
            if (!valid_id(id)) continue;
            int dup = 0;
            for (size_t k = 0; k < n; k++) if (strcmp(items[k].id, id) == 0) dup = 1;
            if (dup) continue;
            Persona p;
            if (persona_load(id, &p) != ERR_OK) continue;
            if (n == cap) {
                cap = cap ? cap * 2 : 8;
                PersonaInfo *ni = realloc(items, cap * sizeof *ni);
                if (!ni) { persona_free(&p); platform_free_list(names, nn); free(items); return ERR_NO_MEMORY; }
                items = ni;
            }
            items[n++] = p.info;
            persona_free(&p);
        }
        platform_free_list(names, nn);
    }
    *list = items;
    *count = n;
    return ERR_OK;
}

static void progress(PersonaProgressFn fn, void *user, const char *step, int pct)
{
    if (fn) fn(step, pct, user);
}

int persona_create(const PersonaCreateRequest *req, PersonaProgressFn on_progress,
                   void *user, Persona *out)
{
    if (!out) return ERR_INVALID_ARG;
    memset(out, 0, sizeof *out);
    if (!g_cfg || !req || !req->name || !*req->name) return ERR_INVALID_ARG;

    /* 1. 자료 수집 (더미: 검색 결과는 쓰지 않음) */
    progress(on_progress, user, "자료 검색 중 (더미)", 10);
    SearchResults found;
    int r = api_search(req->name, 5, &found);
    if (r != ERR_OK) return r;
    search_results_free(&found);

    /* 2. 근거 평가·인격 추론 (더미: 고성능 모델 호출 흉내만) */
    progress(on_progress, user, "인격 추론 중 (더미)", 50);
    char *reasoning = NULL;
    r = api_complete("너는 캐릭터 분석가다.", req->name, TIER_HEAVY, &reasoning);
    if (r != ERR_OK) return r;
    free(reasoning);

    /* 3. JSON 만들기 (더미: 샘플을 복사하고 이름·작품명만 교체) */
    progress(on_progress, user, "페르소나 JSON 생성 중 (더미)", 80);
    Persona sample;
    r = persona_load("yunseo", &sample);
    if (r != ERR_OK) return r;
    cJSON *root = cJSON_Parse(sample.json);
    persona_free(&sample);
    if (!root) return ERR_PARSE;
    cJSON *ch = cJSON_GetObjectItemCaseSensitive(root, "character");
    cJSON_ReplaceItemInObjectCaseSensitive(ch, "name", cJSON_CreateString(req->name));
    cJSON_ReplaceItemInObjectCaseSensitive(ch, "source",
        cJSON_CreateString(req->work && *req->work ? req->work : "알 수 없음"));
    cJSON_ReplaceItemInObjectCaseSensitive(ch, "setting_version", cJSON_CreateString("더미 생성"));
    char *json = cJSON_Print(root);
    cJSON_Delete(root);
    if (!json) return ERR_NO_MEMORY;

    /* 4. 저장: ID는 char_1, char_2 … 중 빈 번호 (TODO(손석현): 이름 기반 ID 규칙 정하기) */
    progress(on_progress, user, "저장 중", 95);
    char id[OST3_ID_MAX], path[OST3_PATH_MAX];
    for (int i = 1; i < 10000; i++) {
        snprintf(id, sizeof id, "char_%d", i);
        if (persona_path(g_cfg->data_dir, id, path, sizeof path) != ERR_OK) { cJSON_free(json); return ERR_INVALID_ARG; }
        if (!platform_file_exists(path)) break;
    }
    r = platform_write_file(path, json, strlen(json));
    cJSON_free(json);
    if (r != ERR_OK) return r;

    progress(on_progress, user, "완료", 100);
    return persona_load(id, out);
}

int persona_delete(const char *id)
{
    if (!g_cfg || !valid_id(id)) return ERR_INVALID_ARG;
    char path[OST3_PATH_MAX];
    if (persona_path(g_cfg->data_dir, id, path, sizeof path) != ERR_OK) return ERR_INVALID_ARG;
    return platform_remove_file(path);   /* 샘플(assets)은 지우지 않음 */
}

/* ---------- 캐릭터 설명문 ---------- */

/* 문자열 이어 붙이기 도우미 */
typedef struct { char *buf; size_t len, cap; int oom; } StrBuf;

static void sb_add(StrBuf *sb, const char *s)
{
    if (sb->oom || !s) return;
    size_t n = strlen(s);
    if (sb->len + n + 1 > sb->cap) {
        size_t nc = sb->cap ? sb->cap : 256;
        while (sb->len + n + 1 > nc) nc *= 2;
        char *nb = realloc(sb->buf, nc);
        if (!nb) { sb->oom = 1; return; }
        sb->buf = nb;
        sb->cap = nc;
    }
    memcpy(sb->buf + sb->len, s, n + 1);
    sb->len += n;
}

static void sb_add_array(StrBuf *sb, const char *label, const cJSON *arr)
{
    if (!cJSON_IsArray(arr) || cJSON_GetArraySize(arr) == 0) return;
    sb_add(sb, label);
    const cJSON *it;
    int first = 1;
    cJSON_ArrayForEach(it, arr) {
        if (!cJSON_IsString(it)) continue;
        if (!first) sb_add(sb, ", ");
        sb_add(sb, it->valuestring);
        first = 0;
    }
    sb_add(sb, "\n");
}

int persona_build_prompt(const Persona *p, const Purpose *purpose,
                         const char *user_text, char **out)
{
    if (!p || !p->json || !out) return ERR_INVALID_ARG;
    *out = NULL;
    (void)user_text; /* TODO(손석현): 입력과 관련된 behavior_rules 고르기 */

    cJSON *root = cJSON_Parse(p->json);
    if (!root) return ERR_PARSE;
    StrBuf sb = { 0 };

    sb_add(&sb, "너는 '");
    sb_add(&sb, p->info.name);
    sb_add(&sb, "'(출처: ");
    sb_add(&sb, p->info.work);
    sb_add(&sb, ")이다. 아래 설정에 맞게 생각하고 말한다.\n");

    const cJSON *pers = cJSON_GetObjectItemCaseSensitive(root, "personality");
    const cJSON *style = cJSON_GetObjectItemCaseSensitive(pers, "speech_style");
    const cJSON *tone = cJSON_GetObjectItemCaseSensitive(style, "tone");
    if (cJSON_IsString(tone)) {
        sb_add(&sb, "말투: ");
        sb_add(&sb, tone->valuestring);
        sb_add(&sb, "\n");
    }
    sb_add_array(&sb, "가치관: ", cJSON_GetObjectItemCaseSensitive(pers, "values"));

    if (purpose && purpose->use_expertise) {
        const cJSON *ex = cJSON_GetObjectItemCaseSensitive(root, "expertise");
        sb_add_array(&sb, "잘하는 것: ", cJSON_GetObjectItemCaseSensitive(ex, "strengths"));
        sb_add_array(&sb, "약한 것: ", cJSON_GetObjectItemCaseSensitive(ex, "limitations"));
    }
    sb_add(&sb, "설정에 없는 상황은 위 성격과 가치관에 맞게 추론해서 행동한다.\n");
    cJSON_Delete(root);

    if (sb.oom) { free(sb.buf); return ERR_NO_MEMORY; }
    *out = sb.buf;
    return ERR_OK;
}
