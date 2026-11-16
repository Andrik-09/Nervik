// Configuración del prototipo. Copia este archivo como config.h y llena tus datos.
// config.h no se sube a GitHub (está en .gitignore) porque lleva la contraseña del Wi-Fi.
#pragma once

// ---- Identidad ----
// Serie del prototipo. Los que empiezan con NVK-P aparecen en la página web como "prototipo en vivo".
#define DISPOSITIVO_ID "NVK-P001"

// ---- Servidor ----
// En el laboratorio: la IP de la computadora que corre `npm run prototipo`, por ejemplo "http://192.168.1.20:3000".
// Desplegado: la URL pública, por ejemplo "https://nervik.onrender.com".
#define API_URL "http://192.168.1.20:3000"

// ---- Enlace Wi-Fi (env pico_w_wifi) ----
// Sirve la red del laboratorio o el hotspot del celular. El hotspot permite probar en el carro:
// apagarlo equivale a perder la red celular.
#define WIFI_SSID "mi-red"
#define WIFI_PASS "mi-contrasena"

// ---- Enlace celular (env pico_sim7080g) ----
#define APN "iot.1nce.net"      // APN de la SIM IoT 1NCE del BOM
#define SIM_PIN ""

// ---- Receptor GNSS (LC76G del BOM; sirve cualquier módulo NMEA: L76K, NEO-6M/M8N) ----
#define GNSS_BAUD 9600          // LC76G de fábrica: 115200 · L76K y NEO-6M: 9600

// ---- Módulos opcionales en la protoboard ----
#define USAR_CAN 0              // 1 si hay MCP2515 + transceptor conectado a un bus J1939 (o a un simulador de bus)
#define CAN_CRISTAL_8MHZ 1      // los módulos MCP2515 azules comunes traen cristal de 8 MHz
#define USAR_IMU 0              // 1 si hay LSM6DSOX (o LSM6DS3) por I2C
#define MOTOR_SIEMPRE_ENCENDIDO 1  // sin bus CAN: 1 = se reporta motor encendido; 0 = se lee el interruptor de ignición (GP22)

// ---- Mediciones analógicas (0 = no conectado) ----
#define DIVISOR_ALIMENTACION 11.0f  // divisor 100k/10k desde la fuente de 12/24 V hacia GP26
#define DIVISOR_BATERIA 2.0f        // divisor 10k/10k desde la celda LiFePO4 hacia GP27
#define MEDIR_ALIMENTACION 0
#define MEDIR_BATERIA 0

// ---- Tiempos ----
#define PERIODO_TELEMETRIA_S 10     // el PDS pide 30 s en producción; 10 s agiliza las pruebas de banco
