/*
 * common.h — 모든 모듈이 함께 쓰는 타입과 규칙
 * [공통 파일] 수정은 PR + 팀원 3명 확인 후에만 (CONTRIBUTING.md 참고)
 *
 * [반환값 규칙]
 *   모든 공개 함수는 ErrCode(int)를 반환한다. 0(ERR_OK)이면 성공.
 *   실제 결과는 마지막 인자(출력 포인터)로 돌려준다.
 *
 * [메모리 규칙]
 *   결과를 "돌려주는" 함수가 할당하고, 받은 쪽이 해제한다.
 *     - char ** 로 받은 문자열 → free()
 *     - 구조체 → 그 모듈의 *_free() 함수
 *   const char * 로 "받는" 인자는 함수가 소유하지 않는다 (필요하면 복사).
 *
 * [문자열 규칙]
 *   모든 문자열은 UTF-8. 파일 경로도 UTF-8로 다루고,
 *   파일 열기·폴더 만들기는 반드시 platform.h 함수를 쓴다 (Windows 한글 경로 대응).
 */
#ifndef OST3_COMMON_H
#define OST3_COMMON_H

#include <stddef.h>

#define OST3_VERSION "0.1.0"

/* ---------- 오류 코드 ---------- */
typedef enum {
    ERR_OK = 0,
    ERR_INVALID_ARG,   /* NULL 포인터, 빈 문자열 등 잘못된 인자 */
    ERR_NO_MEMORY,     /* 메모리 할당 실패 */
    ERR_NOT_FOUND,     /* 캐릭터·파일·항목 없음 */
    ERR_IO,            /* 파일 읽기/쓰기 실패 */
    ERR_NETWORK,       /* 연결 실패, 타임아웃 */
    ERR_API,           /* LLM/검색 API 오류 응답 (키 오류, 요금 한도, 거절 등) */
    ERR_PARSE,         /* JSON 파싱 실패, 형식 불일치 */
    ERR_CANCELLED,     /* 사용자가 취소 */
    ERR_NOT_IMPLEMENTED,/* 아직 구현 안 됨 (깡통 함수용) */
    ERR_UNKNOWN
} ErrCode;

/* 오류 코드를 한국어 설명으로 (화면 출력용). 반환 문자열은 해제하지 않는다. */
const char *err_to_string(int code);

/* ---------- 길이 제한 ---------- */
#define OST3_ID_MAX     64    /* 캐릭터 ID = 페르소나 파일 이름(확장자 제외) */
#define OST3_NAME_MAX   128   /* 캐릭터 이름, 작품명, 목적 이름 */
#define OST3_KEY_MAX    256   /* API 키 */
#define OST3_MODEL_MAX  128   /* 모델 이름 */
#define OST3_URL_MAX    512   /* URL */
#define OST3_PATH_MAX   1024  /* 파일 경로 (UTF-8 바이트 기준) */

/* ---------- 대화 메시지 ---------- */
typedef enum {
    ROLE_SYSTEM = 0,
    ROLE_USER,
    ROLE_ASSISTANT
} Role;

/* "system" / "user" / "assistant" (API 요청·저장 파일에 그대로 쓰는 이름) */
const char *role_to_string(Role role);

typedef struct {
    Role  role;
    char *content;        /* 힙 할당 UTF-8 문자열 */
} Message;

/* 대화 기록 (동적 배열). 다루는 함수는 memory.h */
typedef struct {
    Message *items;
    size_t   count;
    size_t   capacity;
} Conversation;

/* ---------- 모델 등급 (제안서: 일상 대화는 저비용, 복잡한 추론은 고성능) ---------- */
typedef enum {
    TIER_LIGHT = 0,       /* 일상 대화용 저비용 모델 */
    TIER_HEAVY            /* 인격 추론·실무 작업용 고성능 모델 */
} ModelTier;

/* ---------- 프로그램 설정 (config.h에서 읽고 씀) ---------- */
typedef struct {
    char provider[32];             /* assets/providers.json 의 id ("openai", "gemini", "claude") */
    char base_url[OST3_URL_MAX];   /* OpenAI 호환 API 주소 (회사별) */
    char api_key[OST3_KEY_MAX];    /* 사용자 LLM API 키 (BYOK) */
    char search_key[OST3_KEY_MAX]; /* 검색 API 키 (없으면 빈 문자열) */
    char model_light[OST3_MODEL_MAX]; /* TIER_LIGHT 모델 이름 */
    char model_heavy[OST3_MODEL_MAX]; /* TIER_HEAVY 모델 이름 */
    double temperature;            /* 0 미만이면 API 기본값 사용 (모델별 파라미터 설정) */
    char data_dir[OST3_PATH_MAX];  /* 사용자 데이터 폴더 (기본 "data") */
    char assets_dir[OST3_PATH_MAX];/* 프로그램 자료 폴더 (기본 "assets") */
} AppConfig;

#endif /* OST3_COMMON_H */
