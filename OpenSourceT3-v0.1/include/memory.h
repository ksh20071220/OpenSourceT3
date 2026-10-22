/*
 * memory.h — 대화 기록 및 기억 관리
 * [공통 파일: 규격] 이 헤더의 수정은 PR + 팀원 3명 확인 후에만
 * [구현 담당: 똥]   src/memory.c
 *
 * 캐릭터별 대화 기록을 로컬(<data_dir>/history/<character_id>.*)에 저장한다.
 * 제안서 그림 2의 "대화 기록: 메시지 히스토리, 요약/장기 기억"에 해당.
 */
#ifndef OST3_MEMORY_H
#define OST3_MEMORY_H

#include "common.h"

/* memory_* 함수가 쓸 설정 지정 (api_init 이후 main에서 호출). cfg는 계속 유효해야 함 */
void memory_set_config(const AppConfig *cfg);

/* ---------- Conversation 다루기 ---------- */
void conversation_init(Conversation *conv);
void conversation_free(Conversation *conv);
int  conversation_push(Conversation *conv, Role role, const char *content); /* content 복사 */

/* ---------- 저장소 ---------- */

/* 저장된 대화 불러오기. 기록이 없으면 빈 대화로 ERR_OK.
 * out : [출력] conversation_free()로 해제 */
int memory_load(const char *character_id, Conversation *out);

/* 메시지 하나를 저장소 끝에 덧붙이기 */
int memory_append(const char *character_id, Role role, const char *content);

/* 해당 캐릭터의 대화 기록 삭제 (UI "대화 초기화") */
int memory_clear(const char *character_id);

/* LLM에 보낼 최근 대화만 복사 (토큰 절약)
 * out : [출력] conversation_free()로 해제 */
int memory_recent(const Conversation *conv, size_t max_messages, Conversation *out);

/* 장기 기억: 오래된 대화의 요약문 (없으면 빈 문자열). out: free()로 해제 */
int memory_get_summary(const char *character_id, char **out);
int memory_set_summary(const char *character_id, const char *summary);

#endif /* OST3_MEMORY_H */
