// Simulador de flota Nervik.
// Mueve unidades por corredores reales, manda telemetría firmada y, cada cierto tiempo,
// recrea un ataque con inhibidor: degradación GNSS → pérdida de red → silencio → parada
// no programada → recuperación y envío del expediente firmado.
//
// Uso:  node simular.js [--unidades 6] [--historial] [--ataque-cada 75] [--sin-ataques]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Dispositivo } from './dispositivo.js';

try { process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))); } catch { /* sin .env */ }

const API = process.env.NERVIK_API || 'http://localhost:3000';
const LLAVE = process.env.CENTRAL_API_KEY || 'dev-central';
const ESTADO = join(dirname(fileURLToPath(import.meta.url)), '.estado-simulador.json');

const arg = (n, def) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : def; };
const bandera = n => process.argv.includes(n);
const N_UNIDADES = Number(arg('--unidades', 6));
const ATAQUE_CADA_S = Number(arg('--ataque-cada', 75));
const PERIODO_S = 3;          // cada cuánto reporta cada unidad
const ACELERACION = 15;       // el tiempo de viaje corre 15× para ver movimiento en el mapa
const SILENCIO_S = 60;        // duración del bloqueo (mayor al umbral de la central)

// Corredores (puntos aproximados sobre las autopistas de cuota)
const CORREDORES = {
  'México–Puebla': [[19.36, -99.06], [19.26, -98.90], [19.35, -98.67], [19.28, -98.43], [19.06, -98.25]],
  'Puebla–Veracruz': [[19.06, -98.25], [19.04, -98.04], [18.84, -97.55], [18.86, -97.37], [18.80, -97.18], [18.85, -97.10], [18.89, -96.93], [19.17, -96.14]],
  'Puebla–Oaxaca': [[19.06, -98.25], [18.75, -97.85], [18.46, -97.39], [17.95, -97.05], [17.07, -96.72]],
  'Bajío (Querétaro–León)': [[20.59, -100.39], [20.52, -100.81], [20.57, -101.19], [20.67, -101.35], [21.12, -101.68]],
};
// Tramos donde se concentran los eventos del historial simulado
const PUNTOS_CALIENTES = [
  [18.84, -97.55, 'Puebla–Veracruz'], [18.86, -97.37, 'Puebla–Veracruz'], [19.35, -98.67, 'México–Puebla'],
  [20.54, -101.0, 'Bajío (Querétaro–León)'], [18.46, -97.39, 'Puebla–Oaxaca'],
];

// ---------- geometría ----------
const rad = g => g * Math.PI / 180;
function km(a, b) {
  const R = 6371, dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function puntoEn(ruta, distKm) {
  let d = distKm;
  for (let i = 0; i < ruta.length - 1; i++) {
    const tramo = km(ruta[i], ruta[i + 1]);
    if (d <= tramo) { const f = d / tramo; return [ruta[i][0] + (ruta[i + 1][0] - ruta[i][0]) * f, ruta[i][1] + (ruta[i + 1][1] - ruta[i][1]) * f]; }
    d -= tramo;
  }
  return ruta[ruta.length - 1];
}
const largo = ruta => ruta.slice(1).reduce((s, p, i) => s + km(ruta[i], p), 0);
const azar = (a, b) => a + Math.random() * (b - a);
const r4 = x => Math.round(x * 1e5) / 1e5;
const esperar = ms => new Promise(r => setTimeout(r, ms));

// ---------- red ----------
async function enviar(sobre) {
  const r = await fetch(`${API}/api/v1/dispositivo/mensajes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sobre) });
  if (!r.ok) console.warn('  respuesta', r.status, await r.text());
  return r;
}
async function alta(d) {
  const r = await fetch(`${API}/api/v1/dispositivos`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': LLAVE },
    body: JSON.stringify({ id: d.id, unidad: d.unidad, corredor: d.corredor, llave_publica: d.llavePublicaPem }),
  });
  if (r.status === 409) return; // ya existía con la misma llave (estado guardado)
  if (!r.ok) throw new Error(`Alta de ${d.id} falló: ${r.status} ${await r.text()}`);
}

// ---------- estado persistente (llaves, contador y cadena) ----------
function cargar() {
  if (!existsSync(ESTADO)) return [];
  return JSON.parse(readFileSync(ESTADO, 'utf8')).map(s => Object.assign(new Dispositivo({ ...s, llavePrivadaPem: s.llave }), { contador: s.contador, hashPrev: s.hashPrev }));
}
function guardar(lista) {
  writeFileSync(ESTADO, JSON.stringify(lista.map(d => ({ id: d.id, unidad: d.unidad, corredor: d.corredor, llave: d.llavePrivadaPem, contador: d.contador, hashPrev: d.hashPrev })), null, 1));
}

// ---------- historial de expedientes (para poblar zonas de riesgo) ----------
async function sembrarHistorial(flota) {
  console.log('Sembrando historial de 60 días…');
  const total = 36;
  const eventos = [];
  for (let k = 0; k < total; k++) {
    const [lat, lon, corredor] = PUNTOS_CALIENTES[Math.floor(Math.random() ** 1.6 * PUNTOS_CALIENTES.length)];
    const dias = azar(1, 60);
    const inicio = new Date(Date.now() - dias * 86_400_000);
    // la mayoría de noche (00–05 h local = 06–11 UTC)
    inicio.setUTCHours(Math.random() < 0.75 ? Math.floor(azar(6, 11)) : Math.floor(azar(0, 24)), Math.floor(azar(0, 60)));
    eventos.push({ inicio, lat: lat + azar(-0.03, 0.03), lon: lon + azar(-0.03, 0.03), corredor });
  }
  eventos.sort((a, b) => a.inicio - b.inicio);
  for (const ev of eventos) {
    const d = flota.find(x => x.corredor === ev.corredor) || flota[0];
    await enviar(d.sobre('evento', expediente(ev.inicio, [ev.lat, ev.lon], 82, Math.random() < 0.7)));
  }
  guardar(flota);
  console.log(`  ${total} expedientes históricos enviados`);
}

// Construye el expediente que el dispositivo guarda durante el ataque
function expediente(inicio, pos, vel, conParada, lineaReal) {
  const t = s => new Date(inicio.getTime() + s * 1000).toISOString();
  const [lat, lon] = [r4(pos[0]), r4(pos[1])];
  const linea = lineaReal || [
    { ts: t(0), tipo: 'gnss_degradado', detalle: `C/N0 promedio cae de 41 a 17 dB-Hz en todos los satélites a la vez a ${vel} km/h (no es túnel)`, lat, lon, vel },
    { ts: t(13), tipo: 'red_perdida', detalle: 'Se pierde la red celular. Alerta en cabina encendida.', lat, lon, vel: vel - 10 },
    ...(conParada ? [
      { ts: t(154), tipo: 'parada_no_programada', detalle: 'Velocidad 0 km/h con motor encendido fuera de punto autorizado.', lat, lon, vel: 0 },
      { ts: t(154), tipo: 'nivel_3', detalle: 'Evento confirmado (N3): interferencia + parada no programada.' },
    ] : []),
    { ts: t(conParada ? 1068 : 240), tipo: 'fin_interferencia', detalle: 'Regresan GNSS y red. Expediente enviado a la central.' },
  ];
  return {
    inicio: linea[0].ts,
    fin: linea[linea.length - 1].ts,
    nivel_max: conParada ? 3 : 2,
    ultima_pos: { lat, lon, vel, ts: linea[0].ts },
    linea_tiempo: linea,
    firmware: 'sim-0.1',
  };
}

// ---------- unidad en movimiento ----------
class Unidad {
  constructor(disp) {
    this.d = disp;
    this.ruta = CORREDORES[disp.corredor];
    this.L = largo(this.ruta);
    this.dist = azar(0, this.L);
    this.sentido = Math.random() < 0.5 ? 1 : -1;
    this.vel = azar(70, 90);
    this.bateria = azar(85, 100);
    this.ataque = null;   // fase del ataque en curso
  }
  pos() { return puntoEn(this.ruta, this.dist); }
  avanzar() {
    if (this.ataque?.parada) { this.vel = 0; return; }
    this.vel = Math.max(55, Math.min(95, this.vel + azar(-4, 4)));
    this.dist += this.sentido * this.vel * (PERIODO_S * ACELERACION) / 3600;
    if (this.dist > this.L) { this.dist = this.L; this.sentido = -1; }
    if (this.dist < 0) { this.dist = 0; this.sentido = 1; }
  }
  telemetria(nivel, cn0, sats, rssi) {
    const [lat, lon] = this.pos();
    return this.d.sobre('telemetria', {
      lat: r4(lat), lon: r4(lon), vel: Math.round(this.vel), nivel,
      cn0: Math.round(cn0 * 10) / 10, sats, rssi: Math.round(rssi), motor: 1,
      bateria: Math.round(this.bateria), alimentacion: Math.round(azar(26.8, 27.8) * 10) / 10,
    });
  }
}

async function ciclo(u) {
  u.avanzar();
  const a = u.ataque;
  if (!a) return enviar(u.telemetria(0, azar(38, 44), Math.floor(azar(9, 14)), azar(-85, -70)));

  const s = (Date.now() - a.t0) / 1000;
  const [lat, lon] = u.pos();
  if (s < 4) {                       // N1: anomalía GNSS, la red todavía funciona → alerta temprana
    if (!a.n1) { a.n1 = true; a.linea.push({ ts: new Date().toISOString(), tipo: 'gnss_degradado', detalle: `C/N0 cae en todos los satélites a la vez a ${Math.round(u.vel)} km/h`, lat: r4(lat), lon: r4(lon), vel: Math.round(u.vel) }); a.pos = [lat, lon]; a.vel = Math.round(u.vel); }
    return enviar(u.telemetria(1, azar(15, 19), 3, -95));
  }
  if (!a.n2) {                       // N2: último mensaje antes de que caiga la red
    a.n2 = true;
    a.linea.push({ ts: new Date().toISOString(), tipo: 'red_perdida', detalle: 'Se pierde la red celular. Alerta en cabina encendida.', lat: r4(lat), lon: r4(lon), vel: Math.round(u.vel) });
    console.log(`  ${u.d.unidad}: red perdida — silencio de ${SILENCIO_S} s`);
    return enviar(u.telemetria(2, 0, 0, -113));
  }
  if (s < SILENCIO_S) {              // silencio: el equipo sigue registrando pero no puede transmitir
    if (s > 15 && !a.parada) {
      a.parada = true;
      const t = new Date().toISOString();
      a.linea.push({ ts: t, tipo: 'parada_no_programada', detalle: 'Velocidad 0 km/h con motor encendido fuera de punto autorizado.', lat: r4(lat), lon: r4(lon), vel: 0 });
      a.linea.push({ ts: t, tipo: 'nivel_3', detalle: 'Evento confirmado (N3): interferencia + parada no programada.' });
    }
    return;
  }
  // recuperación: se envía el expediente y se retoma la telemetría
  a.linea.push({ ts: new Date().toISOString(), tipo: 'fin_interferencia', detalle: 'Regresan GNSS y red. Expediente enviado a la central.' });
  const exp = expediente(new Date(a.t0), a.pos, a.vel, true, a.linea);
  const r = await enviar(u.d.sobre('evento', exp));
  console.log(`  ${u.d.unidad}: expediente enviado (${r.status})`);
  u.ataque = null;
  u.vel = 60;
}

// ---------- principal ----------
async function main() {
  try { await fetch(`${API}/api/v1/salud`); } catch { console.error(`No hay API en ${API}. Arranca primero: npm run dev:api`); process.exit(1); }

  let flota = cargar();
  const primeraVez = flota.length === 0;
  if (flota.length < N_UNIDADES) {
    const nombres = Object.keys(CORREDORES);
    for (let i = flota.length; i < N_UNIDADES; i++) {
      flota.push(new Dispositivo({ id: `NVK-${String(i + 1).padStart(4, '0')}`, unidad: `ECO-${String(11 + i * 3).padStart(2, '0')}`, corredor: nombres[i % nombres.length] }));
    }
  }
  flota = flota.slice(0, N_UNIDADES);
  for (const d of flota) await alta(d);
  guardar(flota);
  console.log(`Flota de ${flota.length} unidades dada de alta en ${API}`);

  // El historial solo se siembra la primera vez (o con --forzar-historial)
  if ((bandera('--historial') && primeraVez) || bandera('--forzar-historial')) await sembrarHistorial(flota);

  const unidades = flota.map(d => new Unidad(d));
  let ultimoAtaque = Date.now() - (ATAQUE_CADA_S - 20) * 1000; // primer ataque a los ~20 s
  console.log(bandera('--sin-ataques') ? 'Ataques desactivados.' : `Un ataque simulado cada ${ATAQUE_CADA_S} s. Ctrl+C para salir.`);

  setInterval(async () => {
    if (!bandera('--sin-ataques') && Date.now() - ultimoAtaque > ATAQUE_CADA_S * 1000 && !unidades.some(u => u.ataque)) {
      const u = unidades[Math.floor(Math.random() * unidades.length)];
      u.ataque = { t0: Date.now(), linea: [] };
      ultimoAtaque = Date.now();
      console.log(`» Ataque con inhibidor sobre ${u.d.unidad} (${u.d.corredor})`);
    }
    for (const u of unidades) { try { await ciclo(u); } catch (e) { console.warn(u.d.unidad, e.message); } }
    guardar(flota);
  }, PERIODO_S * 1000);
}

main();
