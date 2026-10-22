/*
 * purpose.c — 사용 목적 목록(purposes.json) 읽기
 * [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
 */
#include "purpose.h"
#include "platform.h"
#include "cJSON.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

const char *purpose_crisis_notice(void)
{
    return "※ 이 대화는 AI 캐릭터와의 대화이며 전문 상담을 대신하지 않습니다.\n"
           "  마음이 많이 힘들거나 위험하다고 느껴지면 자살예방 상담전화 109,\n"
           "  정신건강 위기상담 1577-0199 로 연락하거나, 긴급할 때는 119·112에 연락하세요.";
}

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

void purpose_free(Purpose *p)
{
    if (!p) return;
    free(p->description);
    free(p->instruction);
    p->description = NULL;
    p->instruction = NULL;
}

void purpose_list_free(Purpose *list, size_t count)
{
    if (!list) return;
    for (size_t i = 0; i < count; i++) purpose_free(&list[i]);
    free(list);
}

int purpose_list_load(const AppConfig *cfg, Purpose **list, size_t *count)
{
    if (!cfg || !list || !count) return ERR_INVALID_ARG;
    *list = NULL;
    *count = 0;

    char path[OST3_PATH_MAX];
    if (platform_join_path(path, sizeof path, cfg->assets_dir, "purposes.json") != ERR_OK)
        return ERR_INVALID_ARG;
    char *text = NULL;
    int r = platform_read_file(path, &text, NULL);
    if (r != ERR_OK) return r;
    cJSON *root = cJSON_Parse(text);
    free(text);
    const cJSON *arr = cJSON_GetObjectItemCaseSensitive(root, "purposes");
    if (!cJSON_IsArray(arr)) { cJSON_Delete(root); return ERR_PARSE; }

    int n = cJSON_GetArraySize(arr);
    Purpose *items = calloc(n > 0 ? (size_t)n : 1, sizeof *items);
    if (!items) { cJSON_Delete(root); return ERR_NO_MEMORY; }

    size_t i = 0;
    const cJSON *it;
    cJSON_ArrayForEach(it, arr) {
        Purpose *p = &items[i++];
        copy_field(p->id,       sizeof p->id,       it, "id");
        copy_field(p->name,     sizeof p->name,     it, "name");
        copy_field(p->category, sizeof p->category, it, "category");
        p->description = dup_field(it, "description");
        p->instruction = dup_field(it, "instruction");
        const cJSON *tier = cJSON_GetObjectItemCaseSensitive(it, "tier");
        p->tier = (cJSON_IsString(tier) && strcmp(tier->valuestring, "heavy") == 0)
                  ? TIER_HEAVY : TIER_LIGHT;
        p->use_expertise = cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(it, "use_expertise"));
        p->crisis_notice = cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(it, "crisis_notice"));
        if (!p->description || !p->instruction) {
            purpose_list_free(items, i);
            cJSON_Delete(root);
            return ERR_NO_MEMORY;
        }
    }
    cJSON_Delete(root);
    *list = items;
    *count = i;
    return ERR_OK;
}

int purpose_make_custom(const char *user_text, Purpose *out)
{
    if (!user_text || !*user_text || !out) return ERR_INVALID_ARG;
    memset(out, 0, sizeof *out);
    snprintf(out->id, sizeof out->id, "%s", "custom");
    snprintf(out->name, sizeof out->name, "%s", user_text);
    snprintf(out->category, sizeof out->category, "%s", "기타");
    out->description = ost3_strdup(user_text);

    const char *fmt = "사용자가 직접 정한 대화 목적: \"%s\". "
                      "캐릭터의 성격과 말투를 유지하면서 이 목적에 맞게 도와준다.";
    size_t n = strlen(fmt) + strlen(user_text) + 1;
    out->instruction = malloc(n);
    if (out->instruction) snprintf(out->instruction, n, fmt, user_text);

    out->tier = TIER_LIGHT;
    if (!out->description || !out->instruction) { purpose_free(out); return ERR_NO_MEMORY; }
    return ERR_OK;
}

int purpose_copy(const Purpose *src, Purpose *out)
{
    if (!src || !out) return ERR_INVALID_ARG;
    *out = *src;
    out->description = ost3_strdup(src->description ? src->description : "");
    out->instruction = ost3_strdup(src->instruction ? src->instruction : "");
    if (!out->description || !out->instruction) { purpose_free(out); return ERR_NO_MEMORY; }
    return ERR_OK;
}
