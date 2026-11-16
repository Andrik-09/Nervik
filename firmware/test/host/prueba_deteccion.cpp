// Pruebas de la máquina de estados con señales sintéticas (sin inhibidor real).
#include "../../src/deteccion.h"
#include <cstdio>
#include <cstdlib>

static int fallas = 0;
static void revisa(bool c, const char *msg) { printf("%s %s\n", c ? "OK " : "MAL", msg); if (!c) fallas++; }

static Entradas sano() { return Entradas{true, true, 10, 42, true, -75, 0, true}; }

// Corre n segundos con un generador de entradas y devuelve el nivel máximo visto
template <class F> int correr(int n, F f, int *segPrimerN1 = nullptr, bool *cerro = nullptr) {
  int max = 0;
  for (int s = 0; s < n; s++) {
    Entradas e = f(s);
    char ts[25]; snprintf(ts, sizeof ts, "2026-11-16T10:%02d:%02dZ", (s / 60) % 60, s % 60);
    deteccion::actualizar(e, ts, 19.04, -98.2, e.detenido == 1 ? 0 : 80);
    int nv = deteccion::nivel();
    if (nv >= 1 && segPrimerN1 && *segPrimerN1 < 0) *segPrimerN1 = s;
    if (nv > max) max = nv;
    if (deteccion::eventoTerminado() && cerro) *cerro = true;
  }
  return max;
}

int main() {
  // 1) Calentamiento: 5 min de manejo normal para aprender la línea base
  correr(300, [](int) { return sano(); });
  revisa(deteccion::nivel() == 0, "manejo normal: N0");
  revisa(deteccion::lineaBaseCn0() > 40, "línea base de C/N0 aprendida (~42 dB-Hz)");

  // 2) Túnel: los satélites desaparecen de golpe 40 s y regresan; la red sigue
  int mx = correr(40, [](int) { Entradas e = sano(); e.fix = false; e.sats_con_senal = 0; e.cn0 = 0; return e; });
  correr(30, [](int) { return sano(); });
  revisa(mx == 0, "túnel de 40 s: no hay falsa alarma");

  // 3) Ataque: C/N0 baja 1.1 dB/s en todos los satélites, la red cae a los 16 s, se detiene a los 25 s
  int primerN1 = -1; bool cerro = false;
  mx = correr(150, [](int s) {
    Entradas e = sano();
    if (s < 100) {
      e.cn0 = 42 - 1.1f * s; if (e.cn0 < 8) e.cn0 = 8;
      e.sats_con_senal = s < 22 ? 8 : 0; e.fix = s < 22;
      e.red = s < 16;
      if (s >= 25) e.detenido = 1;
    }
    return e;
  }, &primerN1, &cerro);
  printf("    primer N1 a los %d s (caída de 10 dB a los ~9 s)\n", primerN1);
  revisa(primerN1 >= 0 && primerN1 - 9 <= 5, "detección ≤ 5 s después de cruzar el umbral (F-01)");
  revisa(mx == 3, "llega a N3 con las tres señales (F-03)");
  revisa(cerro, "el evento cierra al recuperar GNSS y red y se genera el expediente");
  const Hito *h; int n = deteccion::hitos(&h);
  for (int i = 0; i < n; i++) printf("    %s %-22s %s\n", h[i].ts, h[i].tipo, h[i].detalle);
  revisa(n == 5, "línea de tiempo con 5 hitos");

  // 4) Pérdida de red sola (zona sin cobertura): no es ataque
  mx = correr(120, [](int) { Entradas e = sano(); e.red = false; e.rssi = 0; return e; });
  revisa(mx == 0, "zona sin cobertura celular con GNSS sano: sin alarma");

  // 5) Sin cielo prolongado y en marcha (> 2 min): se reporta como anomalía N1
  mx = correr(130, [](int) { Entradas e = sano(); e.fix = false; e.sats_con_senal = 0; e.cn0 = 0; return e; });
  revisa(mx == 1, "pérdida abrupta > 2 min en marcha: N1 (anomalía)");
  return fallas ? 1 : 0;
}
