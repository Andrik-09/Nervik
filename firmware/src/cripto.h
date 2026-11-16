// Identidad criptográfica del equipo: llave ECDSA P-256, SHA-256 y base64.
// Mismo esquema que docs/protocolo.md: se firma el SHA-256 de los bytes del payload,
// la firma va como r||s (64 bytes) en base64.
#pragma once
#include <Arduino.h>

namespace cripto {
  bool iniciar();                                   // carga o genera la llave (LittleFS)
  void sha256(const uint8_t *datos, size_t n, uint8_t salida[32]);
  String hex(const uint8_t *b, size_t n);
  String base64(const uint8_t *b, size_t n);
  bool firmar(const uint8_t hash[32], uint8_t firma[64]);
  String llavePublicaPem();
  String codigoAlta();                              // NVK1:<serie>:<base64 X||Y>
  void imprimirQR(Print &out, const String &texto);
  bool regenerar();                                 // borra y crea una llave nueva
}
