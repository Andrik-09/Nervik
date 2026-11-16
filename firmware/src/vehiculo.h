// Lectura del vehículo SIN transmitir nada (requisito I-02 del PDS):
//  - bus J1939 por MCP2515 en modo listen-only: velocidad (PGN 65265) y rpm (PGN 61444)
//  - IMU LSM6DSOX: ¿la unidad está detenida?
//  - voltaje de alimentación y de la batería de respaldo
#pragma once
#include <Arduino.h>

namespace vehiculo {
  void iniciar();
  void leer();                // llamar seguido desde loop()
  bool hayBus();              // llegaron tramas J1939 en los últimos 3 s
  float velocidadBus();       // km/h, -1 si no hay dato
  bool motorEncendido();
  int detenido(float velGnss, bool fixGnss);   // 1 detenido, 0 en movimiento, -1 desconocido
  float alimentacion();       // V, NAN si no se mide
  float bateria();            // %, NAN si no se mide
  bool hayImu();
}
