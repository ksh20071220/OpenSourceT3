/*
 * config.c — 설정 파일(config.json)과 API 회사 목록(providers.json)
 * [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
 */
#include "config.h"
#include "platform.h"
#include "cJSON.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* JSON 문자열 필드를 고정 크기 버퍼로 복사 (없으면 빈 문자열) */
static void copy_field(char *dst, size_t size, const cJSON *obj, const char *key)
{
    const cJSON *v = cJSON_GetObjectItemCaseSensitive(obj, key);
    const char *s = cJSON_IsString(v) && v->valuestring ? v->valuestring : "";
    snprintf(dst, size, "%s", s);
}

static char *dup_field(const cJSON *obj, const char *key)
{
    const cJSON *v = cJSON_GetObjectItemCaseSensitive(obj, key);
    return ost3_strdup(cJSON_IsString(v) && v->valuestring ? v->valuestring : "");
}

void config_defaults(AppConfig *cfg)
{
    if (!cfg) return;
    memset(cfg, 0, sizeof *cfg);
    cfg->temperature = -1.0;
    snprintf(cfg->data_dir, sizeof cfg->data_dir, "%s", "data");
    snprintf(cfg->assets_dir, sizeof cfg->assets_dir, "%s", "assets");
}

static int config_path(const AppConfig *cfg, char *out, size_t size)
{
    return platform_join_path(out, size, cfg->data_dir, "config.json");
}

int config_load(AppConfig *cfg)
{
    if (!cfg) return ERR_INVALID_ARG;
    char path[OST3_PATH_MAX];
    if (config_path(cfg, path, sizeof path) != ERR_OK) return ERR_INVALID_ARG;

    char *text = NULL;
    int r = platform_read_file(path, &text, NULL);
    if (r != ERR_OK) return r;
    cJSON *root = cJSON_Parse(text);
    free(text);
    if (!cJSON_IsObject(root)) { cJSON_Delete(root); return ERR_PARSE; }

    copy_field(cfg->provider,    sizeof cfg->provider,    root, "provider");
    copy_field(cfg->base_url,    sizeof cfg->base_url,    root, "base_url");
    copy_field(cfg->api_key,     sizeof cfg->api_key,     root, "api_key");
    copy_field(cfg->search_key,  sizeof cfg->search_key,  root, "search_key");
    copy_field(cfg->model_light, sizeof cfg->model_light, root, "model_light");
    copy_field(cfg->model_heavy, sizeof cfg->model_heavy, root, "model_heavy");
    const cJSON *t = cJSON_GetObjectItemCaseSensitive(root, "temperature");
    cfg->temperature = cJSON_IsNumber(t) ? t->valuedouble : -1.0;

    cJSON_Delete(root);
    return ERR_OK;
}

int config_save(const AppConfig *cfg)
{
    if (!cfg) return ERR_INVALID_ARG;
    char path[OST3_PATH_MAX];
    if (config_path(cfg, path, sizeof path) != ERR_OK) return ERR_INVALID_ARG;

    cJSON *root = cJSON_CreateObject();
    if (!root) return ERR_NO_MEMORY;
    cJSON_AddStringToObject(root, "provider",    cfg->provider);
    cJSON_AddStringToObject(root, "base_url",    cfg->base_url);
    cJSON_AddStringToObject(root, "api_key",     cfg->api_key);
    cJSON_AddStringToObject(root, "search_key",  cfg->search_key);
    cJSON_AddStringToObject(root, "model_light", cfg->model_light);
    cJSON_AddStringToObject(root, "model_heavy", cfg->model_heavy);
    cJSON_AddNumberToObject(root, "temperature", cfg->temperature);
    char *text = cJSON_Print(root);
    cJSON_Delete(root);
    if (!text) return ERR_NO_MEMORY;
    int r = platform_write_file(path, text, strlen(text));
    cJSON_free(text);
    return r;
}

int config_has_api_key(const AppConfig *cfg)
{
    return cfg && cfg->api_key[0] != '\0';
}

/* ---------- API 회사 목록 ---------- */

int provider_list_load(const AppConfig *cfg, ProviderInfo **list, size_t *count)
{
    if (!cfg || !list || !count) return ERR_INVALID_ARG;
    *list = NULL;
    *count = 0;

    char path[OST3_PATH_MAX];
    if (platform_join_path(path, sizeof path, cfg->assets_dir, "providers.json") != ERR_OK)
        return ERR_INVALID_ARG;
    char *text = NULL;
    int r = platform_read_file(path, &text, NULL);
    if (r != ERR_OK) return r;
    cJSON *root = cJSON_Parse(text);
    free(text);
    const cJSON *arr = cJSON_GetObjectItemCaseSensitive(root, "providers");
    if (!cJSON_IsArray(arr)) { cJSON_Delete(root); return ERR_PARSE; }

    int n = cJSON_GetArraySize(arr);
    ProviderInfo *items = calloc(n > 0 ? (size_t)n : 1, sizeof *items);
    if (!items) { cJSON_Delete(root); return ERR_NO_MEMORY; }

    size_t i = 0;
    const cJSON *it;
    cJSON_ArrayForEach(it, arr) {
        ProviderInfo *p = &items[i++];
        copy_field(p->id,         sizeof p->id,         it, "id");
        copy_field(p->name,       sizeof p->name,       it, "name");
        copy_field(p->base_url,   sizeof p->base_url,   it, "base_url");
        copy_field(p->key_url,    sizeof p->key_url,    it, "key_url");
        copy_field(p->models_url, sizeof p->models_url, it, "models_url");
        /* guide는 문자열 배열 → 줄바꿈으로 합침 */
        const cJSON *g = cJSON_GetObjectItemCaseSensitive(it, "guide");
        size_t glen = 1;
        const cJSON *line;
        cJSON_ArrayForEach(line, g)
            if (cJSON_IsString(line)) glen += strlen(line->valuestring) + 1;
        p->guide = calloc(glen, 1);
        if (p->guide) {
            cJSON_ArrayForEach(line, g) {
                if (!cJSON_IsString(line)) continue;
                strcat(p->guide, line->valuestring);
                strcat(p->guide, "\n");
            }
        }
        p->note = dup_field(it, "note");
        if (!p->guide || !p->note) {
            provider_list_free(items, i);
            cJSON_Delete(root);
            return ERR_NO_MEMORY;
        }
    }
    cJSON_Delete(root);
    *list = items;
    *count = i;
    return ERR_OK;
}

void provider_list_free(ProviderInfo *list, size_t count)
{
    if (!list) return;
    for (size_t i = 0; i < count; i++) {
        free(list[i].guide);
        free(list[i].note);
    }
    free(list);
}

void config_apply_provider(AppConfig *cfg, const ProviderInfo *p)
{
    if (!cfg || !p) return;
    snprintf(cfg->provider, sizeof cfg->provider, "%s", p->id);
    snprintf(cfg->base_url, sizeof cfg->base_url, "%s", p->base_url);
}
