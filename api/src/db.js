// Base de datos local (SQLite integrado en Node 22).
// El esquema está escrito en SQL estándar para poder migrarlo a PostgreSQL / Supabase
// cuando el piloto lo necesite (ver docs/arquitectura.md).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const RUTA = process.env.NERVIK_DB || './datos/nervik.db';
if (RUTA !== ':memory:') mkdirSync(dirname(RUTA), { recursive: true });

export const db = new DatabaseSync(RUTA);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS dispositivos (
  id              TEXT PRIMARY KEY,          -- número de serie, p. ej. NVK-0001
  unidad          TEXT NOT NULL,             -- número económico del tractocamión, p. ej. ECO-14
  corredor        TEXT,                      -- corredor principal, p. ej. México–Puebla–Veracruz
  llave_publica   TEXT NOT NULL,             -- ECDSA P-256 en PEM (SPKI)
  ultimo_contador INTEGER NOT NULL DEFAULT 0,-- anti-replay: cada mensaje debe traer un contador mayor
  ultimo_hash     TEXT NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
  creado          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS telemetria (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  dispositivo_id TEXT NOT NULL REFERENCES dispositivos(id),
  ts             TEXT NOT NULL,              -- hora del dispositivo (ISO 8601 UTC)
  lat            REAL, lon REAL,
  vel            REAL,                       -- km/h
  nivel          INTEGER NOT NULL DEFAULT 0, -- 0 Normal, 1 Anomalía, 2 Sospecha, 3 Evento confirmado
  cn0            REAL,                       -- relación portadora/ruido GNSS promedio (dB-Hz)
  sats           INTEGER,                    -- satélites en uso
  rssi           REAL,                       -- potencia celular (dBm)
  motor          INTEGER,                    -- 1 encendido, 0 apagado (leído del bus J1939)
  bateria        REAL,                       -- % batería de respaldo
  alimentacion   REAL,                       -- voltaje del vehículo (V)
  recibido       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_tel_disp ON telemetria(dispositivo_id, id DESC);

CREATE TABLE IF NOT EXISTS eventos (
  id             TEXT PRIMARY KEY,           -- hash corto del expediente
  dispositivo_id TEXT NOT NULL REFERENCES dispositivos(id),
  inicio         TEXT NOT NULL,
  fin            TEXT,
  nivel_max      INTEGER NOT NULL,
  lat            REAL, lon REAL,             -- última posición válida antes de la interferencia
  payload_b64    TEXT NOT NULL,              -- bytes exactos que firmó el dispositivo
  firma          TEXT NOT NULL,              -- ECDSA P-256 / SHA-256, formato r||s en base64
  hash           TEXT NOT NULL,              -- SHA-256 del payload
  hash_prev      TEXT NOT NULL,              -- hash del expediente anterior del mismo dispositivo
  cadena_integra INTEGER NOT NULL,           -- 1 si hash_prev coincide con el último registrado
  recibido       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_ev_disp ON eventos(dispositivo_id, inicio DESC);

CREATE TABLE IF NOT EXISTS prospectos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre    TEXT NOT NULL,
  empresa   TEXT NOT NULL,
  unidades  TEXT,
  corredor  TEXT,
  telefono  TEXT NOT NULL,
  correo    TEXT,
  tipo      TEXT NOT NULL DEFAULT 'flota',   -- flota | aseguradora | broker
  origen    TEXT,
  creado    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`);

// Migraciones simples (columnas agregadas después de la v0.1)
const columnas = db.prepare("SELECT name FROM pragma_table_info('eventos')").all().map(c => c.name);
if (!columnas.includes('simulacro')) db.exec('ALTER TABLE eventos ADD COLUMN simulacro INTEGER NOT NULL DEFAULT 0');
const colTel = db.prepare("SELECT name FROM pragma_table_info('telemetria')").all().map(c => c.name);
for (const [col, def] of [['simulacro', 'INTEGER NOT NULL DEFAULT 0'], ['fix', 'INTEGER'], ['bus', 'INTEGER'], ['firmware', 'TEXT']]) {
  if (!colTel.includes(col)) db.exec(`ALTER TABLE telemetria ADD COLUMN ${col} ${def}`);
}

const colPro = db.prepare("SELECT name FROM pragma_table_info('prospectos')").all().map(c => c.name);
for (const col of ['motivo', 'mensaje']) if (!colPro.includes(col)) db.exec(`ALTER TABLE prospectos ADD COLUMN ${col} TEXT`);

db.exec(`
CREATE TABLE IF NOT EXISTS pedidos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  folio         TEXT UNIQUE,
  nombre        TEXT NOT NULL,
  empresa       TEXT NOT NULL,
  rfc           TEXT,
  correo        TEXT NOT NULL,
  telefono      TEXT NOT NULL,
  estado_mx     TEXT,
  direccion     TEXT,
  corredor      TEXT,
  unidades      INTEGER NOT NULL,
  metodo_pago   TEXT NOT NULL,                 -- tarjeta | transferencia | mercadopago
  subtotal_hoy  REAL NOT NULL,                 -- dispositivos + primer mes, sin IVA
  iva_hoy       REAL NOT NULL,
  total_hoy     REAL NOT NULL,
  mensual       REAL NOT NULL,                 -- a partir del segundo mes, con IVA
  estado        TEXT NOT NULL DEFAULT 'pendiente_pago', -- pendiente_pago | pagado | instalado | cancelado
  notas         TEXT,
  creado        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Órdenes de la app hacia el equipo (no hacia el vehículo): diagnóstico y prueba de alerta
CREATE TABLE IF NOT EXISTS comandos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  dispositivo_id TEXT NOT NULL REFERENCES dispositivos(id),
  tipo           TEXT NOT NULL,                -- diagnostico | simulacro
  estado         TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | entregado | completado
  resultado      TEXT,                         -- JSON que reporta el equipo (firmado)
  creado         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  entregado      TEXT,
  completado     TEXT
);
CREATE INDEX IF NOT EXISTS ix_cmd_disp ON comandos(dispositivo_id, id DESC);
`);
