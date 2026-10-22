/*
 * config.h — 설정 파일, API 회사 목록
 * [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
 *
 * 설정 파일: <data_dir>/config.json  (API 키가 들어 있음 → git에 올리지 않음)
 * 회사 목록: <assets_dir>/providers.json  (키 발급 안내 포함)
 */
#ifndef OST3_CONFIG_H
#define OST3_CONFIG_H

#include "common.h"

/* 기본값 채우기 (data_dir="data", assets_dir="assets", temperature=-1) */
void config_defaults(AppConfig *cfg);

/* <cfg->data_dir>/config.json 읽기. 파일이 없으면 ERR_NOT_FOUND
 * (이때 UI가 첫 실행 설정 화면을 띄운다). cfg의 data_dir/assets_dir은 미리 채워 둘 것 */
int config_load(AppConfig *cfg);

/* <cfg->data_dir>/config.json 저장 */
int config_save(const AppConfig *cfg);

/* API 키가 입력돼 있으면 1 */
int config_has_api_key(const AppConfig *cfg);

/* ---------- API 회사 목록 (첫 실행 화면의 키 발급 안내용) ---------- */
typedef struct {
    char  id[32];                    /* "openai", "gemini", "claude" */
    char  name[OST3_NAME_MAX];       /* 화면에 보일 이름 */
    char  base_url[OST3_URL_MAX];    /* OpenAI 호환 API 주소 */
    char  key_url[OST3_URL_MAX];     /* 키 발급 페이지 */
    char  models_url[OST3_URL_MAX];  /* 모델 이름을 확인할 문서 */
    char *guide;                     /* 키 발급 순서 안내 (여러 줄, 힙 할당) */
    char *note;                      /* 주의 사항 (힙 할당, 빈 문자열 가능) */
} ProviderInfo;

/* providers.json 읽기. list: [출력] provider_list_free()로 해제 */
int  provider_list_load(const AppConfig *cfg, ProviderInfo **list, size_t *count);
void provider_list_free(ProviderInfo *list, size_t count);

/* 고른 회사의 id, base_url을 설정에 반영 */
void config_apply_provider(AppConfig *cfg, const ProviderInfo *p);

#endif /* OST3_CONFIG_H */
