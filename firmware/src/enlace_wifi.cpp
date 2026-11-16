#ifdef ENLACE_WIFI
#include "enlace.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include "config.h"

static bool simulado = false;
static uint32_t ultimoIntento = 0;

void enlace::iniciar() {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(DISPOSITIVO_ID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  ultimoIntento = millis();
}

void enlace::mantener() {
  if (WiFi.status() != WL_CONNECTED && millis() - ultimoIntento > 15000) {
    ultimoIntento = millis();
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASS);
  }
}

bool enlace::conectado() { return !simulado && WiFi.status() == WL_CONNECTED; }
float enlace::rssi() { return conectado() ? (float)WiFi.RSSI() : 0; }
void enlace::forzarDesconexion(bool si) { simulado = si; }
const char *enlace::nombre() { return "Wi-Fi"; }

int enlace::post(const char *ruta, const String &cuerpo, String &respuesta) {
  if (!conectado()) return -1;
  HTTPClient http;
  String url = String(API_URL) + ruta;
  // El contenido ya va firmado: aunque alguien intercepte el TLS no puede alterarlo sin romper la firma.
  // Para producción, fijar el certificado raíz del servidor en lugar de setInsecure().
  if (url.startsWith("https")) http.setInsecure();
  http.setTimeout(8000);
  if (!http.begin(url)) return -2;
  http.addHeader("Content-Type", "application/json");
  int codigo = http.POST(cuerpo);
  respuesta = codigo > 0 ? http.getString() : String();
  http.end();
  return codigo;
}
#endif
