#ifdef ENLACE_SIM7080G
// Enlace celular LTE-M/NB-IoT con SIMCom SIM7080G (TinyGSM).
// Probado solo en compilación: validar con el módulo físico (ver docs/prototipo.md).
#include "enlace.h"
#include <TinyGsmClient.h>
#include <ArduinoHttpClient.h>
#include "config.h"
#include "pines.h"

#define SerialAT Serial2
static TinyGsm modem(SerialAT);
static TinyGsmClient clientePlano(modem, 0);
static TinyGsmClientSecure clienteSeguro(modem, 1);
static bool simulado = false, enRed = false;
static uint32_t ultimoIntento = 0;
static float ultimoRssi = 0;

static void encender() {
  pinMode(PIN_MODEM_PWRKEY, OUTPUT);
  digitalWrite(PIN_MODEM_PWRKEY, HIGH);
  delay(1200);
  digitalWrite(PIN_MODEM_PWRKEY, LOW);
  delay(3000);
}

void enlace::iniciar() {
  SerialAT.setTX(PIN_MODEM_TX);
  SerialAT.setRX(PIN_MODEM_RX);
  SerialAT.setFIFOSize(1024);
  SerialAT.begin(115200);
  if (!modem.testAT(3000)) encender();
  modem.restart();
  if (strlen(SIM_PIN) && modem.getSimStatus() != 3) modem.simUnlock(SIM_PIN);
  ultimoIntento = 0;
}

void enlace::mantener() {
  if (millis() - ultimoIntento < 30000 && ultimoIntento) return;
  ultimoIntento = millis();
  int csq = modem.getSignalQuality();            // 0..31, 99 = desconocido
  ultimoRssi = (csq > 0 && csq < 32) ? -113 + 2 * csq : 0;
  if (!modem.isNetworkConnected()) { enRed = false; modem.waitForNetwork(15000L); }
  if (modem.isNetworkConnected() && !modem.isGprsConnected()) modem.gprsConnect(APN, "", "");
  enRed = modem.isNetworkConnected() && modem.isGprsConnected();
}

bool enlace::conectado() { return !simulado && enRed; }
float enlace::rssi() { return conectado() ? ultimoRssi : 0; }
void enlace::forzarDesconexion(bool si) { simulado = si; }
const char *enlace::nombre() { return "SIM7080G"; }

int enlace::post(const char *ruta, const String &cuerpo, String &respuesta) {
  if (!conectado()) return -1;
  String url = API_URL;
  bool https = url.startsWith("https://");
  url = url.substring(https ? 8 : 7);
  int barra = url.indexOf('/');
  String host = barra >= 0 ? url.substring(0, barra) : url;
  String base = barra >= 0 ? url.substring(barra) : "";
  uint16_t puerto = https ? 443 : 80;
  int dosPuntos = host.indexOf(':');
  if (dosPuntos >= 0) { puerto = host.substring(dosPuntos + 1).toInt(); host = host.substring(0, dosPuntos); }

  HttpClient http(https ? (Client &)clienteSeguro : (Client &)clientePlano, host.c_str(), puerto);
  http.setTimeout(15000);
  http.beginRequest();
  http.post((base + ruta).c_str());
  http.sendHeader("Content-Type", "application/json");
  http.sendHeader("Content-Length", cuerpo.length());
  http.beginBody();
  http.print(cuerpo);
  http.endRequest();
  int codigo = http.responseStatusCode();
  respuesta = codigo > 0 ? http.responseBody() : String();
  http.stop();
  return codigo;
}
#endif
