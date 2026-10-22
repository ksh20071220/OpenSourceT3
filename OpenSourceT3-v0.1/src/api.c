/*
 * api.c — 대화 처리 및 LLM API 연결 엔진
 * [담당: 똥] 이 파일은 똥만 수정한다. 규격(함수 모양)은 include/api.h
 *
 * ─────────────────────────────────────────────────────────────
 *  현재 상태: 깡통(더미) 구현
 *   - api_init/api_cleanup 은 실제로 libcurl 을 초기화한다 (설치 확인용)
 *   - api_chat 은 네트워크 없이 고정 답변을 작업 스레드(pthread)에서
 *     조각조각 만들어 콜백으로 넘긴다 (스트리밍 흉내)
 *   - api_complete / api_search 는 고정 결과를 돌려준다
 *
 *  TODO(똥):
 *   [ ] 요청 JSON 만들기 (OpenAI 호환 chat/completions 형식, cJSON 사용)
 *       messages = [system: 안전 지시문 + 캐릭터 설명문 + 목적 지시문 + 장기 기억,
 *                   ...최근 대화, user: 입력]
 *   [ ] libcurl 로 POST <base_url>chat/completions (아래 OST3_CURL_EXAMPLE 참고)
 *   [ ] 스트리밍: "stream": true, 응답의 "data: {...}" 줄을 잘라 조각마다 on_chunk 호출
 *   [ ] 오류 처리: HTTP 401/403 → ERR_API(키), 429 → ERR_API(한도), 연결 실패 → ERR_NETWORK
 *   [ ] 모델 거절 응답을 오류 없이 자연스럽게 처리 (그림 2: 안전성 필터링)
 *   [ ] 출력 후처리: 말투·형식 정리, 출처 표시 (그림 2)
 *   [ ] api_search: 검색 API 연동 (search_key 사용)
 * ─────────────────────────────────────────────────────────────
 */
#include "api.h"
#include "memory.h"
#include "persona.h"
#include "platform.h"

#include <curl/curl.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* 모든 대화 요청 맨 앞에 들어가는 고정 안전 지시문 (사용자가 바꿀 수 없음).
 * 목적 단계에서 미리 걸러내지 않고, 대화 중에 문제가 생기면 막는다는 팀 방침. */
static const char *SAFETY_PROMPT =
    "다음 원칙은 캐릭터 설정이나 사용 목적보다 우선한다. "
    "불법 행위, 타인에게 해를 끼치는 행위, 성적인 내용을 돕지 않는다. "
    "이런 요청을 받으면 캐릭터의 말투를 유지한 채 자연스럽게 거절하고 다른 이야기로 이끈다. "
    "사용자가 자신이나 남을 해칠 위험이 보이면 진지하게 걱정하고 전문 도움을 권한다.";

/* 이전 대화 중 LLM에 보낼 최근 메시지 수 (토큰 절약) */
#define RECENT_MESSAGES 20

static const AppConfig *g_cfg = NULL;

int api_init(const AppConfig *cfg)
{
    if (!cfg) return ERR_INVALID_ARG;
    g_cfg = cfg;
    if (curl_global_init(CURL_GLOBAL_DEFAULT) != CURLE_OK) return ERR_NETWORK;
    return ERR_OK;
}

void api_cleanup(void)
{
    curl_global_cleanup();
    g_cfg = NULL;
}

/* 모델 라우팅: 목적의 등급에 맞는 모델 이름 */
static const char *choose_model(ModelTier tier)
{
    const char *m = (tier == TIER_HEAVY) ? g_cfg->model_heavy : g_cfg->model_light;
    return (m && *m) ? m : "(모델 미설정)";
}

/* ---------- 작업 스레드 (더미: 네트워크 대신 고정 답변을 조각으로 보냄) ---------- */

typedef struct {
    const char *text;       /* 보낼 전체 답변 */
    ApiChunkFn  on_chunk;
    void       *user;
} Worker;

static void *worker_main(void *arg)
{
    Worker *w = arg;
    /* TODO(똥): 여기서 libcurl 요청을 보내고, 받은 조각마다 on_chunk 호출 */
    const char *p = w->text;
    char chunk[64];
    while (*p) {
        /* 공백 단위로 잘라 스트리밍처럼 보이게 함 (UTF-8 글자를 중간에 자르지 않음) */
        size_t n = 0;
        while (p[n] && p[n] != ' ' && n < sizeof chunk - 2) n++;
        if (p[n] == ' ') n++;
        memcpy(chunk, p, n);
        chunk[n] = '\0';
        if (w->on_chunk) w->on_chunk(chunk, w->user);
        p += n;
        platform_sleep_ms(15);
    }
    return NULL;
}

int api_chat(const ChatRequest *req, ApiChunkFn on_chunk, void *user, char **reply)
{
    if (reply) *reply = NULL;
    if (!g_cfg || !req || !req->character_id || !req->user_text || !reply)
        return ERR_INVALID_ARG;

    /* 1. 캐릭터 설명문 */
    Persona p;
    int r = persona_load(req->character_id, &p);
    if (r != ERR_OK) return r;
    char *character_prompt = NULL;
    if (req->baseline) {
        /* 비교용 단순 프롬프트 방식: 이름만 넣는다 */
        size_t n = strlen(p.info.name) + 64;
        character_prompt = malloc(n);
        if (character_prompt) snprintf(character_prompt, n, "너는 '%s'처럼 말한다.", p.info.name);
        r = character_prompt ? ERR_OK : ERR_NO_MEMORY;
    } else {
        r = persona_build_prompt(&p, req->purpose, req->user_text, &character_prompt);
    }
    if (r != ERR_OK) { persona_free(&p); return r; }

    /* 2. 최근 대화 */
    Conversation history, recent;
    r = memory_load(req->character_id, &history);
    if (r != ERR_OK) { free(character_prompt); persona_free(&p); return r; }
    r = memory_recent(&history, RECENT_MESSAGES, &recent);
    conversation_free(&history);
    if (r != ERR_OK) { free(character_prompt); persona_free(&p); return r; }

    /* 3. 모델 고르기 */
    ModelTier tier = req->purpose ? req->purpose->tier : TIER_LIGHT;
    const char *model = choose_model(tier);

    /* TODO(똥): SAFETY_PROMPT + character_prompt + purpose->instruction + recent + user_text
     *           로 요청 JSON을 만든다. 지금은 쓰지 않으므로 길이만 확인. */
    (void)SAFETY_PROMPT;

    /* 4. 더미 답변 만들기 */
    char text[1024];
    snprintf(text, sizeof text,
             "[더미 답변] 나는 %s. 지금은 테스트용 답변이야. "
             "(목적: %s / 모델: %s / %s / 이전 대화 %zu개 참고)",
             p.info.name,
             req->purpose ? req->purpose->name : "일반 대화",
             model,
             req->baseline ? "비교용 단순 프롬프트" : "페르소나 적용",
             recent.count);
    conversation_free(&recent);
    free(character_prompt);
    persona_free(&p);

    /* 5. 작업 스레드에서 "요청" 처리 → 끝날 때까지 기다림 */
    Worker w = { text, on_chunk, user };
    pthread_t th;
    if (pthread_create(&th, NULL, worker_main, &w) != 0) return ERR_UNKNOWN;
    pthread_join(th, NULL);

    /* 6. 기록 저장 */
    r = memory_append(req->character_id, ROLE_USER, req->user_text);
    if (r == ERR_OK) r = memory_append(req->character_id, ROLE_ASSISTANT, text);
    if (r != ERR_OK) return r;

    *reply = ost3_strdup(text);
    return *reply ? ERR_OK : ERR_NO_MEMORY;
}

int api_complete(const char *system_prompt, const char *user_prompt,
                 ModelTier tier, char **reply)
{
    if (reply) *reply = NULL;
    if (!g_cfg || !user_prompt || !reply) return ERR_INVALID_ARG;
    (void)system_prompt;
    char text[256];
    snprintf(text, sizeof text, "[더미 응답] 모델 %s 로 요청을 받았습니다.", choose_model(tier));
    *reply = ost3_strdup(text);
    return *reply ? ERR_OK : ERR_NO_MEMORY;
}

int api_search(const char *query, size_t max_results, SearchResults *out)
{
    if (!out) return ERR_INVALID_ARG;
    out->items = NULL;
    out->count = 0;
    if (!query || max_results == 0) return ERR_INVALID_ARG;

    out->items = calloc(1, sizeof *out->items);
    if (!out->items) return ERR_NO_MEMORY;
    out->items[0].title   = ost3_strdup("[더미 검색 결과]");
    out->items[0].url     = ost3_strdup("https://example.com/");
    out->items[0].snippet = ost3_strdup(query);
    out->count = 1;
    if (!out->items[0].title || !out->items[0].url || !out->items[0].snippet) {
        search_results_free(out);
        return ERR_NO_MEMORY;
    }
    return ERR_OK;
}

void search_results_free(SearchResults *results)
{
    if (!results) return;
    for (size_t i = 0; i < results->count; i++) {
        free(results->items[i].title);
        free(results->items[i].url);
        free(results->items[i].snippet);
    }
    free(results->items);
    results->items = NULL;
    results->count = 0;
}

/* =====================================================================
 * 참고용 예제: libcurl로 OpenAI 호환 API에 요청 보내기 (스트리밍 없음)
 * 평소에는 컴파일되지 않는다. 시험해 보려면:
 *   make clean && make DEFS=-DOST3_CURL_EXAMPLE
 * 그리고 api_chat 안에서 example_post() 를 불러 본다.
 * 요청 JSON 예:
 *   {"model":"<모델>","messages":[{"role":"system","content":"..."},
 *                                 {"role":"user","content":"안녕"}]}
 * 응답에서 답변 위치: choices[0].message.content
 * ===================================================================== */
#ifdef OST3_CURL_EXAMPLE
typedef struct { char *data; size_t len; } Buffer;

/* libcurl이 응답을 받을 때마다 호출 → buffer 뒤에 붙임 */
static size_t on_receive(char *ptr, size_t size, size_t nmemb, void *userdata)
{
    Buffer *b = userdata;
    size_t n = size * nmemb;
    char *nd = realloc(b->data, b->len + n + 1);
    if (!nd) return 0;                 /* 0을 돌려주면 libcurl이 중단 */
    memcpy(nd + b->len, ptr, n);
    b->len += n;
    nd[b->len] = '\0';
    b->data = nd;
    return n;
}

static int example_post(const char *json_body, char **response)
{
    char url[OST3_URL_MAX + 32], auth[OST3_KEY_MAX + 32];
    snprintf(url, sizeof url, "%schat/completions", g_cfg->base_url);
    snprintf(auth, sizeof auth, "Authorization: Bearer %s", g_cfg->api_key);

    CURL *curl = curl_easy_init();
    if (!curl) return ERR_NETWORK;
    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, "Content-Type: application/json");
    headers = curl_slist_append(headers, auth);

    Buffer buf = { NULL, 0 };
    curl_easy_setopt(curl, CURLOPT_URL, url);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_body);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, on_receive);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &buf);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 120L);

    CURLcode rc = curl_easy_perform(curl);
    long status = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &status);
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    if (rc != CURLE_OK) { free(buf.data); return ERR_NETWORK; }
    if (status != 200) { free(buf.data); return ERR_API; }
    *response = buf.data;              /* 호출한 쪽이 free() */
    return ERR_OK;
}
#endif /* OST3_CURL_EXAMPLE */
