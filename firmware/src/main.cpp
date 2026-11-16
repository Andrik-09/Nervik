// Nervik — firmware del prototipo en protoboard (v0.1)
// Raspberry Pi Pico W / Pico + receptor GNSS + (opcional) MCP2515, LSM6DSOX y SIM7080G.
// Implementa docs/protocolo.md: telemetría y expedientes firmados con ECDSA P-256.
#include <Arduino.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include "config.h"
#include "pines.h"
#include "cripto.h"
#include "gnss.h"
#include "deteccion.h"
#include "almacen.h"
#include "enlace.h"
#include "vehiculo.h"
#include "interfaz.h"

#define VERSION_FIRMWARE "0.1.0"

// ---------------- reloj (UTC) ----------------
// Se sincroniza con la hora del GNSS o, si no hay cielo (banco de pruebas), con la del servidor.
static int64_t epochBase = 0;   // segundos UNIX en msBase
static uint32_t msBase = 0;

static int64_t diasDesdeCivil(int y, unsigned m, unsigned d) {  // algoritmo de H. Hinnant
  y -= m <= 2;
  const int era = (y >= 0 ? y : y - 399) / 400;
  const unsigned yoe = (unsigned)(y - era * 400);
  const unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return (int64_t)era * 146097 + (int64_t)doe - 719468;
}

static void sincronizarIso(const char *iso) {  // "AAAA-MM-DDThh:mm:ss…"
  int Y, M, D, h, m, s;
  if (!iso || sscanf(iso, "%4d-%2d-%2dT%2d:%2d:%2d", &Y, &M, &D, &h, &m, &s) != 6 || Y < 2024) return;
  epochBase = diasDesdeCivil(Y, M, D) * 86400 + h * 3600 + m * 60 + s;
  msBase = millis();
}

static bool horaValida() { return epochBase > 0; }

static String isoAhora() {
  if (!horaValida()) return String();
  int64_t t = epochBase + (millis() - msBase) / 1000;
  int64_t dias = t / 86400; int r = t % 86400;
  // civil desde días (inverso de Hinnant)
  int64_t z = dias + 719468; int64_t era = (z >= 0 ? z : z - 146096) / 146097;
  unsigned doe = (unsigned)(z - era * 146097);
  unsigned yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  int y = (int)(yoe + era * 400); unsigned doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  unsigned mp = (5 * doy + 2) / 153; unsigned d = doy - (153 * mp + 2) / 5 + 1; unsigned mes = mp < 10 ? mp + 3 : mp - 9;
  y += mes <= 2;
  char b[25];
  snprintf(b, sizeof(b), "%04d-%02u-%02uT%02d:%02d:%02dZ", y, mes, d, r / 3600, (r / 60) % 60, r % 60);
  return String(b);
}

// ---------------- simulacro (prueba sin inhibidor, que es ilegal) ----------------
// Recrea en software la huella de un ataque para demostrar la cadena completa:
// cae el C/N0 → baja la señal celular → se corta la transmisión → la unidad se detiene → se recupera.
static bool simulacro = false;
static uint32_t msSimulacro = 0;
static float cn0Simulacro0 = 40;

static void iniciarSimulacro() {
  simulacro = true; msSimulacro = millis();
  cn0Simulacro0 = deteccion::lineaBaseCn0() > 0 ? deteccion::lineaBaseCn0() : 40;
  Serial.println(F("[simulacro] INICIA: ~2 min. Los mensajes van marcados como simulacro."));
}
static void terminarSimulacro() {
  simulacro = false;
  enlace::forzarDesconexion(false);
  Serial.println(F("[simulacro] terminado"));
}

// ---------------- mensajes firmados ----------------
static double ultLat = 0, ultLon = 0;
static bool hayPosicion = false;
static uint32_t msUltimoEnvioOk = 0;
static String ultimoError;
static int32_t diagnosticoPendiente = -1;   // id del comando de diagnóstico que pidió la app (0 = botón)

// Firma el payload y lo envía; si no hay red o hay cola, lo guarda para enviarlo después en orden.
static void enviar(JsonDocument &doc, bool esEvento) {
  uint32_t c = almacen::siguienteContador();
  doc["dispositivo"] = DISPOSITIVO_ID;
  doc["contador"] = c;
  String ts = isoAhora();
  if (ts.length()) doc["ts"] = ts;
  if (simulacro) doc["simulacro"] = true;
  if (esEvento) doc["hash_prev"] = almacen::hashPrevio();

  String payload;
  serializeJson(doc, payload);
  uint8_t h[32], firma[64];
  cripto::sha256((const uint8_t *)payload.c_str(), payload.length(), h);
  if (!cripto::firmar(h, firma)) { Serial.println(F("[cripto] error al firmar")); return; }
  if (esEvento) almacen::guardarHashPrevio(cripto::hex(h, 32));  // la cadena avanza al firmar, no al enviar

  String sobre = String("{\"dispositivo\":\"") + DISPOSITIVO_ID + "\",\"payload\":\"" +
                 cripto::base64((const uint8_t *)payload.c_str(), payload.length()) + "\",\"firma\":\"" +
                 cripto::base64(firma, 64) + "\"}";
  almacen::encolar(c, sobre);  // siempre pasa por la cola: así nunca se envía fuera de orden
}

// Envía lo pendiente, del más antiguo al más reciente
static void vaciarCola() {
  for (int i = 0; i < 4 && enlace::conectado(); i++) {
    uint32_t c; String sobre;
    if (!almacen::primeroEnCola(c, sobre)) return;
    String resp;
    int codigo = enlace::post("/api/v1/dispositivo/mensajes", sobre, resp);
    if (codigo == 200 || codigo == 201 || codigo == 202 || codigo == 409) {
      almacen::quitarDeCola(c);           // 409 = ya había llegado
      msUltimoEnvioOk = millis();
      ultimoError = "";
      JsonDocument r;
      if (!deserializeJson(r, resp)) {
        if (r["hora"].is<const char *>() && !gnss::estado().hora_valida) sincronizarIso(r["hora"]);
        // Órdenes de la app: viajan en la respuesta. Solo actúan sobre el equipo, nunca sobre el vehículo.
        for (JsonObject cmd : r["comandos"].as<JsonArray>()) {
          const char *tipo = cmd["tipo"] | "";
          Serial.printf("[comando] %s (#%ld)\n", tipo, (long)(cmd["id"] | 0));
          if (!strcmp(tipo, "diagnostico")) diagnosticoPendiente = cmd["id"] | 0;
          else if (!strcmp(tipo, "simulacro") && !simulacro) iniciarSimulacro();
        }
      }
    } else if (codigo == 401 || codigo == 400) {
      almacen::quitarDeCola(c);           // rechazado por firma o formato: reintentar no sirve
      ultimoError = "rechazado " + String(codigo) + ": " + resp;
      Serial.println("[enlace] " + ultimoError);
    } else {
      ultimoError = codigo == 404 ? "equipo no dado de alta en la central" : "sin respuesta (" + String(codigo) + ")";
      return;                             // se reintenta después, conservando el orden
    }
  }
}

static Entradas entradasActuales() {
  const EstadoGnss &g = gnss::estado();
  Entradas e;
  e.gnss_conectado = gnss::hayDatos();
  e.fix = g.fix;
  e.sats_con_senal = g.sats_con_senal;
  e.cn0 = g.cn0_prom;
  e.red = enlace::conectado();
  e.rssi = enlace::rssi();
  e.detenido = vehiculo::detenido(g.vel_kmh, g.fix);
  e.motor = vehiculo::motorEncendido();

  if (simulacro) {
    float s = (millis() - msSimulacro) / 1000.0f;
    if (s < 100) {
      e.gnss_conectado = true;
      e.cn0 = max(8.0f, cn0Simulacro0 - 1.1f * s);          // degradación gradual en todos los satélites
      e.sats_con_senal = s < 22 ? max(6, g.sats_con_senal) : 0;
      e.fix = s < 22;
      if (s >= 14) e.rssi = (e.rssi < 0 ? e.rssi : -75) - 20; // el ruido también tapa la banda celular
      enlace::forzarDesconexion(s >= 18);                    // a partir de aquí no sale nada
      e.red = s < 18;
      if (s >= 25) { e.detenido = 1; e.motor = true; }
    } else {
      enlace::forzarDesconexion(false);                      // la unidad sale de la zona del inhibidor
      e.gnss_conectado = true; e.fix = true;
      e.sats_con_senal = max(8, g.sats_con_senal);
      e.cn0 = cn0Simulacro0;
      e.red = enlace::conectado();
      e.detenido = 0;
    }
    if (s > 100 && !deteccion::eventoAbierto()) terminarSimulacro();
  }
  return e;
}

static void enviarTelemetria(const Entradas &e) {
  const EstadoGnss &g = gnss::estado();
  JsonDocument doc;
  doc["tipo"] = "telemetria";
  if (hayPosicion) { doc["lat"] = serialized(String(ultLat, 6)); doc["lon"] = serialized(String(ultLon, 6)); }
  float vb = vehiculo::velocidadBus();
  doc["vel"] = (int)round(vb >= 0 ? vb : (e.fix ? g.vel_kmh : 0));
  doc["nivel"] = deteccion::nivel();
  doc["cn0"] = serialized(String(e.cn0, 1));
  doc["sats"] = e.sats_con_senal;
  if (e.rssi < 0) doc["rssi"] = (int)e.rssi;
  doc["motor"] = e.motor ? 1 : 0;
  float b = vehiculo::bateria(), v = vehiculo::alimentacion();
  if (!isnan(b)) doc["bateria"] = (int)b;
  if (!isnan(v)) doc["alimentacion"] = serialized(String(v, 1));
  doc["fix"] = e.fix;
  doc["bus"] = vehiculo::hayBus();
  doc["firmware"] = VERSION_FIRMWARE;
  enviar(doc, false);
}

static void enviarExpediente() {
  const Hito *h; int n = deteccion::hitos(&h);
  JsonDocument doc;
  doc["tipo"] = "evento";
  doc["inicio"] = deteccion::inicioIso();
  doc["fin"] = isoAhora();
  doc["nivel_max"] = deteccion::nivelMaximo();
  JsonObject pos = doc["ultima_pos"].to<JsonObject>();
  pos["lat"] = serialized(String(deteccion::lat0(), 6));
  pos["lon"] = serialized(String(deteccion::lon0(), 6));
  pos["vel"] = (int)round(deteccion::vel0());
  pos["ts"] = deteccion::inicioIso();
  JsonArray l = doc["linea_tiempo"].to<JsonArray>();
  for (int i = 0; i < n; i++) {
    JsonObject o = l.add<JsonObject>();
    o["ts"] = h[i].ts; o["tipo"] = h[i].tipo; o["detalle"] = h[i].detalle;
    if (h[i].con_pos) { o["lat"] = serialized(String(h[i].lat, 6)); o["lon"] = serialized(String(h[i].lon, 6)); o["vel"] = (int)round(h[i].vel); }
  }
  doc["firmware"] = VERSION_FIRMWARE;
  enviar(doc, true);
  Serial.printf("[evento] expediente firmado (N%d, %d hitos) en cola\n", deteccion::nivelMaximo(), n);
}

// ---------------- diagnóstico (pruebas desde la app o con el botón) ----------------
static void prueba(JsonArray a, const char *nombre, int ok, const String &valor, const char *detalle = "") {
  JsonObject p = a.add<JsonObject>();
  p["prueba"] = nombre;
  if (ok < 0) p["ok"] = nullptr; else p["ok"] = ok == 1;   // null = módulo no instalado
  p["valor"] = valor;
  if (*detalle) p["detalle"] = detalle;
}

static void ejecutarDiagnostico(int32_t comandoId) {
  Serial.println(F("[diagnostico] ejecutando…"));
  interfaz::destello();
  const EstadoGnss &g = gnss::estado();
  FSInfo fs; bool fsOk = LittleFS.info(fs);
  bool firmaOk = cripto::autoprueba();
  JsonDocument doc;
  doc["tipo"] = "diagnostico";
  if (comandoId > 0) doc["comando_id"] = comandoId;
  JsonArray a = doc["pruebas"].to<JsonArray>();
  prueba(a, "receptor_gnss", gnss::hayDatos(), gnss::hayDatos() ? "recibe tramas NMEA" : "sin tramas", "Revisar TX/RX y alimentación del módulo");
  prueba(a, "posicion_gnss", g.fix && g.sats_con_senal >= 4, String(g.sats_con_senal) + " sat, C/N0 " + String(g.cn0_prom, 1) + " dB-Hz", "La antena necesita ver el cielo");
  prueba(a, "red", enlace::conectado(), String(enlace::nombre()) + (enlace::conectado() ? " " + String((int)enlace::rssi()) + " dBm" : " sin conexión"));
#if USAR_CAN
  prueba(a, "bus_j1939", vehiculo::hayBus(), vehiculo::hayBus() ? "recibe tramas (solo escucha)" : "sin tramas", "Revisar CAN_H/CAN_L y el cable de 9 pines");
#else
  prueba(a, "bus_j1939", -1, "no instalado");
#endif
#if USAR_IMU
  prueba(a, "imu", vehiculo::hayImu(), vehiculo::hayImu() ? "LSM6DSOX responde" : "no responde");
#else
  prueba(a, "imu", -1, "no instalado");
#endif
  float v = vehiculo::alimentacion(), b = vehiculo::bateria();
  prueba(a, "alimentacion", isnan(v) ? -1 : v >= 11, isnan(v) ? String("no medido") : String(v, 1) + " V");
  prueba(a, "bateria", isnan(b) ? -1 : b >= 20, isnan(b) ? String("no medido") : String((int)b) + " %");
  prueba(a, "memoria", fsOk && almacen::tamanoCola() < 500, fsOk ? String((unsigned)(fs.usedBytes / 1024)) + " de " + String((unsigned)(fs.totalBytes / 1024)) + " kB, " + String(almacen::tamanoCola()) + " en cola" : "sin sistema de archivos");
  prueba(a, "firma", firmaOk, firmaOk ? "ECDSA P-256 correcta" : "falla al firmar");
  prueba(a, "reloj", horaValida(), horaValida() ? isoAhora() : "sin sincronizar");
  prueba(a, "luces_y_buzzer", 1, "destello realizado", "Confirmar a simple vista que encendieron los 3 LED y sonó el buzzer");
  prueba(a, "deteccion", 1, "nivel N" + String(deteccion::nivel()) + ", base C/N0 " + String(deteccion::lineaBaseCn0(), 1) + " dB-Hz");
  doc["ok"] = gnss::hayDatos() && enlace::conectado() && fsOk && firmaOk;
  doc["firmware"] = VERSION_FIRMWARE;
  enviar(doc, false);
}

// ---------------- monitor serie ----------------
static void imprimirAlta() {
  Serial.println(F("\n==================== ALTA EN LA APP ===================="));
  Serial.println(F("En la app: Instalar > paso 1 > escanea este QR o pega el código."));
  cripto::imprimirQR(Serial, cripto::codigoAlta());
  Serial.println(F("Código de alta:"));
  Serial.println(cripto::codigoAlta());
  Serial.println(F("Llave pública (PEM):"));
  Serial.println(cripto::llavePublicaPem());
  Serial.println(F("========================================================\n"));
}

static void imprimirEstado() {
  const EstadoGnss &g = gnss::estado();
  Serial.printf("[estado] %s · enlace %s %s · GNSS %s fix=%d sats=%d C/N0=%.1f (base %.1f) · nivel N%d · cola %d · hora %s%s%s\n",
    DISPOSITIVO_ID, enlace::nombre(), enlace::conectado() ? "conectado" : "SIN RED",
    gnss::hayDatos() ? "ok" : "SIN DATOS", g.fix, g.sats_con_senal, g.cn0_prom, deteccion::lineaBaseCn0(),
    deteccion::nivel(), almacen::tamanoCola(), horaValida() ? isoAhora().c_str() : "sin sincronizar",
    simulacro ? " · SIMULACRO" : "", ultimoError.length() ? (" · " + ultimoError).c_str() : "");
}

static void comandos() {
  static String cmd;
  while (Serial.available()) {
    char c = Serial.read();
    if (c != '\n' && c != '\r') { if (cmd.length() < 40) cmd += c; continue; }
    cmd.trim();
    if (cmd == "alta") imprimirAlta();
    else if (cmd == "estado") imprimirEstado();
    else if (cmd == "simulacro") simulacro ? terminarSimulacro() : iniciarSimulacro();
    else if (cmd == "diagnostico") diagnosticoPendiente = 0;
    else if (cmd == "vaciar-cola") { almacen::vaciarCola(); Serial.println(F("cola vacía")); }
    else if (cmd == "nueva-llave SI") { cripto::regenerar(); almacen::guardarHashPrevio(""); imprimirAlta(); Serial.println(F("Llave nueva: da de alta el equipo otra vez.")); }
    else if (cmd.length()) Serial.println(F("Comandos: alta · estado · diagnostico · simulacro · vaciar-cola · nueva-llave SI"));
    cmd = "";
  }
}

// ---------------- programa principal ----------------
void setup() {
  Serial.begin(115200);
  interfaz::iniciar();
  uint32_t t0 = millis();
  while (!Serial && millis() - t0 < 3000) delay(10);
  Serial.printf("\nNervik %s · firmware %s · enlace %s\n", DISPOSITIVO_ID, VERSION_FIRMWARE, enlace::nombre());

  if (!almacen::iniciar()) Serial.println(F("[almacen] ERROR: sin sistema de archivos"));
  if (!cripto::iniciar()) Serial.println(F("[cripto] ERROR: sin llave"));
  imprimirAlta();
  gnss::iniciar(GNSS_BAUD);
  vehiculo::iniciar();
  enlace::iniciar();
  interfaz::destello();
}

void loop() {
  gnss::leer();
  vehiculo::leer();
  enlace::mantener();
  comandos();

  switch (interfaz::boton()) {
    case interfaz::CORTO: imprimirEstado(); diagnosticoPendiente = 0; break;   // autoprueba local, el resultado también llega a la app
    case interfaz::LARGO: simulacro ? terminarSimulacro() : iniciarSimulacro(); break;
    default: break;
  }

  static uint32_t msSegundo = 0, msTelemetria = 0;
  static int nivelPrevio = 0;
  if (millis() - msSegundo >= 1000) {
    msSegundo = millis();
    const EstadoGnss &g = gnss::estado();
    if (g.hora_valida) sincronizarIso(g.iso);
    Entradas e = entradasActuales();
    if (e.fix && !simulacro && g.fix) { ultLat = g.lat; ultLon = g.lon; hayPosicion = true; }
    float vel = vehiculo::velocidadBus() >= 0 ? vehiculo::velocidadBus() : g.vel_kmh;
    String ts = isoAhora();
    deteccion::actualizar(e, ts.c_str(), ultLat, ultLon, vel);

    int n = deteccion::nivel();
    if (n != nivelPrevio) {
      Serial.printf("[deteccion] nivel N%d -> N%d\n", nivelPrevio, n);
      enviarTelemetria(e);           // aviso inmediato al cambiar de nivel (alerta temprana)
      msTelemetria = millis();
      nivelPrevio = n;
    }
    if (deteccion::eventoTerminado()) enviarExpediente();
    if (millis() - msTelemetria >= PERIODO_TELEMETRIA_S * 1000UL) { msTelemetria = millis(); enviarTelemetria(e); }
  }

  if (diagnosticoPendiente >= 0) { int32_t id = diagnosticoPendiente; diagnosticoPendiente = -1; ejecutarDiagnostico(id); }
  vaciarCola();
  bool comOk = enlace::conectado() && almacen::tamanoCola() == 0 && millis() - msUltimoEnvioOk < PERIODO_TELEMETRIA_S * 2500UL;
  interfaz::actualizar(deteccion::nivel(), comOk, simulacro);
}
