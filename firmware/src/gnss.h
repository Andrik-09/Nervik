// Lectura del receptor GNSS por NMEA 0183 (GGA, RMC y GSV de todas las constelaciones).
// Lo importante para Nervik es la relación portadora/ruido (C/N0) de cada satélite:
// un inhibidor la hace caer en todos a la vez, aunque el receptor todavía los "vea".
#pragma once
#include <Arduino.h>

struct EstadoGnss {
  bool fix = false;
  double lat = 0, lon = 0;
  float vel_kmh = 0;
  int sats_usados = 0;     // satélites en la solución (GGA)
  int sats_con_senal = 0;  // satélites con C/N0 > 0 vistos en los últimos 3 s (GSV)
  float cn0_prom = 0;      // promedio de los 4 mejores C/N0, en dB-Hz
  bool hora_valida = false;
  char iso[25] = "";       // AAAA-MM-DDThh:mm:ssZ de la última RMC válida
  uint32_t ms_ultima_trama = 0;
};

namespace gnss {
  void iniciar(uint32_t baudios);
  void leer();                 // llamar seguido desde loop()
  const EstadoGnss &estado();
  bool hayDatos();             // recibió tramas en los últimos 3 s (receptor conectado)
}
