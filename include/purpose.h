/*
 * purpose.h — 사용 목적 (학습·실무·상담·대화 등)
 * [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
 *
 * 목적 목록은 코드가 아니라 <assets_dir>/purposes.json 에 있다.
 * 목적을 추가·수정할 때는 코드 대신 이 JSON만 고치면 된다 (이것도 공통 파일이므로 PR).
 * 맨 마지막 "기타"는 사용자가 직접 목적을 입력한다 → purpose_make_custom()
 */
#ifndef OST3_PURPOSE_H
#define OST3_PURPOSE_H

#include "common.h"

typedef struct {
    char      id[OST3_ID_MAX];        /* 예: "study_physics" */
    char      name[OST3_NAME_MAX];    /* 예: "물리 공부" */
    char      category[OST3_NAME_MAX];/* 예: "학습", "실무", "상담", "대화" */
    char     *description;            /* 목록 화면 설명 (힙 할당) */
    char     *instruction;            /* LLM에 전달할 목적 지시문 (힙 할당) */
    ModelTier tier;                   /* 권장 모델 등급 (제안서의 모델 라우팅) */
    int       use_expertise;          /* 1이면 페르소나의 전문성(expertise)을 우선 참조 */
    int       crisis_notice;          /* 1이면 대화 화면에 위기 상담 안내 표시 */
} Purpose;

/* 상담 계열 목적에서 화면에 보여 줄 안내 문구 (해제하지 않음) */
const char *purpose_crisis_notice(void);

/* purposes.json 읽기. list: [출력] purpose_list_free()로 해제 */
int  purpose_list_load(const AppConfig *cfg, Purpose **list, size_t *count);
void purpose_list_free(Purpose *list, size_t count);

/* "기타" — 사용자가 입력한 목적 문장으로 Purpose 만들기
 * out : [출력] purpose_free()로 해제 */
int  purpose_make_custom(const char *user_text, Purpose *out);

/* 목록에서 하나를 복사 (목록을 해제한 뒤에도 쓰고 싶을 때). out: purpose_free()로 해제 */
int  purpose_copy(const Purpose *src, Purpose *out);
void purpose_free(Purpose *p);

#endif /* OST3_PURPOSE_H */
