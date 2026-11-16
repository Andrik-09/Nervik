#include "almacen.h"
#include <LittleFS.h>

static const char *RUTA_CONTADOR = "/estado/contador";
static const char *RUTA_HASH = "/estado/hash_prev";
static const char *DIR_COLA = "/cola";
static uint32_t contador = 0;
static int enCola = 0;

static String nombre(uint32_t c) {
  char n[24];
  snprintf(n, sizeof(n), "/cola/%010lu", (unsigned long)c);  // ceros a la izquierda: orden alfabético = orden de firma
  return n;
}

bool almacen::iniciar() {
  if (!LittleFS.begin()) {
    Serial.println(F("[almacen] Formateando LittleFS…"));
    LittleFS.format();
    if (!LittleFS.begin()) return false;
  }
  LittleFS.mkdir("/estado");
  LittleFS.mkdir(DIR_COLA);
  File f = LittleFS.open(RUTA_CONTADOR, "r");
  if (f) { contador = f.readString().toInt(); f.close(); }
  // Margen por si la última escritura no alcanzó a guardarse antes de un corte de energía
  contador += 5;
  Dir d = LittleFS.openDir(DIR_COLA);
  enCola = 0;
  while (d.next()) enCola++;
  return true;
}

uint32_t almacen::siguienteContador() {
  contador++;
  File f = LittleFS.open(RUTA_CONTADOR, "w");
  if (f) { f.print(contador); f.close(); }
  return contador;
}

String almacen::hashPrevio() {
  File f = LittleFS.open(RUTA_HASH, "r");
  if (!f) return String("0000000000000000000000000000000000000000000000000000000000000000");
  String h = f.readString();
  f.close();
  h.trim();
  return h.length() == 64 ? h : String("0000000000000000000000000000000000000000000000000000000000000000");
}

void almacen::guardarHashPrevio(const String &hex) {
  File f = LittleFS.open(RUTA_HASH, "w");
  if (f) { f.print(hex); f.close(); }
}

bool almacen::encolar(uint32_t c, const String &sobre) {
  File f = LittleFS.open(nombre(c), "w");
  if (!f) return false;
  f.print(sobre);
  f.close();
  enCola++;
  return true;
}

bool almacen::primeroEnCola(uint32_t &c, String &sobre) {
  Dir d = LittleFS.openDir(DIR_COLA);
  String menor;
  while (d.next()) if (menor.isEmpty() || d.fileName() < menor) menor = d.fileName();
  if (menor.isEmpty()) { enCola = 0; return false; }
  File f = LittleFS.open(String(DIR_COLA) + "/" + menor, "r");
  if (!f) return false;
  sobre = f.readString();
  f.close();
  c = strtoul(menor.c_str(), nullptr, 10);
  return true;
}

void almacen::quitarDeCola(uint32_t c) {
  if (LittleFS.remove(nombre(c)) && enCola > 0) enCola--;
}

int almacen::tamanoCola() { return enCola; }

void almacen::vaciarCola() {
  Dir d = LittleFS.openDir(DIR_COLA);
  while (d.next()) LittleFS.remove(String(DIR_COLA) + "/" + d.fileName());
  enCola = 0;
}
