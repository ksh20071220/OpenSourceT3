/*
 * platform.c — 운영체제별 구현 (Windows / Linux·macOS)
 * [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
 *
 * Windows는 내부적으로 UTF-16(wchar_t) API를 써야 한글 경로·입력이 깨지지 않는다.
 * 그래서 Windows 쪽은 UTF-8 ↔ UTF-16 변환 후 _wfopen, _wmkdir, ReadConsoleW 등을 쓴다.
 */
#include "platform.h"
#include "common.h"

#include <errno.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
#  ifndef WIN32_LEAN_AND_MEAN
#    define WIN32_LEAN_AND_MEAN
#  endif
#  include <windows.h>
#  include <direct.h>
#  include <io.h>
#else
#  include <dirent.h>
#  include <sys/stat.h>
#  include <sys/types.h>
#  include <time.h>
#  include <unistd.h>
#endif

char *ost3_strdup(const char *s)
{
    if (!s) return NULL;
    size_t n = strlen(s) + 1;
    char *p = malloc(n);
    if (p) memcpy(p, s, n);
    return p;
}

/* ===================================================================== */
#ifdef _WIN32

/* UTF-8 → UTF-16. 반환값 free() 필요 */
static wchar_t *utf8_to_wide(const char *s)
{
    int n = MultiByteToWideChar(CP_UTF8, 0, s, -1, NULL, 0);
    if (n <= 0) return NULL;
    wchar_t *w = malloc((size_t)n * sizeof(wchar_t));
    if (!w) return NULL;
    MultiByteToWideChar(CP_UTF8, 0, s, -1, w, n);
    return w;
}

/* UTF-16 → UTF-8. 반환값 free() 필요 */
static char *wide_to_utf8(const wchar_t *w, int wlen)
{
    int n = WideCharToMultiByte(CP_UTF8, 0, w, wlen, NULL, 0, NULL, NULL);
    if (n < 0) return NULL;
    char *s = malloc((size_t)n + 1);
    if (!s) return NULL;
    WideCharToMultiByte(CP_UTF8, 0, w, wlen, s, n, NULL, NULL);
    s[n] = '\0';
    return s;
}

void platform_init(void)
{
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
    setvbuf(stdout, NULL, _IOFBF, 4096);
}

int platform_read_line(char **out)
{
    if (!out) return ERR_INVALID_ARG;
    *out = NULL;
    fflush(stdout);

    HANDLE h = GetStdHandle(STD_INPUT_HANDLE);
    DWORD mode;
    if (h != INVALID_HANDLE_VALUE && GetConsoleMode(h, &mode)) {
        /* 진짜 콘솔: UTF-16으로 읽어서 UTF-8로 변환 (한글 입력 대응) */
        size_t cap = 256, len = 0;
        wchar_t *buf = malloc(cap * sizeof(wchar_t));
        if (!buf) return ERR_NO_MEMORY;
        for (;;) {
            wchar_t ch;
            DWORD got = 0;
            if (!ReadConsoleW(h, &ch, 1, &got, NULL) || got == 0) {
                if (len == 0) { free(buf); return ERR_NOT_FOUND; }
                break;
            }
            if (ch == L'\r') continue;
            if (ch == L'\n') break;
            if (ch == 26 && len == 0) { free(buf); return ERR_NOT_FOUND; } /* Ctrl+Z */
            if (len + 1 >= cap) {
                cap *= 2;
                wchar_t *nb = realloc(buf, cap * sizeof(wchar_t));
                if (!nb) { free(buf); return ERR_NO_MEMORY; }
                buf = nb;
            }
            buf[len++] = ch;
        }
        *out = wide_to_utf8(buf, (int)len);
        free(buf);
        return *out ? ERR_OK : ERR_NO_MEMORY;
    }
    /* 파이프·파일 입력: 아래 공통 코드로 */
#else
void platform_init(void)
{
    /* Linux/macOS 터미널은 기본이 UTF-8 */
}

int platform_read_line(char **out)
{
    if (!out) return ERR_INVALID_ARG;
    *out = NULL;
    fflush(stdout);
#endif
    {
        size_t cap = 256, len = 0;
        char *buf = malloc(cap);
        if (!buf) return ERR_NO_MEMORY;
        int c;
        while ((c = fgetc(stdin)) != EOF && c != '\n') {
            if (len + 1 >= cap) {
                cap *= 2;
                char *nb = realloc(buf, cap);
                if (!nb) { free(buf); return ERR_NO_MEMORY; }
                buf = nb;
            }
            buf[len++] = (char)c;
        }
        if (c == EOF && len == 0) { free(buf); return ERR_NOT_FOUND; }
        if (len > 0 && buf[len - 1] == '\r') len--;
        buf[len] = '\0';
        *out = buf;
        return ERR_OK;
    }
}

/* ===================================================================== */

FILE *platform_fopen(const char *path, const char *mode)
{
    if (!path || !mode) return NULL;
#ifdef _WIN32
    wchar_t *wp = utf8_to_wide(path);
    wchar_t *wm = utf8_to_wide(mode);
    FILE *f = (wp && wm) ? _wfopen(wp, wm) : NULL;
    free(wp);
    free(wm);
    return f;
#else
    return fopen(path, mode);
#endif
}

int platform_file_exists(const char *path)
{
    if (!path) return 0;
#ifdef _WIN32
    wchar_t *wp = utf8_to_wide(path);
    if (!wp) return 0;
    DWORD a = GetFileAttributesW(wp);
    free(wp);
    return a != INVALID_FILE_ATTRIBUTES;
#else
    struct stat st;
    return stat(path, &st) == 0;
#endif
}

int platform_remove_file(const char *path)
{
    if (!path) return ERR_INVALID_ARG;
#ifdef _WIN32
    wchar_t *wp = utf8_to_wide(path);
    if (!wp) return ERR_NO_MEMORY;
    int r = _wremove(wp);
    free(wp);
#else
    int r = remove(path);
#endif
    if (r == 0) return ERR_OK;
    return errno == ENOENT ? ERR_NOT_FOUND : ERR_IO;
}

static int mkdir_one(const char *path)
{
#ifdef _WIN32
    wchar_t *wp = utf8_to_wide(path);
    if (!wp) return -1;
    int r = _wmkdir(wp);
    free(wp);
    return r;
#else
    return mkdir(path, 0755);
#endif
}

int platform_mkdir_p(const char *path)
{
    if (!path || !*path) return ERR_INVALID_ARG;
    char *tmp = ost3_strdup(path);
    if (!tmp) return ERR_NO_MEMORY;
    size_t n = strlen(tmp);
    while (n > 1 && (tmp[n - 1] == '/' || tmp[n - 1] == '\\')) tmp[--n] = '\0';

    for (char *p = tmp + 1; *p; p++) {
        if (*p == '/' || *p == '\\') {
            char saved = *p;
            *p = '\0';
            /* "C:" 같은 드라이브 이름은 건너뜀 */
            if (!(strlen(tmp) == 2 && tmp[1] == ':')) {
                if (mkdir_one(tmp) != 0 && errno != EEXIST) { free(tmp); return ERR_IO; }
            }
            *p = saved;
        }
    }
    int r = mkdir_one(tmp);
    int ok = (r == 0 || errno == EEXIST);
    free(tmp);
    return ok ? ERR_OK : ERR_IO;
}

/* path의 상위 폴더를 만든다 */
static int ensure_parent_dir(const char *path)
{
    const char *slash = NULL;
    for (const char *p = path; *p; p++)
        if (*p == '/' || *p == '\\') slash = p;
    if (!slash || slash == path) return ERR_OK;
    size_t n = (size_t)(slash - path);
    char *dir = malloc(n + 1);
    if (!dir) return ERR_NO_MEMORY;
    memcpy(dir, path, n);
    dir[n] = '\0';
    int r = platform_mkdir_p(dir);
    free(dir);
    return r;
}

int platform_read_file(const char *path, char **out, size_t *len)
{
    if (!path || !out) return ERR_INVALID_ARG;
    *out = NULL;
    if (len) *len = 0;
    FILE *f = platform_fopen(path, "rb");
    if (!f) return platform_file_exists(path) ? ERR_IO : ERR_NOT_FOUND;

    size_t cap = 4096, n = 0;
    char *buf = malloc(cap);
    if (!buf) { fclose(f); return ERR_NO_MEMORY; }
    for (;;) {
        if (n + 4096 + 1 > cap) {
            cap *= 2;
            char *nb = realloc(buf, cap);
            if (!nb) { free(buf); fclose(f); return ERR_NO_MEMORY; }
            buf = nb;
        }
        size_t got = fread(buf + n, 1, 4096, f);
        n += got;
        if (got < 4096) break;
    }
    int err = ferror(f);
    fclose(f);
    if (err) { free(buf); return ERR_IO; }
    buf[n] = '\0';
    /* UTF-8 BOM 제거 (Windows 메모장으로 저장한 파일 대응) */
    if (n >= 3 && (unsigned char)buf[0] == 0xEF && (unsigned char)buf[1] == 0xBB
               && (unsigned char)buf[2] == 0xBF) {
        memmove(buf, buf + 3, n - 3 + 1);
        n -= 3;
    }
    *out = buf;
    if (len) *len = n;
    return ERR_OK;
}

static int write_mode(const char *path, const char *data, size_t len, const char *mode)
{
    if (!path || (!data && len)) return ERR_INVALID_ARG;
    int r = ensure_parent_dir(path);
    if (r != ERR_OK) return r;
    FILE *f = platform_fopen(path, mode);
    if (!f) return ERR_IO;
    size_t w = len ? fwrite(data, 1, len, f) : 0;
    int bad = (w != len) | (fclose(f) != 0);
    return bad ? ERR_IO : ERR_OK;
}

int platform_write_file(const char *path, const char *data, size_t len)
{
    return write_mode(path, data, len, "wb");
}

int platform_append_file(const char *path, const char *data, size_t len)
{
    return write_mode(path, data, len, "ab");
}

static int ends_with(const char *s, const char *suffix)
{
    if (!suffix) return 1;
    size_t a = strlen(s), b = strlen(suffix);
    return a >= b && strcmp(s + a - b, suffix) == 0;
}

static int list_push(char ***names, size_t *count, size_t *cap, const char *name)
{
    if (*count == *cap) {
        size_t nc = *cap ? *cap * 2 : 8;
        char **nn = realloc(*names, nc * sizeof(char *));
        if (!nn) return ERR_NO_MEMORY;
        *names = nn;
        *cap = nc;
    }
    char *copy = ost3_strdup(name);
    if (!copy) return ERR_NO_MEMORY;
    (*names)[(*count)++] = copy;
    return ERR_OK;
}

static int cmp_str(const void *a, const void *b)
{
    return strcmp(*(char *const *)a, *(char *const *)b);
}

int platform_list_dir(const char *dir, const char *suffix, char ***names, size_t *count)
{
    if (!dir || !names || !count) return ERR_INVALID_ARG;
    *names = NULL;
    *count = 0;
    size_t cap = 0;
    int r = ERR_OK;

#ifdef _WIN32
    char pattern[OST3_PATH_MAX];
    if (platform_join_path(pattern, sizeof pattern, dir, "*") != ERR_OK) return ERR_INVALID_ARG;
    wchar_t *wpat = utf8_to_wide(pattern);
    if (!wpat) return ERR_NO_MEMORY;
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(wpat, &fd);
    free(wpat);
    if (h == INVALID_HANDLE_VALUE)
        return GetLastError() == ERROR_FILE_NOT_FOUND ? ERR_OK : ERR_NOT_FOUND;
    do {
        if (fd.dwFileAttributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_HIDDEN)) continue;
        char *name = wide_to_utf8(fd.cFileName, -1);
        if (!name) { r = ERR_NO_MEMORY; break; }
        if (name[0] != '.' && ends_with(name, suffix))
            r = list_push(names, count, &cap, name);
        free(name);
    } while (r == ERR_OK && FindNextFileW(h, &fd));
    FindClose(h);
#else
    DIR *d = opendir(dir);
    if (!d) return errno == ENOENT ? ERR_NOT_FOUND : ERR_IO;
    struct dirent *e;
    while (r == ERR_OK && (e = readdir(d)) != NULL) {
        if (e->d_name[0] == '.') continue;
        char full[OST3_PATH_MAX];
        if (platform_join_path(full, sizeof full, dir, e->d_name) != ERR_OK) continue;
        struct stat st;
        if (stat(full, &st) != 0 || !S_ISREG(st.st_mode)) continue;
        if (ends_with(e->d_name, suffix))
            r = list_push(names, count, &cap, e->d_name);
    }
    closedir(d);
#endif
    if (r != ERR_OK) {
        platform_free_list(*names, *count);
        *names = NULL;
        *count = 0;
        return r;
    }
    if (*count > 1) qsort(*names, *count, sizeof(char *), cmp_str);
    return ERR_OK;
}

void platform_free_list(char **names, size_t count)
{
    if (!names) return;
    for (size_t i = 0; i < count; i++) free(names[i]);
    free(names);
}

int platform_join_path(char *out, size_t out_size, const char *a, const char *b)
{
    if (!out || !a || !b || out_size == 0) return ERR_INVALID_ARG;
    size_t la = strlen(a);
    int need_sep = la > 0 && a[la - 1] != '/' && a[la - 1] != '\\';
    int n = snprintf(out, out_size, "%s%s%s", a, need_sep ? "/" : "", b);
    if (n < 0 || (size_t)n >= out_size) { out[0] = '\0'; return ERR_INVALID_ARG; }
    return ERR_OK;
}

void platform_sleep_ms(unsigned int ms)
{
#ifdef _WIN32
    Sleep(ms);
#else
    struct timespec ts;
    ts.tv_sec = ms / 1000;
    ts.tv_nsec = (long)(ms % 1000) * 1000000L;
    nanosleep(&ts, NULL);
#endif
}
