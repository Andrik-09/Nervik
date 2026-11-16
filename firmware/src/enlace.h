// Enlace con el servidor. Hay dos implementaciones con la misma interfaz:
//  - enlace_wifi.cpp     (Pico W: red del laboratorio o hotspot del celular)
//  - enlace_sim7080.cpp  (Pico + SIMCom SIM7080G, el módem del BOM DFM-B)
#pragma once
#include <Arduino.h>

namespace enlace {
  void iniciar();
  void mantener();                  // reconexión no bloqueante; llamar desde loop()
  bool conectado();
  float rssi();                     // dBm (0 si no se conoce)
  // POST a API_URL + ruta. Devuelve el código HTTP (o <= 0 si no hubo respuesta) y el cuerpo.
  int post(const char *ruta, const String &cuerpo, String &respuesta);
  void forzarDesconexion(bool si);  // para el simulacro: deja de transmitir como si hubiera jammer
  const char *nombre();
}
