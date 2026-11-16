// Firma un payload igual que el firmware y lo imprime como sobre JSON para verificarlo con la API.
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <string>
#include "../../src/sha256.h"
#include "uECC.h"

static int rng(uint8_t *d, unsigned n) { FILE *f = fopen("/dev/urandom", "rb"); fread(d, 1, n, f); fclose(f); return 1; }
static std::string b64(const uint8_t *b, size_t n) {
  static const char *t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string s;
  for (size_t i = 0; i < n; i += 3) {
    uint32_t v = (uint32_t)b[i] << 16 | (i + 1 < n ? (uint32_t)b[i+1] << 8 : 0) | (i + 2 < n ? b[i+2] : 0);
    s += t[(v >> 18) & 63]; s += t[(v >> 12) & 63]; s += i + 1 < n ? t[(v >> 6) & 63] : '='; s += i + 2 < n ? t[v & 63] : '=';
  }
  return s;
}
int main(int argc, char **argv) {
  uECC_set_rng(rng);
  uint8_t pub[64], priv[32], h[32], sig[64];
  uECC_make_key(pub, priv, uECC_secp256r1());
  // payload de 3 tamaños para ejercitar el relleno de SHA-256 (55, 56-64 y > 64 bytes)
  const char *payload = argc > 1 ? argv[1] : "{\"dispositivo\":\"NVK-P001\",\"tipo\":\"telemetria\",\"contador\":1,\"lat\":19.041200,\"lon\":-98.206300,\"vel\":0,\"nivel\":0,\"cn0\":41.5,\"sats\":9,\"motor\":1}";
  sha256((const uint8_t *)payload, strlen(payload), h);
  uECC_sign(priv, h, 32, sig, uECC_secp256r1());
  printf("{\"codigo\":\"NVK1:NVK-P001:%s\",\"sobre\":{\"dispositivo\":\"NVK-P001\",\"payload\":\"%s\",\"firma\":\"%s\"},\"sha\":\"",
         b64(pub, 64).c_str(), b64((const uint8_t *)payload, strlen(payload)).c_str(), b64(sig, 64).c_str());
  for (int i = 0; i < 32; i++) printf("%02x", h[i]);
  printf("\"}\n");
}
