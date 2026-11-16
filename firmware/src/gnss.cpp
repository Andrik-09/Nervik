#include "gnss.h"
#include "pines.h"

static EstadoGnss est;
static char linea[100];
static uint8_t pos = 0;

// Tabla de satélites vistos (constelación + PRN) con su último C/N0
struct Sat { char talker[3]; int prn; int snr; uint32_t ms; };
static Sat sats[48];

static void registrarSat(const char *talker, int prn, int snr) {
  int libre = -1, viejo = 0;
  for (int i = 0; i < 48; i++) {
    if (sats[i].prn == prn && strncmp(sats[i].talker, talker, 2) == 0) { sats[i].snr = snr; sats[i].ms = millis(); return; }
    if (sats[i].prn == 0 && libre < 0) libre = i;
    if (sats[i].ms < sats[viejo].ms) viejo = i;
  }
  int i = libre >= 0 ? libre : viejo;
  strncpy(sats[i].talker, talker, 2); sats[i].talker[2] = 0;
  sats[i].prn = prn; sats[i].snr = snr; sats[i].ms = millis();
}

static void recalcularCn0() {
  int mejores[4] = {0, 0, 0, 0};
  int con = 0;
  uint32_t ahora = millis();
  for (auto &s : sats) {
    if (!s.prn || ahora - s.ms > 3000 || s.snr <= 0) continue;
    con++;
    for (int k = 0; k < 4; k++) if (s.snr > mejores[k]) { for (int m = 3; m > k; m--) mejores[m] = mejores[m-1]; mejores[k] = s.snr; break; }
  }
  int n = con < 4 ? con : 4, suma = 0;
  for (int k = 0; k < n; k++) suma += mejores[k];
  est.sats_con_senal = con;
  est.cn0_prom = n ? (float)suma / n : 0;
}

// Divide la trama por comas sin perder campos vacíos
static int campos(char *s, char *out[], int max) {
  int n = 0; out[n++] = s;
  for (char *p = s; *p && n < max; p++) if (*p == ',' || *p == '*') { *p = 0; out[n++] = p + 1; }
  return n;
}

static double coord(const char *v, const char *hem) {
  if (!*v) return 0;
  double x = atof(v);
  int grados = (int)(x / 100);
  double r = grados + (x - grados * 100) / 60.0;
  return (*hem == 'S' || *hem == 'W') ? -r : r;
}

static bool checksumOk(const char *s) {
  const char *ast = strchr(s, '*');
  if (!ast || s[0] != '$') return false;
  uint8_t c = 0;
  for (const char *p = s + 1; p < ast; p++) c ^= *p;
  return c == strtol(ast + 1, nullptr, 16);
}

static void procesar(char *s) {
  if (!checksumOk(s)) return;
  est.ms_ultima_trama = millis();
  char talker[3] = {s[1], s[2], 0};
  const char *tipo = s + 3;
  char *f[24];
  int n = campos(s, f, 24);

  if (!strncmp(tipo, "GGA", 3) && n > 9) {
    est.fix = atoi(f[6]) > 0;
    est.sats_usados = atoi(f[7]);
    if (est.fix) { est.lat = coord(f[2], f[3]); est.lon = coord(f[4], f[5]); }
  } else if (!strncmp(tipo, "RMC", 3) && n > 9) {
    if (*f[2] == 'A') est.vel_kmh = atof(f[7]) * 1.852f;
    if (strlen(f[1]) >= 6 && strlen(f[9]) == 6) {
      // hhmmss.ss y ddmmyy → ISO 8601 UTC
      snprintf(est.iso, sizeof(est.iso), "20%.2s-%.2s-%.2sT%.2s:%.2s:%.2sZ", f[9] + 4, f[9] + 2, f[9], f[1], f[1] + 2, f[1] + 4);
      est.hora_valida = true;
    }
  } else if (!strncmp(tipo, "GSV", 3) && n > 4) {
    // 4 satélites por trama: PRN, elevación, azimut, SNR
    for (int i = 4; i + 3 < n; i += 4) {
      int prn = atoi(f[i]);
      if (prn) registrarSat(talker, prn, *f[i + 3] ? atoi(f[i + 3]) : 0);
    }
    recalcularCn0();
  }
}

void gnss::iniciar(uint32_t baudios) {
  Serial1.setTX(PIN_GNSS_TX);
  Serial1.setRX(PIN_GNSS_RX);
  Serial1.setFIFOSize(512);
  Serial1.begin(baudios);
}

void gnss::leer() {
  while (Serial1.available()) {
    char c = Serial1.read();
    if (c == '\n' || c == '\r') {
      if (pos > 6) { linea[pos] = 0; procesar(linea); }
      pos = 0;
    } else if (pos < sizeof(linea) - 1) {
      linea[pos++] = c;
    } else {
      pos = 0; // trama demasiado larga: se descarta
    }
  }
  static uint32_t ultimo = 0;
  if (millis() - ultimo > 1000) { ultimo = millis(); recalcularCn0(); }
}

const EstadoGnss &gnss::estado() { return est; }
bool gnss::hayDatos() { return est.ms_ultima_trama && millis() - est.ms_ultima_trama < 3000; }
