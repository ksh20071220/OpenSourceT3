/*
 * api.h — 대화 처리 및 LLM API 연결 엔진
 * [공통 파일: 규격] 이 헤더의 수정은 PR + 팀원 3명 확인 후에만
 * [구현 담당: 똥]   src/api.c
 *
 * 제안서 기준:
 *   - libcurl + pthread 로 외부 LLM API와 통신 (요청은 작업 스레드에서 수행)
 *   - 사용자 API 키(BYOK), OpenAI 호환 형식 하나로 OpenAI/Gemini/Claude 지원
 *     (회사별로 AppConfig.base_url 만 다름)
 *   - 모델 라우팅: 목적의 tier에 따라 저비용/고성능 모델 선택
 *   - 스트리밍 응답 처리: 답변을 조각(chunk)으로 받아 콜백으로 전달
 *
 * 사용하는 쪽:
 *   응가(ui.c)       → api_chat()
 *   변(persona.c)    → api_complete(), api_search()
 */
#ifndef OST3_API_H
#define OST3_API_H

#include "common.h"
#include "purpose.h"

/* 프로그램 시작/종료 시 한 번씩 (libcurl 전역 초기화 등).
 * cfg는 api_cleanup() 전까지 유효해야 한다 (복사하지 않고 가리킴) */
int  api_init(const AppConfig *cfg);
void api_cleanup(void);

/* 스트리밍 콜백: 답변 조각이 도착할 때마다 호출 (작업 스레드에서 호출될 수 있음)
 * chunk : 이번에 도착한 텍스트 조각 (UTF-8, 콜백이 끝나면 무효)
 * user  : api_chat()에 넘긴 포인터 그대로 */
typedef void (*ApiChunkFn)(const char *chunk, void *user);

/* ---------- UI용: 캐릭터와 대화 한 턴 ---------- */
typedef struct {
    const char    *character_id;  /* 페르소나 ID (persona.h) */
    const Purpose *purpose;       /* 사용 목적 (NULL이면 일반 대화) */
    const char    *user_text;     /* 사용자 입력 */
    int            baseline;      /* 1이면 비교용 모드: 페르소나 JSON 없이 캐릭터 이름만
                                     넣은 "단순 프롬프트 방식" (제안서의 OOC 비교 검증용) */
} ChatRequest;

/* 내부에서 하는 일:
 *   1. persona_load() + persona_build_prompt() 로 캐릭터 설명문을 받는다
 *   2. memory_load() 로 이전 대화를 불러와 최근 부분만 고른다
 *   3. 고정 안전 지시문 + 캐릭터 설명문 + 목적 지시문 + 대화 기록 + 입력으로 요청 구성
 *   4. 목적의 tier로 모델을 골라 작업 스레드(pthread)에서 libcurl로 요청
 *   5. 답변 조각을 on_chunk로 넘기고, 끝나면 memory_append()로 입력·답변 저장
 *
 * on_chunk : NULL 가능 (스트리밍 표시가 필요 없을 때)
 * reply    : [출력] 답변 전체. free()로 해제 */
int api_chat(const ChatRequest *req, ApiChunkFn on_chunk, void *user, char **reply);

/* ---------- 페르소나 엔진용: 범용 LLM 호출 ----------
 * system_prompt : 시스템 지시문 (NULL 가능)
 * user_prompt   : 요청 내용
 * tier          : 사용할 모델 등급 (인격 추론은 TIER_HEAVY)
 * reply         : [출력] 응답 텍스트. free()로 해제 */
int api_complete(const char *system_prompt, const char *user_prompt,
                 ModelTier tier, char **reply);

/* ---------- 페르소나 엔진용: 웹 검색 ---------- */
typedef struct {
    char *title;
    char *url;
    char *snippet;      /* 본문 발췌 */
} SearchResult;

typedef struct {
    SearchResult *items;
    size_t        count;
} SearchResults;

/* out : [출력] search_results_free()로 해제 */
int  api_search(const char *query, size_t max_results, SearchResults *out);
void search_results_free(SearchResults *results);

#endif /* OST3_API_H */
