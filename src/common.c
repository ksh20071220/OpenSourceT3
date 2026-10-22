/*
 * common.c — common.h 의 공통 함수 구현
 * [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
 */
#include "common.h"

const char *err_to_string(int code)
{
    switch (code) {
    case ERR_OK:              return "성공";
    case ERR_INVALID_ARG:     return "잘못된 입력입니다";
    case ERR_NO_MEMORY:       return "메모리가 부족합니다";
    case ERR_NOT_FOUND:       return "찾을 수 없습니다";
    case ERR_IO:              return "파일을 읽거나 쓰지 못했습니다";
    case ERR_NETWORK:         return "네트워크 연결에 실패했습니다";
    case ERR_API:             return "API가 오류를 돌려주었습니다 (API 키, 요금 한도, 모델 이름을 확인하세요)";
    case ERR_PARSE:           return "데이터 형식이 올바르지 않습니다";
    case ERR_CANCELLED:       return "취소되었습니다";
    case ERR_NOT_IMPLEMENTED: return "아직 구현되지 않은 기능입니다";
    default:                  return "알 수 없는 오류";
    }
}

const char *role_to_string(Role role)
{
    switch (role) {
    case ROLE_SYSTEM:    return "system";
    case ROLE_USER:      return "user";
    case ROLE_ASSISTANT: return "assistant";
    }
    return "user";
}
