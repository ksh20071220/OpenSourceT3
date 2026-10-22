/*
 * ui.h — 채팅 인터페이스 (콘솔)
 * [공통 파일: 규격] 이 헤더의 수정은 PR + 팀원 3명 확인 후에만
 * [구현 담당: 곽수호]  src/ui.c
 *
 * 화면 흐름:
 *   첫 실행 설정(API 회사 선택 + 키 발급 안내 + 키·모델 입력)
 *   → 캐릭터 선택 / 새 캐릭터 만들기
 *   → 사용 목적 선택 (학습·실무·상담·대화… + 기타 직접 입력)
 *   → 대화
 */
#ifndef OST3_UI_H
#define OST3_UI_H

#include "common.h"

/* 프로그램 메인 루프. 사용자가 종료하면 반환.
 * cfg : 설정 화면에서 바뀌면 내용이 갱신되고 저장된다 */
int ui_run(AppConfig *cfg);

/* 첫 실행(설정 파일 없음 또는 API 키 없음)에서 설정 입력받기 */
int ui_setup_config(AppConfig *cfg);

/* 오류 메시지 출력 (공통 형식) */
void ui_show_error(int code, const char *context);

#endif /* OST3_UI_H */
