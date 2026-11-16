#pragma once
#include <stdint.h>
#include <stddef.h>
#ifdef __cplusplus
extern "C" {
#endif
void sha256(const uint8_t *datos, size_t n, uint8_t salida[32]);
#ifdef __cplusplus
}
#endif
