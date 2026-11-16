#include "cripto.h"
#include <LittleFS.h>
#include <uECC.h>
#include <qrcode.h>
#include "config.h"
#include "sha256.h"

// En producción la llave privada debe vivir en un elemento seguro (p. ej. ATECC608) o en
// flash cifrada; en el prototipo se guarda en LittleFS para poder inspeccionarla.
static const char *RUTA_LLAVE = "/estado/llave.bin";
static uint8_t privada[32];
static uint8_t publica[64];
static const struct uECC_Curve_t *curva = uECC_secp256r1();

// Generador aleatorio del RP2040 (oscilador en anillo)
static int rng(uint8_t *dest, unsigned tam) {
  while (tam--) *dest++ = (uint8_t)rp2040.hwrand32();
  return 1;
}

void cripto::sha256(const uint8_t *datos, size_t n, uint8_t salida[32]) { ::sha256(datos, n, salida); }

String cripto::hex(const uint8_t *b, size_t n) {
  static const char *d = "0123456789abcdef";
  String s; s.reserve(n * 2);
  for (size_t i = 0; i < n; i++) { s += d[b[i] >> 4]; s += d[b[i] & 15]; }
  return s;
}

String cripto::base64(const uint8_t *b, size_t n) {
  static const char *t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  String s; s.reserve((n + 2) / 3 * 4);
  for (size_t i = 0; i < n; i += 3) {
    uint32_t v = (uint32_t)b[i] << 16 | (i + 1 < n ? (uint32_t)b[i+1] << 8 : 0) | (i + 2 < n ? b[i+2] : 0);
    s += t[(v >> 18) & 63]; s += t[(v >> 12) & 63];
    s += i + 1 < n ? t[(v >> 6) & 63] : '=';
    s += i + 2 < n ? t[v & 63] : '=';
  }
  return s;
}

// ---------------- llave del equipo ----------------
static bool guardarLlave() {
  LittleFS.mkdir("/estado");
  File f = LittleFS.open(RUTA_LLAVE, "w");
  if (!f) return false;
  f.write(privada, 32);
  f.close();
  return true;
}

bool cripto::regenerar() {
  if (!uECC_make_key(publica, privada, curva)) return false;
  return guardarLlave();
}

bool cripto::iniciar() {
  uECC_set_rng(&rng);
  File f = LittleFS.open(RUTA_LLAVE, "r");
  if (f && f.read(privada, 32) == 32) {
    f.close();
    return uECC_compute_public_key(privada, publica, curva);
  }
  if (f) f.close();
  Serial.println(F("[cripto] Primer arranque: generando llave ECDSA P-256…"));
  return regenerar();
}

bool cripto::firmar(const uint8_t hash[32], uint8_t firma[64]) {
  return uECC_sign(privada, hash, 32, firma, curva);
}

bool cripto::autoprueba() {
  uint8_t h[32], f[64];
  for (auto &b : h) b = (uint8_t)rp2040.hwrand32();
  return uECC_sign(privada, h, 32, f, curva) && uECC_verify(publica, h, 32, f, curva);
}

String cripto::llavePublicaPem() {
  // Encabezado DER de SubjectPublicKeyInfo para P-256 sin comprimir
  static const uint8_t prefijo[] = {0x30,0x59,0x30,0x13,0x06,0x07,0x2a,0x86,0x48,0xce,0x3d,0x02,0x01,0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07,0x03,0x42,0x00,0x04};
  uint8_t der[sizeof(prefijo) + 64];
  memcpy(der, prefijo, sizeof(prefijo));
  memcpy(der + sizeof(prefijo), publica, 64);
  String b = base64(der, sizeof(der));
  String pem = "-----BEGIN PUBLIC KEY-----\n";
  for (unsigned i = 0; i < b.length(); i += 64) { pem += b.substring(i, i + 64); pem += '\n'; }
  return pem + "-----END PUBLIC KEY-----";
}

String cripto::codigoAlta() {
  return String("NVK1:") + DISPOSITIVO_ID + ":" + base64(publica, 64);
}

// Dibuja el código QR en el monitor serie con bloques de texto, para escanearlo con la app.
void cripto::imprimirQR(Print &out, const String &texto) {
  QRCode qr;
  uint8_t buf[qrcode_getBufferSize(7)];
  if (qrcode_initText(&qr, buf, 7, ECC_LOW, texto.c_str()) != 0) { out.println(F("(no cupo el QR)")); return; }
  const int margen = 2;
  for (int y = -margen; y < qr.size + margen; y += 2) {
    for (int x = -margen; x < qr.size + margen; x++) {
      bool a = y >= 0 && x >= 0 && x < qr.size && y < qr.size && qrcode_getModule(&qr, x, y);
      bool b = y + 1 >= 0 && x >= 0 && x < qr.size && y + 1 < qr.size && qrcode_getModule(&qr, x, y + 1);
      // fondo claro, módulos oscuros (se lee mejor en terminales con fondo negro invirtiendo)
      out.print(!a && !b ? "█" : (!a && b ? "▀" : (a && !b ? "▄" : " ")));
    }
    out.println();
  }
}
