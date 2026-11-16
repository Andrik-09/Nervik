#include "deteccion.h"

static const float CAIDA_CN0_DB = 10.0f;
static const float CAIDA_RSSI_DB = 15.0f;
static const int SEG_SENAL_GNSS = 3;        // F-01: detección ≤ 5 s
static const int SEG_PERDIDA_ABRUPTA = 120; // túnel típico < 2 min
static const int SEG_DETENIDO = 60;
static const int SEG_RECUPERACION = 20;

static float baseCn0 = 0, baseRssi = 0;
static int nivelActual = 0, nivelMax = 0;
static int segDegradado = 0, segSinGnss = 0, segDetenido = 0, segRecuperado = 0;
static bool abierto = false, terminado = false;
static bool marcoRed = false, marcoParada = false;
static float cn0Anterior = 0;
static int satsAnteriores = 0;

static Hito linea[16];
static int nHitos = 0;
static char inicio[25] = "";
static double latIni = 0, lonIni = 0;
static float velIni = 0;

static void hito(const char *iso, const char *tipo, const char *detalle, double lat, double lon, float vel, bool conPos) {
  if (nHitos >= 16) return;
  Hito &h = linea[nHitos++];
  strncpy(h.ts, iso, sizeof(h.ts) - 1); h.ts[sizeof(h.ts) - 1] = 0;
  strncpy(h.tipo, tipo, sizeof(h.tipo) - 1); h.tipo[sizeof(h.tipo) - 1] = 0;
  strncpy(h.detalle, detalle, sizeof(h.detalle) - 1); h.detalle[sizeof(h.detalle) - 1] = 0;
  h.lat = lat; h.lon = lon; h.vel = vel; h.con_pos = conPos;
}

void deteccion::actualizar(const Entradas &e, const char *iso, double lat, double lon, float vel) {
  // --- líneas base: solo se aprenden en estado normal con buena señal ---
  if (nivelActual == 0 && e.fix && e.cn0 > 25) baseCn0 = baseCn0 == 0 ? e.cn0 : baseCn0 + (e.cn0 - baseCn0) / 60.0f;
  if (nivelActual == 0 && e.red && e.rssi < 0) baseRssi = baseRssi == 0 ? e.rssi : baseRssi + (e.rssi - baseRssi) / 60.0f;

  // --- señal 1: GNSS ---
  bool degradado = baseCn0 > 0 && e.sats_con_senal >= 3 && e.cn0 <= baseCn0 - CAIDA_CN0_DB;
  bool sinGnss = e.gnss_conectado && e.sats_con_senal == 0;
  bool abrupta = sinGnss && satsAnteriores >= 4 && cn0Anterior > baseCn0 - 3; // de bien a nada en 1 s: túnel/puente
  segDegradado = degradado ? segDegradado + 1 : 0;
  if (sinGnss) segSinGnss = (abrupta || segSinGnss > 0) ? segSinGnss + 1 : 0; else segSinGnss = 0;
  // si veníamos degradados y se pierde todo, sigue siendo la misma señal
  bool senalGnss = segDegradado >= SEG_SENAL_GNSS || (abierto && sinGnss) || segSinGnss >= SEG_PERDIDA_ABRUPTA;

  // --- señal 2: red ---
  bool senalRed = !e.red || (baseRssi < 0 && e.rssi < 0 && e.rssi <= baseRssi - CAIDA_RSSI_DB);

  // --- señal 3: vehículo detenido con motor encendido ---
  segDetenido = (e.detenido == 1 && e.motor) ? segDetenido + 1 : 0;
  bool senalParada = segDetenido >= SEG_DETENIDO;

  int nuevo = 0;
  if (senalGnss) nuevo = 1;
  if (senalGnss && senalRed) nuevo = 2;
  if (senalGnss && senalRed && senalParada) nuevo = 3;

  char txt[120];
  if (!abierto && nuevo >= 1) {
    abierto = true; terminado = false; nHitos = 0; nivelMax = 0;
    marcoRed = marcoParada = false;
    strncpy(inicio, iso, sizeof(inicio) - 1);
    latIni = lat; lonIni = lon; velIni = vel;
    if (segSinGnss >= SEG_PERDIDA_ABRUPTA)
      snprintf(txt, sizeof(txt), "Sin GNSS por más de %d s con la unidad en marcha (no es un túnel corto)", SEG_PERDIDA_ABRUPTA);
    else
      snprintf(txt, sizeof(txt), "C/N0 promedio cae de %.0f a %.0f dB-Hz en %d satélites a la vez a %.0f km/h", baseCn0, e.cn0, e.sats_con_senal, vel);
    hito(iso, "gnss_degradado", txt, lat, lon, vel, true);
  }
  if (abierto) {
    if (nuevo >= 2 && !marcoRed) { marcoRed = true; hito(iso, "red_perdida", "Se pierde la red celular. Alerta en cabina encendida.", lat, lon, vel, true); }
    if (nuevo >= 3 && !marcoParada) {
      marcoParada = true;
      hito(iso, "parada_no_programada", "Velocidad 0 km/h con motor encendido fuera de punto autorizado.", lat, lon, 0, true);
      hito(iso, "nivel_3", "Evento confirmado (N3): interferencia + pérdida de red + parada no programada.", 0, 0, 0, false);
    }
    if (nuevo > nivelMax) nivelMax = nuevo;
    // cierre: GNSS y red de vuelta durante 20 s
    bool sano = e.fix && e.sats_con_senal >= 4 && e.cn0 >= baseCn0 - 4 && e.red;
    segRecuperado = sano ? segRecuperado + 1 : 0;
    if (segRecuperado >= SEG_RECUPERACION) {
      hito(iso, "fin_interferencia", "Regresan GNSS y red. Expediente enviado a la central.", 0, 0, 0, false);
      abierto = false; terminado = true; nuevo = 0; segRecuperado = 0;
    } else if (nuevo < nivelActual) {
      nuevo = nivelActual; // durante el evento el nivel no baja hasta que se confirma la recuperación
    }
  }
  nivelActual = nuevo;
  cn0Anterior = e.cn0;
  satsAnteriores = e.sats_con_senal;
}

int deteccion::nivel() { return nivelActual; }
bool deteccion::eventoAbierto() { return abierto; }
bool deteccion::eventoTerminado() { bool t = terminado; terminado = false; return t; }
int deteccion::hitos(const Hito **l) { *l = linea; return nHitos; }
int deteccion::nivelMaximo() { return nivelMax; }
const char *deteccion::inicioIso() { return inicio; }
double deteccion::lat0() { return latIni; }
double deteccion::lon0() { return lonIni; }
float deteccion::vel0() { return velIni; }
float deteccion::lineaBaseCn0() { return baseCn0; }
void deteccion::reiniciar() { abierto = false; terminado = false; nivelActual = 0; nHitos = 0; segDegradado = segSinGnss = segDetenido = segRecuperado = 0; }
