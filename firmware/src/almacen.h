// Estado persistente en la flash del RP2040 (LittleFS):
//  - contador anti-reenvío (siempre sube, también tras un reinicio)
//  - hash del último expediente (cadena)
//  - cola de mensajes firmados que no se pudieron enviar (se envían en orden al volver la red)
#pragma once
#include <Arduino.h>

namespace almacen {
  bool iniciar();
  uint32_t siguienteContador();
  String hashPrevio();
  void guardarHashPrevio(const String &hex);
  bool encolar(uint32_t contador, const String &sobre);
  bool primeroEnCola(uint32_t &contador, String &sobre);
  void quitarDeCola(uint32_t contador);
  int tamanoCola();
  void vaciarCola();
}
