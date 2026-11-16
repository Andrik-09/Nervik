// Asignación de pines del prototipo en protoboard (Raspberry Pi Pico / Pico W).
// Ver docs/prototipo.md para el diagrama de conexiones.
#pragma once

// Receptor GNSS — UART0
#define PIN_GNSS_TX 0     // Pico TX  -> RX del GNSS
#define PIN_GNSS_RX 1     // Pico RX  <- TX del GNSS

// Módem SIM7080G — UART1 (solo env pico_sim7080g)
#define PIN_MODEM_TX 4
#define PIN_MODEM_RX 5
#define PIN_MODEM_PWRKEY 14

// IMU LSM6DSOX — I2C0
#define PIN_IMU_SDA 8
#define PIN_IMU_SCL 9

// Interfaz local: 3 LED ("una luz, un significado") + buzzer + botón de prueba/estado
#define PIN_LED_ENERGIA 10
#define PIN_LED_COMUNICACION 11
#define PIN_LED_ALERTA 12
#define PIN_BUZZER 13
#define PIN_BOTON_PRUEBA 15   // a GND, con pull-up interno. El botón de reinicio va al pin RUN.

// Controlador CAN MCP2515 — SPI0
#define PIN_CAN_MISO 16
#define PIN_CAN_CS 17
#define PIN_CAN_SCK 18
#define PIN_CAN_MOSI 19

// Entradas varias
#define PIN_IGNICION 22       // interruptor a 3.3 V (pull-down interno)
#define PIN_ADC_ALIMENTACION 26
#define PIN_ADC_BATERIA 27
