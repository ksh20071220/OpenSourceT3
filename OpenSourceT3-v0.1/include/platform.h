/*
 * platform.h — 운영체제 차이를 숨기는 함수 모음
 * [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
 *
 * Windows와 Linux에서 다르게 동작하는 일(한글 콘솔 입출력, 한글 경로 파일 열기,
 * 폴더 만들기·목록, 잠깐 쉬기)은 모두 여기 함수로 한다.
 * 각 모듈(.c)에서는 <windows.h>, <unistd.h>, <dirent.h> 를 직접 쓰지 않는다.
 *
 * 경로 구분자는 Windows에서도 '/' 를 쓴다 (예: "data/personas/yunseo.json").
 */
#ifndef OST3_PLATFORM_H
#define OST3_PLATFORM_H

#include <stddef.h>
#include <stdio.h>

/* 프로그램 시작 시 한 번 호출 (Windows 콘솔을 UTF-8로 설정) */
void platform_init(void);

/* 콘솔에서 한 줄 입력받기 (UTF-8, 끝의 줄바꿈 제거)
 * out : [출력] free()로 해제
 * 입력이 끝나면(EOF) ERR_NOT_FOUND */
int platform_read_line(char **out);

/* UTF-8 경로로 파일 열기 (fopen 대신 사용) */
FILE *platform_fopen(const char *path, const char *mode);

/* 파일 전체 읽기. out: [출력] free()로 해제, NUL로 끝남. len은 NULL 가능 */
int platform_read_file(const char *path, char **out, size_t *len);

/* 파일 전체 쓰기 (있으면 덮어씀). 필요한 상위 폴더는 자동으로 만든다 */
int platform_write_file(const char *path, const char *data, size_t len);

/* 파일 끝에 덧붙이기. 필요한 상위 폴더는 자동으로 만든다 */
int platform_append_file(const char *path, const char *data, size_t len);

int platform_file_exists(const char *path);   /* 있으면 1, 없으면 0 */
int platform_remove_file(const char *path);

/* 폴더 만들기 (중간 폴더까지 모두, 이미 있으면 성공) */
int platform_mkdir_p(const char *path);

/* 폴더 안 파일 이름 목록 (하위 폴더·숨김 파일 제외)
 * suffix : 이 문자열로 끝나는 이름만 (예: ".json"), NULL이면 전부
 * names  : [출력] platform_free_list()로 해제 */
int  platform_list_dir(const char *dir, const char *suffix, char ***names, size_t *count);
void platform_free_list(char **names, size_t count);

/* 경로 이어 붙이기: a + "/" + b → out (out_size 바이트 버퍼) */
int platform_join_path(char *out, size_t out_size, const char *a, const char *b);

/* 밀리초 단위로 쉬기 */
void platform_sleep_ms(unsigned int ms);

/* 문자열 복사본 만들기 (strdup 대용, 표준 C에 없으므로). NULL이면 NULL */
char *ost3_strdup(const char *s);

#endif /* OST3_PLATFORM_H */
