/*
 * persona.h — 페르소나 생성 및 관리 (근거 평가·인격 추론)
 * [공통 파일: 규격] 이 헤더의 수정은 PR + 팀원 3명 확인 후에만
 * [구현 담당: 변]   src/persona.c
 *
 * 페르소나 = 캐릭터 설정집 JSON. 형식은 docs/persona-schema.md (변 관리).
 *   저장 위치: <data_dir>/personas/<id>.json
 *   샘플:      <assets_dir>/personas/<id>.json
 *   캐릭터 ID = 파일 이름(확장자 제외). 영문 소문자·숫자·_ 만 사용.
 *
 * 다른 모듈은 JSON을 직접 파싱하지 않고 아래 함수로만 접근한다.
 * (변이 JSON 구조를 바꿔도 다른 사람 코드가 깨지지 않게 하기 위함)
 */
#ifndef OST3_PERSONA_H
#define OST3_PERSONA_H

#include "common.h"
#include "purpose.h"

/* persona_* 함수가 쓸 설정 지정 (main에서 호출). cfg는 계속 유효해야 함 */
void persona_set_config(const AppConfig *cfg);

/* 목록 화면용 요약 */
typedef struct {
    char id[OST3_ID_MAX];
    char name[OST3_NAME_MAX];   /* character.name */
    char work[OST3_NAME_MAX];   /* character.source (작품명 또는 "자체 창작") */
} PersonaInfo;

typedef struct {
    PersonaInfo info;
    char       *json;           /* 원본 JSON 전체 (힙 할당) */
} Persona;

/* ---------- 불러오기 ---------- */

/* out : [출력] persona_free()로 해제 */
int  persona_load(const char *id, Persona *out);
void persona_free(Persona *p);

/* 저장된(사용자 + 샘플) 캐릭터 목록. list: [출력] free()로 해제 */
int persona_list(PersonaInfo **list, size_t *count);

/* ---------- 생성 ---------- */

/* 진행 상황 알림 (UI의 "검색 중...", "인격 추론 중..." 표시용)
 * step : 단계 설명, percent : 0~100 */
typedef void (*PersonaProgressFn)(const char *step, int percent, void *user);

typedef struct {
    const char *name;           /* 캐릭터 이름 (필수) */
    const char *work;           /* 작품명 (NULL 가능) */
    const char *keywords;       /* 추가 키워드·설정 (NULL 가능) — 제안서 그림 2 */
} PersonaCreateRequest;

/* 웹 검색 → 근거 평가 → 인격 추론 → JSON 생성 → 검증 → <data_dir>/personas/ 저장
 * 내부에서 api_search(), api_complete(TIER_HEAVY)를 사용한다.
 * on_progress : NULL 가능
 * out         : [출력] 생성된 페르소나. persona_free()로 해제 */
int persona_create(const PersonaCreateRequest *req,
                   PersonaProgressFn on_progress, void *user,
                   Persona *out);

/* 사용자 데이터에서 삭제 (샘플은 삭제하지 않음) */
int persona_delete(const char *id);

/* ---------- 대화용 ---------- */

/* 페르소나 JSON에서 이번 대화에 필요한 부분만 골라 "캐릭터 설명문"을 만든다.
 * (제안서: JSON 설정을 선택적으로 참조해 토큰 절약)
 * purpose   : NULL 가능. use_expertise면 전문성 항목을 우선 포함
 * user_text : 이번 사용자 입력 (관련 행동 규칙 선택에 사용, NULL 가능)
 * out       : [출력] free()로 해제 */
int persona_build_prompt(const Persona *p, const Purpose *purpose,
                         const char *user_text, char **out);

/* JSON이 docs/persona-schema.md 규격에 맞는지 검사. 맞으면 ERR_OK, 아니면 ERR_PARSE */
int persona_validate(const char *json);

#endif /* OST3_PERSONA_H */
