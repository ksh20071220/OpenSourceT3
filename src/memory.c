/*
 * memory.c — 대화 기록 및 기억 관리
 * [담당: 오승민] 이 파일은 오승민만 수정한다. 규격(함수 모양)은 include/memory.h
 *
 * ─────────────────────────────────────────────────────────────
 *  현재 상태: 깡통(더미) 구현
 *   - Conversation 함수들은 실제로 동작한다 (그대로 써도 됨)
 *   - memory_load/append/clear/summary 는 파일 대신 "프로그램 메모리"에만
 *     저장한다. 프로그램을 끄면 사라진다.
 *
 *  TODO(오승민):
 *   [ ] <data_dir>/history/<character_id>.jsonl 파일에 한 줄에 메시지 하나씩 저장
 *       (platform_append_file, platform_read_file 사용 → Windows 한글 경로 자동 대응)
 *   [ ] memory_load 에서 파일을 읽어 Conversation 으로 복원
 *   [ ] 장기 기억: 오래된 대화를 api_complete()로 요약해 memory_set_summary()로 저장
 * ─────────────────────────────────────────────────────────────
 */
#include "memory.h"
#include "platform.h"

#include <stdlib.h>
#include <string.h>

static const AppConfig *g_cfg = NULL;

void memory_set_config(const AppConfig *cfg)
{
    g_cfg = cfg;
}

/* ---------- Conversation (실제 구현) ---------- */

void conversation_init(Conversation *conv)
{
    if (!conv) return;
    conv->items = NULL;
    conv->count = 0;
    conv->capacity = 0;
}

void conversation_free(Conversation *conv)
{
    if (!conv) return;
    for (size_t i = 0; i < conv->count; i++) free(conv->items[i].content);
    free(conv->items);
    conversation_init(conv);
}

int conversation_push(Conversation *conv, Role role, const char *content)
{
    if (!conv || !content) return ERR_INVALID_ARG;
    if (conv->count == conv->capacity) {
        size_t nc = conv->capacity ? conv->capacity * 2 : 8;
        Message *n = realloc(conv->items, nc * sizeof *n);
        if (!n) return ERR_NO_MEMORY;
        conv->items = n;
        conv->capacity = nc;
    }
    char *copy = ost3_strdup(content);
    if (!copy) return ERR_NO_MEMORY;
    conv->items[conv->count].role = role;
    conv->items[conv->count].content = copy;
    conv->count++;
    return ERR_OK;
}

int memory_recent(const Conversation *conv, size_t max_messages, Conversation *out)
{
    if (!conv || !out) return ERR_INVALID_ARG;
    conversation_init(out);
    size_t start = conv->count > max_messages ? conv->count - max_messages : 0;
    for (size_t i = start; i < conv->count; i++) {
        int r = conversation_push(out, conv->items[i].role, conv->items[i].content);
        if (r != ERR_OK) { conversation_free(out); return r; }
    }
    return ERR_OK;
}

/* ---------- 저장소 (더미: 프로그램 메모리에만 보관) ---------- */

typedef struct Slot {
    char          id[OST3_ID_MAX];
    Conversation  conv;
    char         *summary;
    struct Slot  *next;
} Slot;

static Slot *g_slots = NULL;

static Slot *find_slot(const char *id, int create)
{
    for (Slot *s = g_slots; s; s = s->next)
        if (strcmp(s->id, id) == 0) return s;
    if (!create) return NULL;
    Slot *s = calloc(1, sizeof *s);
    if (!s) return NULL;
    strncpy(s->id, id, sizeof s->id - 1);
    conversation_init(&s->conv);
    s->next = g_slots;
    g_slots = s;
    return s;
}

static void free_slot(Slot *s)
{
    conversation_free(&s->conv);
    free(s->summary);
    free(s);
}

int memory_load(const char *character_id, Conversation *out)
{
    if (!character_id || !out) return ERR_INVALID_ARG;
    (void)g_cfg; /* TODO(오승민): g_cfg->data_dir 아래 history 폴더에서 읽기 */
    conversation_init(out);
    Slot *s = find_slot(character_id, 0);
    if (!s) return ERR_OK;
    return memory_recent(&s->conv, s->conv.count, out); /* 전체 복사 */
}

int memory_append(const char *character_id, Role role, const char *content)
{
    if (!character_id || !content) return ERR_INVALID_ARG;
    Slot *s = find_slot(character_id, 1);
    if (!s) return ERR_NO_MEMORY;
    return conversation_push(&s->conv, role, content);
}

int memory_clear(const char *character_id)
{
    if (!character_id) return ERR_INVALID_ARG;
    for (Slot **pp = &g_slots; *pp; pp = &(*pp)->next) {
        if (strcmp((*pp)->id, character_id) == 0) {
            Slot *s = *pp;
            *pp = s->next;
            free_slot(s);
            break;
        }
    }
    return ERR_OK;
}

int memory_get_summary(const char *character_id, char **out)
{
    if (!character_id || !out) return ERR_INVALID_ARG;
    Slot *s = find_slot(character_id, 0);
    *out = ost3_strdup(s && s->summary ? s->summary : "");
    return *out ? ERR_OK : ERR_NO_MEMORY;
}

int memory_set_summary(const char *character_id, const char *summary)
{
    if (!character_id || !summary) return ERR_INVALID_ARG;
    Slot *s = find_slot(character_id, 1);
    if (!s) return ERR_NO_MEMORY;
    char *copy = ost3_strdup(summary);
    if (!copy) return ERR_NO_MEMORY;
    free(s->summary);
    s->summary = copy;
    return ERR_OK;
}
