// Máquina de estados de alerta del PDS: N0 Normal, N1 Observación/Anomalía, N2 Sospecha,
// N3 Evento confirmado. Ningún nivel actúa sobre el vehículo (requisito I-02).
//
// Regla v0 (heurística explicable; el modelo TinyML la sustituirá con datos de ruta):
//  Señal 1 — GNSS: el C/N0 promedio cae ≥ 10 dB bajo su línea base mientras el receptor
//            todavía ve ≥ 3 satélites (degradación por ruido). En un túnel los satélites
//            desaparecen de golpe; esa pérdida abrupta solo cuenta si dura más de 2 min.
//  Señal 2 — Red: se pierde el enlace o el RSSI cae ≥ 15 dB bajo su línea base.
//  Señal 3 — Vehículo: detenido ≥ 60 s con motor encendido (bus J1939 o IMU).
//  N1 = señal 1 sostenida 3 s · N2 = 1 + 2 · N3 = 1 + 2 + 3 (requisito F-03: ≥ 3 señales).
#pragma once
#include <Arduino.h>

struct Entradas {
  bool gnss_conectado;
  bool fix;
  int sats_con_senal;
  float cn0;          // dB-Hz
  bool red;           // hay enlace con el servidor
  float rssi;         // dBm (0 si no se conoce)
  int detenido;       // 1 detenido, 0 en movimiento, -1 desconocido
  bool motor;
};

struct Hito { char ts[25]; char tipo[24]; char detalle[120]; double lat, lon; float vel; bool con_pos; };

namespace deteccion {
  void actualizar(const Entradas &e, const char *iso, double lat, double lon, float vel);  // cada segundo
  int nivel();
  bool eventoAbierto();
  bool eventoTerminado();             // true una sola vez cuando cierra el evento
  int hitos(const Hito **lista);      // línea de tiempo del evento en curso
  int nivelMaximo();
  const char *inicioIso();
  double lat0(); double lon0(); float vel0();
  float lineaBaseCn0();
  void reiniciar();
}
