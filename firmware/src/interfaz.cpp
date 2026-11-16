#include "interfaz.h"
#include "pines.h"
#include <initializer_list>

static uint32_t msPulsado = 0, msNivel3 = 0;
static bool estabaPulsado = false, largoEmitido = false;
static int nivelPrevio = 0;

void interfaz::iniciar() {
  for (int p : {PIN_LED_ENERGIA, PIN_LED_COMUNICACION, PIN_LED_ALERTA}) { pinMode(p, OUTPUT); digitalWrite(p, LOW); }
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_BOTON_PRUEBA, INPUT_PULLUP);
  digitalWrite(PIN_LED_ENERGIA, HIGH);
}

void interfaz::destello() {
  for (int i = 0; i < 2; i++) {
    for (int p : {PIN_LED_ENERGIA, PIN_LED_COMUNICACION, PIN_LED_ALERTA}) digitalWrite(p, HIGH);
    tone(PIN_BUZZER, 2700, 60);
    delay(150);
    for (int p : {PIN_LED_COMUNICACION, PIN_LED_ALERTA}) digitalWrite(p, LOW);
    delay(150);
  }
}

void interfaz::actualizar(int nivel, bool comOk, bool simulacro) {
  uint32_t t = millis();
  // En simulacro el LED de energía parpadea para que nadie lo confunda con un ataque real
  digitalWrite(PIN_LED_ENERGIA, simulacro ? ((t / 250) % 2) : HIGH);
  digitalWrite(PIN_LED_COMUNICACION, comOk ? HIGH : ((t / 500) % 2));
  bool alerta = nivel == 0 ? false : nivel == 1 ? (t / 500) % 2 : nivel == 2 ? (t / 125) % 2 : true;
  digitalWrite(PIN_LED_ALERTA, alerta);

  if (nivel == 3 && nivelPrevio != 3) msNivel3 = t;
  nivelPrevio = nivel;
  static uint32_t msBeep = 0;
  if (nivel == 2 && t - msBeep > 2000) { msBeep = t; tone(PIN_BUZZER, 2700, 100); }
  if (nivel == 3 && t - msBeep > (t - msNivel3 < 30000 ? 1000 : 10000)) { msBeep = t; tone(PIN_BUZZER, 3100, 300); }
}

interfaz::Boton interfaz::boton() {
  bool pulsado = digitalRead(PIN_BOTON_PRUEBA) == LOW;
  uint32_t t = millis();
  Boton r = NADA;
  if (pulsado && !estabaPulsado) { msPulsado = t; largoEmitido = false; }
  if (pulsado && !largoEmitido && t - msPulsado >= 3000) { largoEmitido = true; r = LARGO; }
  if (!pulsado && estabaPulsado && !largoEmitido && t - msPulsado > 40) r = CORTO;  // 40 ms de antirrebote
  estabaPulsado = pulsado;
  return r;
}
