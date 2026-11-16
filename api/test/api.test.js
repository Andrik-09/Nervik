// Pruebas de la API: alta, firmas, anti-replay, cadena de expedientes y estado "muda".
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.NERVIK_DB = ':memory:';
process.env.CENTRAL_API_KEY = 'llave-prueba';
process.env.UMBRAL_MUDA_S = '1';

const { default: app } = await import('../src/server.js');
const { Dispositivo } = await import('../../simulador/dispositivo.js');

let srv, base;
const H = { 'content-type': 'application/json', 'x-api-key': 'llave-prueba' };
const post = (ruta, cuerpo, headers = H) => fetch(base + ruta, { method: 'POST', headers, body: JSON.stringify(cuerpo) });
const get = ruta => fetch(base + ruta, { headers: H }).then(r => r.json());

const eq = new Dispositivo({ id: 'NVK-0001', unidad: 'ECO-14', corredor: 'Puebla–Veracruz' });

before(async () => {
  srv = app.listen(0);
  await new Promise(r => srv.once('listening', r));
  base = `http://localhost:${srv.address().port}`;
});
after(() => srv.close());

test('alta de dispositivo exige llave de la central', async () => {
  const sin = await post('/api/v1/dispositivos', { id: eq.id, unidad: eq.unidad, llave_publica: eq.llavePublicaPem }, { 'content-type': 'application/json' });
  assert.equal(sin.status, 401);
  const con = await post('/api/v1/dispositivos', { id: eq.id, unidad: eq.unidad, corredor: eq.corredor, llave_publica: eq.llavePublicaPem });
  assert.equal(con.status, 201);
});

test('telemetría firmada se acepta y actualiza el estado', async () => {
  const r = await post('/api/v1/dispositivo/mensajes', eq.sobre('telemetria', { lat: 19.04, lon: -98.2, vel: 80, nivel: 0, motor: 1 }));
  assert.equal(r.status, 202);
  const u = await get('/api/v1/unidades');
  assert.equal(u[0].estado, 'normal');
});

test('firma alterada se rechaza', async () => {
  const s = eq.sobre('telemetria', { lat: 19.0, lon: -98.0, vel: 10, motor: 1 });
  const datos = JSON.parse(Buffer.from(s.payload, 'base64'));
  datos.vel = 0; // alguien intenta cambiar la velocidad
  s.payload = Buffer.from(JSON.stringify(datos)).toString('base64');
  const r = await post('/api/v1/dispositivo/mensajes', s);
  assert.equal(r.status, 401);
});

test('un mensaje reenviado (mismo contador) se rechaza', async () => {
  const s = eq.sobre('telemetria', { lat: 19.0, lon: -98.0, vel: 60, motor: 1 });
  assert.equal((await post('/api/v1/dispositivo/mensajes', s)).status, 202);
  assert.equal((await post('/api/v1/dispositivo/mensajes', s)).status, 409);
});

test('expedientes encadenados y verificables', async () => {
  const exp = { inicio: new Date().toISOString(), fin: new Date().toISOString(), nivel_max: 3, ultima_pos: { lat: 18.9, lon: -97.4 }, linea_tiempo: [] };
  const r1 = await (await post('/api/v1/dispositivo/mensajes', eq.sobre('evento', exp))).json();
  const r2 = await (await post('/api/v1/dispositivo/mensajes', eq.sobre('evento', exp))).json();
  assert.equal(r1.cadena_integra, true);
  assert.equal(r2.cadena_integra, true);
  const det = await get('/api/v1/eventos/' + r2.id);
  assert.equal(det.verificacion.firma_valida, true);
  assert.equal(det.verificacion.hash_prev, r1.hash);
  const zonas = await get('/api/v1/riesgo/zonas');
  assert.equal(zonas.zonas[0].eventos, 2);
});

test('si deja de reportar con motor encendido, la unidad queda "muda"', async () => {
  await new Promise(r => setTimeout(r, 1600));
  const u = await get('/api/v1/unidades');
  assert.equal(u[0].estado, 'muda');
});

test('formulario web guarda prospectos', async () => {
  const r = await post('/api/v1/prospectos', { nombre: 'Ana', empresa: 'Transportes X', telefono: '2220000000', unidades: '6 a 10' }, { 'content-type': 'application/json' });
  assert.equal(r.status, 201);
  const p = await get('/api/v1/prospectos');
  assert.equal(p[0].empresa, 'Transportes X');
});

test('alta con el código del firmware (NVK1:serie:llave) y demo pública', async () => {
  const p = new Dispositivo({ id: 'NVK-P001', unidad: 'PROTO-1' });
  const jwk = (await import('node:crypto')).createPublicKey(p.llavePublicaPem).export({ format: 'jwk' });
  const xy = Buffer.concat([Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64');
  const r = await post('/api/v1/dispositivos', { codigo: `NVK1:NVK-P001:${xy}`, unidad: 'PROTO-1' });
  assert.equal(r.status, 201);
  assert.equal((await post('/api/v1/dispositivo/mensajes', p.sobre('telemetria', { lat: 19.0412, lon: -98.2063, vel: 0, motor: 1, cn0: 40, sats: 9 }))).status, 202);
  const exp = { inicio: new Date().toISOString(), fin: new Date().toISOString(), nivel_max: 3, simulacro: true, ultima_pos: { lat: 19.04, lon: -98.2 }, linea_tiempo: [{ ts: new Date().toISOString(), tipo: 'gnss_degradado', detalle: 'prueba' }] };
  assert.equal((await post('/api/v1/dispositivo/mensajes', p.sobre('evento', exp))).status, 201);
  const demo = await fetch(base + '/api/v1/demo').then(x => x.json());
  assert.equal(demo.dispositivo, 'NVK-P001');
  assert.equal(demo.ultima.lat, 19.04); // redondeada
  assert.equal(demo.expediente.simulacro, true);
  assert.equal(demo.expediente.firma_valida, true);
  const zonas = await get('/api/v1/riesgo/zonas');
  assert.equal(zonas.zonas.reduce((s, z) => s + z.eventos, 0), 2); // los simulacros no cuentan como riesgo
  const csv = await fetch(base + '/api/v1/unidades/NVK-P001/telemetria.csv', { headers: H }).then(x => x.text());
  assert.match(csv, /^ts,recibido,lat/);
});
