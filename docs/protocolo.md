# Protocolo dispositivo → API (v1)

Este documento es el contrato entre el firmware del dispositivo (RP2040, ver `firmware/`) y la API. El simulador (`simulador/dispositivo.js`) ya lo implementa en JavaScript; el firmware en C debe producir exactamente lo mismo.

## 1. Identidad del equipo

En el primer arranque el equipo genera un par de llaves **ECDSA P-256 (secp256r1)** con micro-ecc y el generador aleatorio del RP2040. La llave privada nunca sale del equipo. La llave pública se entrega como **código de alta** `NVK1:<serie>:<base64 de X||Y>` (y su QR), que la app convierte a PEM; también se imprime en PEM por el puerto serie.

La central da de alta el equipo en la app (pantalla **Instalar**) con el código de alta (o la llave PEM) y el número económico de la unidad.

## 2. Sobre que se envía

`POST /api/v1/dispositivo/mensajes` con `Content-Type: application/json`:

```json
{
  "dispositivo": "NVK-0001",
  "payload": "<base64 de los bytes JSON>",
  "firma": "<base64 de r||s, 64 bytes>"
}
```

Se firma el **payload tal cual**, como bytes. El servidor verifica esos mismos bytes y después los interpreta como JSON, así que el firmware no necesita una serialización canónica: basta con no modificar el buffer entre firmar y codificar en base64.

La firma es ECDSA con SHA-256, en formato **r y s de 32 bytes cada uno, big-endian, concatenados** (64 bytes), que es lo que entrega micro-ecc directamente. Es el mismo formato que usa WebCrypto, lo que permite verificar el expediente en el navegador de la aseguradora.

## 3. Payload de telemetría

```json
{
  "dispositivo": "NVK-0001", "tipo": "telemetria", "contador": 1842,
  "ts": "2026-11-16T08:14:07Z",
  "lat": 18.84112, "lon": -97.55021, "vel": 82, "nivel": 0,
  "cn0": 41.2, "sats": 11, "rssi": -78,
  "motor": 1, "bateria": 96, "alimentacion": 27.4
}
```

| Campo | Fuente | Nota |
|---|---|---|
| `contador` | NVS | Entero que **siempre sube**. La API rechaza con 409 cualquier valor igual o menor al último recibido (protección contra reenvío). Al arrancar, sumar un margen (p. ej. +1000) por si se perdió la última escritura en flash. |
| `nivel` | modelo TinyML | 0 Normal · 1 Anomalía · 2 Sospecha · 3 Evento confirmado |
| `cn0` | GNSS (NMEA GSV) | Promedio de C/N0 de los satélites en vista, dB-Hz |
| `rssi` | módem | `AT+CSQ` convertido a dBm |
| `motor`, `vel` | bus J1939 | Modo solo escucha (PGN 61444 rpm, 65265 velocidad) |

Periodo recomendado: cada 30 s en estado normal y **de inmediato** cuando cambia el nivel. Con ese periodo, configurar la API con `UMBRAL_MUDA_S=90`. El simulador usa 3 s para que la demostración sea ágil.

## 4. Payload de expediente

Se envía cuando termina la interferencia (o cuando regresa la red, si el equipo estuvo sin conexión):

```json
{
  "dispositivo": "NVK-0001", "tipo": "evento", "contador": 1850,
  "ts": "2026-11-16T08:31:55Z",
  "inicio": "2026-11-16T08:14:07Z", "fin": "2026-11-16T08:31:55Z", "nivel_max": 3,
  "ultima_pos": { "lat": 18.84112, "lon": -97.55021, "vel": 82, "ts": "2026-11-16T08:14:07Z" },
  "linea_tiempo": [
    { "ts": "...", "tipo": "gnss_degradado", "detalle": "...", "lat": 0, "lon": 0, "vel": 82 },
    { "ts": "...", "tipo": "red_perdida", "detalle": "..." },
    { "ts": "...", "tipo": "parada_no_programada", "detalle": "..." },
    { "ts": "...", "tipo": "nivel_3", "detalle": "..." },
    { "ts": "...", "tipo": "fin_interferencia", "detalle": "..." }
  ],
  "hash_prev": "<sha256 hex del payload del expediente anterior; 64 ceros en el primero>",
  "firmware": "0.1.0"
}
```

`hash_prev` encadena los expedientes. El equipo guarda en flash el SHA-256 del último payload de evento que firmó. Si alguien borra o altera un expediente intermedio, la cadena se rompe y la app lo marca.

## 5. Respuestas de la API

| Código | Significado | Qué hace el firmware |
|---|---|---|
| 202 / 201 | Aceptado | Borra el mensaje de la cola |
| 401 | Firma inválida | Registrar error; no reintentar ese mensaje |
| 404 | Equipo no dado de alta | Mantener la cola y reintentar cada 10 min |
| 409 | Contador repetido | Descartar el mensaje (ya llegó) |
| 5xx / sin red | Falla temporal | Mantener en cola (W25Q128) y reintentar en orden |

Los mensajes se guardan en la flash (LittleFS en el prototipo; W25Q64 en la PCB) y se envían **en el orden en que se firmaron**, porque la API exige contador creciente.

## 6. Órdenes de la app y diagnóstico

Las respuestas 201/202 traen `comandos`: una lista de órdenes pendientes `{ "id": 7, "tipo": "diagnostico" | "simulacro" }`. Así no hace falta que el equipo tenga IP pública. Al recibir `diagnostico`, el equipo contesta con un mensaje firmado:

```json
{ "dispositivo": "NVK-P001", "tipo": "diagnostico", "contador": 1901, "comando_id": 7, "ok": true,
  "pruebas": [ { "prueba": "posicion_gnss", "ok": true, "valor": "9 sat, C/N0 41.2 dB-Hz" },
               { "prueba": "bus_j1939", "ok": null, "valor": "no instalado" } ],
  "firmware": "0.1.0" }
```

`ok: null` significa que el módulo no está instalado. Sin `comando_id` (diagnóstico pedido con el botón del equipo) la API lo registra igual. Las órdenes nunca actúan sobre el vehículo.

## 7. Campos adicionales del prototipo

Telemetría: `fix` (el GNSS tiene posición), `bus` (llegan tramas J1939), `firmware` (versión) y `simulacro` (prueba sin inhibidor). Expediente: `simulacro` y `firmware`. La API devuelve `hora` en cada respuesta para que el equipo sincronice su reloj cuando no tiene GNSS.
