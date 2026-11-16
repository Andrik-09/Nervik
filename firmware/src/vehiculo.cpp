#include "vehiculo.h"
#include <SPI.h>
#include <Wire.h>
#include <mcp2515.h>
#include "config.h"
#include "pines.h"
#include <initializer_list>

#if USAR_CAN
static MCP2515 can(PIN_CAN_CS);
#endif
static float velBus = -1, rpm = -1;
static uint32_t msUltimaTrama = 0;

// --- IMU ---
static bool imuOk = false;
static uint8_t imuDir = 0x6A;
static float sumaMag = 0, sumaMag2 = 0;
static int muestras = 0;
static float desviacion = -1;      // desviación de |a| en el último segundo, en g

static void imuEscribir(uint8_t reg, uint8_t v) { Wire.beginTransmission(imuDir); Wire.write(reg); Wire.write(v); Wire.endTransmission(); }
static bool imuLeer(uint8_t reg, uint8_t *b, int n) {
  Wire.beginTransmission(imuDir); Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(imuDir, (uint8_t)n) != n) return false;
  for (int i = 0; i < n; i++) b[i] = Wire.read();
  return true;
}

void vehiculo::iniciar() {
#if USAR_CAN
  SPI.setRX(PIN_CAN_MISO); SPI.setTX(PIN_CAN_MOSI); SPI.setSCK(PIN_CAN_SCK);
  SPI.begin();
  can.reset();
  can.setBitrate(CAN_250KBPS, CAN_CRISTAL_8MHZ ? MCP_8MHZ : MCP_16MHZ);  // J1939: 250 kbit/s
  can.setListenOnlyMode();  // no envía tramas ni ACK: el equipo solo escucha
#endif
#if USAR_IMU
  Wire.setSDA(PIN_IMU_SDA); Wire.setSCL(PIN_IMU_SCL);
  Wire.begin();
  for (uint8_t dir : {0x6A, 0x6B}) {
    imuDir = dir;
    uint8_t who = 0;
    if (imuLeer(0x0F, &who, 1) && (who == 0x6C || who == 0x69 || who == 0x6A)) { imuOk = true; break; }
  }
  if (imuOk) imuEscribir(0x10, 0x40);  // CTRL1_XL: 104 Hz, ±2 g
#endif
#if !MOTOR_SIEMPRE_ENCENDIDO
  pinMode(PIN_IGNICION, INPUT_PULLDOWN);
#endif
  analogReadResolution(12);
}

void vehiculo::leer() {
#if USAR_CAN
  struct can_frame f;
  while (can.readMessage(&f) == MCP2515::ERROR_OK) {
    if (!(f.can_id & CAN_EFF_FLAG)) continue;  // J1939 usa identificadores extendidos de 29 bits
    uint32_t id = f.can_id & CAN_EFF_MASK;
    uint32_t pgn = (id >> 8) & 0x3FFFF;
    if (((pgn >> 8) & 0xFF) < 240) pgn &= 0x3FF00;  // PDU1: el byte bajo es la dirección destino
    msUltimaTrama = millis();
    if (pgn == 65265 && f.can_dlc >= 3) {           // CCVS1: velocidad basada en rueda, 1/256 km/h por bit
      uint16_t v = f.data[1] | (f.data[2] << 8);
      if (v < 0xFB00) velBus = v / 256.0f;
    } else if (pgn == 61444 && f.can_dlc >= 5) {    // EEC1: velocidad del motor, 0.125 rpm por bit
      uint16_t v = f.data[3] | (f.data[4] << 8);
      if (v < 0xFB00) rpm = v * 0.125f;
    }
  }
#endif
#if USAR_IMU
  static uint32_t msMuestra = 0, msVentana = 0;
  if (imuOk && millis() - msMuestra >= 50) {   // 20 muestras por segundo
    msMuestra = millis();
    uint8_t b[6];
    if (imuLeer(0x28, b, 6)) {
      float ax = (int16_t)(b[0] | b[1] << 8) * 0.061e-3f, ay = (int16_t)(b[2] | b[3] << 8) * 0.061e-3f, az = (int16_t)(b[4] | b[5] << 8) * 0.061e-3f;
      float m = sqrtf(ax * ax + ay * ay + az * az);
      sumaMag += m; sumaMag2 += m * m; muestras++;
    }
  }
  if (millis() - msVentana >= 1000 && muestras > 5) {
    msVentana = millis();
    float media = sumaMag / muestras;
    desviacion = sqrtf(fmaxf(0, sumaMag2 / muestras - media * media));
    sumaMag = sumaMag2 = 0; muestras = 0;
  }
#endif
}

bool vehiculo::hayBus() { return msUltimaTrama && millis() - msUltimaTrama < 3000; }
float vehiculo::velocidadBus() { return hayBus() ? velBus : -1; }
bool vehiculo::hayImu() { return imuOk; }

bool vehiculo::motorEncendido() {
  if (hayBus() && rpm >= 0) return rpm > 300;
#if MOTOR_SIEMPRE_ENCENDIDO
  return true;
#else
  return digitalRead(PIN_IGNICION) == HIGH;
#endif
}

int vehiculo::detenido(float velGnss, bool fixGnss) {
  float vb = velocidadBus();
  if (vb >= 0) return vb < 2 ? 1 : 0;              // el bus es la mejor fuente y no depende del GNSS
  if (imuOk && desviacion >= 0) return desviacion < 0.015f ? 1 : 0;  // umbral a calibrar en ruta
  if (fixGnss) return velGnss < 3 ? 1 : 0;         // con jammer no hay GNSS: queda desconocido
  return -1;
}

float vehiculo::alimentacion() {
#if MEDIR_ALIMENTACION
  return analogRead(PIN_ADC_ALIMENTACION) * 3.3f / 4095.0f * DIVISOR_ALIMENTACION;
#else
  return NAN;
#endif
}

float vehiculo::bateria() {
#if MEDIR_BATERIA
  // LiFePO4: 2.9 V vacía, 3.4 V llena (aproximación lineal)
  float v = analogRead(PIN_ADC_BATERIA) * 3.3f / 4095.0f * DIVISOR_BATERIA;
  return constrain((v - 2.9f) / 0.5f * 100.0f, 0.0f, 100.0f);
#else
  return NAN;
#endif
}
