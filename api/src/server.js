// API de Nervik — v0.1 (MVP de desarrollo)
import './entorno.js';
import express from 'express';
import cors from 'cors';
import { db } from './db.js';
import { verificarSobre, validarLlavePublica, leerCodigoAlta } from './cripto.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { zonasDeRiesgo } from './riesgo.js';

const PUERTO = Number(process.env.PORT || 3000);
const LLAVE_CENTRAL = process.env.CENTRAL_API_KEY || 'dev-central';
// Segundos sin reporte (con motor encendido) para marcar una unidad como "muda".
const UMBRAL_MUDA_S = Number(process.env.UMBRAL_MUDA_S || 45);
const NIVELES = ['Normal', 'Anomalía', 'Sospecha', 'Evento confirmado'];
// Precios acordados en la semana 7 (MXN, sin IVA). Un solo lugar para la web, el carrito y los pedidos.
const CATALOGO = {
  dispositivo: { nombre: 'Dispositivo Nervik', descripcion: 'Equipo instalado en la unidad, con cable para conector de 9 pines y batería de respaldo de 72 horas', precio: Number(process.env.PRECIO_DISPOSITIVO || 1800), cobro: 'unico' },
  plan: { nombre: 'Plan mensual Nervik', descripcion: 'App de monitoreo, conectividad celular, expedientes firmados, pruebas remotas y reporte para tu aseguradora', precio: Number(process.env.PRECIO_PLAN || 300), cobro: 'mensual' },
  iva: 0.16,
  moneda: 'MXN',
};
const redondeo = x => Math.round(x * 100) / 100;

if (LLAVE_CENTRAL === 'dev-central') {
  console.warn('[aviso] CENTRAL_API_KEY no definida; usando la llave de desarrollo "dev-central".');
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false }));
// La app y la web pueden estar en otro dominio (p. ej. GitHub Pages) y hablar con esta API: se permite CORS.
// La protección de la central es la llave (x-api-key), no el origen.
app.use('/api', cors());

// ---------- utilidades ----------
const q = {
  disp: db.prepare('SELECT * FROM dispositivos WHERE id = ?'),
  dispTodos: db.prepare('SELECT * FROM dispositivos ORDER BY unidad'),
  ultimaTel: db.prepare('SELECT * FROM telemetria WHERE dispositivo_id = ? ORDER BY id DESC LIMIT 1'),
  telRecientes: db.prepare('SELECT * FROM telemetria WHERE dispositivo_id = ? ORDER BY id DESC LIMIT ?'),
  insTel: db.prepare(`INSERT INTO telemetria (dispositivo_id, ts, lat, lon, vel, nivel, cn0, sats, rssi, motor, bateria, alimentacion, simulacro, fix, bus, firmware)
                      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`),
  insEv: db.prepare(`INSERT INTO eventos (id, dispositivo_id, inicio, fin, nivel_max, lat, lon, payload_b64, firma, hash, hash_prev, cadena_integra, simulacro)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`),
  actContador: db.prepare('UPDATE dispositivos SET ultimo_contador = ? WHERE id = ?'),
  actHash: db.prepare('UPDATE dispositivos SET ultimo_hash = ? WHERE id = ?'),
  eventos: db.prepare(`SELECT e.id, e.dispositivo_id, d.unidad, d.corredor, e.inicio, e.fin, e.nivel_max, e.lat, e.lon, e.hash, e.cadena_integra, e.simulacro, e.recibido
                       FROM eventos e JOIN dispositivos d ON d.id = e.dispositivo_id ORDER BY e.inicio DESC LIMIT ?`),
  eventosDisp: db.prepare(`SELECT e.id, e.dispositivo_id, d.unidad, d.corredor, e.inicio, e.fin, e.nivel_max, e.lat, e.lon, e.hash, e.cadena_integra, e.simulacro, e.recibido
                           FROM eventos e JOIN dispositivos d ON d.id = e.dispositivo_id WHERE e.dispositivo_id = ? ORDER BY e.inicio DESC LIMIT ?`),
  evento: db.prepare('SELECT e.*, d.unidad, d.corredor, d.llave_publica FROM eventos e JOIN dispositivos d ON d.id = e.dispositivo_id WHERE e.id = ?'),
  eventosRiesgo: db.prepare('SELECT inicio, nivel_max, lat, lon FROM eventos WHERE simulacro = 0'),
  ultimoEvDisp: db.prepare('SELECT e.*, d.llave_publica FROM eventos e JOIN dispositivos d ON d.id = e.dispositivo_id WHERE e.dispositivo_id = ? ORDER BY e.recibido DESC LIMIT 1'),
  telTodo: db.prepare('SELECT * FROM telemetria WHERE dispositivo_id = ? ORDER BY id'),
  insProspecto: db.prepare('INSERT INTO prospectos (nombre, empresa, unidades, corredor, telefono, correo, tipo, origen) VALUES (?,?,?,?,?,?,?,?)'),
  prospectos: db.prepare('SELECT * FROM prospectos ORDER BY id DESC LIMIT 500'),
  insPedido: db.prepare(`INSERT INTO pedidos (nombre, empresa, rfc, correo, telefono, estado_mx, direccion, corredor, unidades, metodo_pago, subtotal_hoy, iva_hoy, total_hoy, mensual, notas)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`),
  pedidos: db.prepare('SELECT * FROM pedidos ORDER BY id DESC LIMIT 500'),
  insComando: db.prepare('INSERT INTO comandos (dispositivo_id, tipo) VALUES (?, ?)'),
  pendientes: db.prepare("SELECT id, tipo FROM comandos WHERE dispositivo_id = ? AND estado = 'pendiente' ORDER BY id"),
  entregar: db.prepare("UPDATE comandos SET estado = 'entregado', entregado = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"),
  completar: db.prepare("UPDATE comandos SET estado = 'completado', completado = strftime('%Y-%m-%dT%H:%M:%fZ','now'), resultado = ? WHERE id = ? AND dispositivo_id = ?"),
  insComandoHecho: db.prepare("INSERT INTO comandos (dispositivo_id, tipo, estado, resultado, entregado, completado) VALUES (?, 'diagnostico', 'completado', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))"),
  comandosDisp: db.prepare('SELECT * FROM comandos WHERE dispositivo_id = ? ORDER BY id DESC LIMIT 20'),
  comando: db.prepare('SELECT * FROM comandos WHERE id = ?'),
};

function soloCentral(req, res, next) {
  const llave = req.get('x-api-key') || req.query.key;
  if (llave !== LLAVE_CENTRAL) return res.status(401).json({ error: 'Llave de la central inválida' });
  next();
}

function texto(v, max = 120) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function numero(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// Estado que ve la central para cada unidad.
//  normal | alerta (el equipo reporta N1–N3) | muda (dejó de reportar con motor encendido: posible jammer)
//  estacionada (motor apagado) | sin_datos
function estadoDe(disp, ahora = Date.now()) {
  const t = q.ultimaTel.get(disp.id);
  if (!t) return { estado: 'sin_datos', nivel: 0, ultima: null, segundos_sin_reporte: null };
  const seg = Math.round((ahora - Date.parse(t.recibido)) / 1000);
  let estado = 'normal';
  if (seg > UMBRAL_MUDA_S) estado = t.motor ? 'muda' : 'estacionada';
  else if (t.nivel >= 1) estado = 'alerta';
  return { estado, nivel: t.nivel, ultima: t, segundos_sin_reporte: seg };
}

function resumenUnidad(d) {
  const e = estadoDe(d);
  return {
    id: d.id,
    unidad: d.unidad,
    corredor: d.corredor,
    estado: e.estado,
    nivel: e.nivel,
    nivel_texto: NIVELES[e.nivel] || '—',
    segundos_sin_reporte: e.segundos_sin_reporte,
    ultima: e.ultima && {
      ts: e.ultima.ts, recibido: e.ultima.recibido, lat: e.ultima.lat, lon: e.ultima.lon, vel: e.ultima.vel,
      cn0: e.ultima.cn0, sats: e.ultima.sats, rssi: e.ultima.rssi, motor: e.ultima.motor,
      bateria: e.ultima.bateria, alimentacion: e.ultima.alimentacion,
      simulacro: !!e.ultima.simulacro, fix: e.ultima.fix, bus: e.ultima.bus, firmware: e.ultima.firmware,
    },
  };
}

// Órdenes pendientes para el equipo: viajan en la respuesta a cualquier mensaje que mande,
// así funciona aunque el equipo esté detrás de una red celular sin IP pública.
function entregarComandos(dispId) {
  const lista = q.pendientes.all(dispId);
  for (const c of lista) q.entregar.run(c.id);
  if (lista.length) emitir('comando', { dispositivo_id: dispId, ids: lista.map(c => c.id), estado: 'entregado' });
  return lista;
}

function comandoPublico(c) {
  return c && { id: c.id, tipo: c.tipo, estado: c.estado, creado: c.creado, entregado: c.entregado, completado: c.completado, resultado: c.resultado ? JSON.parse(c.resultado) : null };
}

// ---------- tiempo real (Server-Sent Events) ----------
const clientes = new Set();
function emitir(tipo, datos) {
  const msg = `event: ${tipo}\ndata: ${JSON.stringify(datos)}\n\n`;
  for (const res of clientes) res.write(msg);
}

app.get('/api/v1/stream', soloCentral, (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`event: hola\ndata: {"umbral_muda_s":${UMBRAL_MUDA_S}}\n\n`);
  clientes.add(res);
  req.on('close', () => clientes.delete(res));
});
setInterval(() => { for (const res of clientes) res.write(': latido\n\n'); }, 25_000).unref();

// Vigilante de silencio: avisa cuando una unidad cambia de estado aunque no llegue ningún mensaje
// (es justo lo que pasa cuando un jammer corta la red).
const ultimoEstado = new Map();
setInterval(() => {
  for (const d of q.dispTodos.all()) {
    const r = resumenUnidad(d);
    if (ultimoEstado.get(d.id) !== r.estado) {
      ultimoEstado.set(d.id, r.estado);
      emitir('unidad', r);
    }
  }
}, 3_000).unref();

// ---------- rutas públicas ----------
app.get('/api/v1/salud', (_req, res) => res.json({ ok: true, version: '0.1.0', hora: new Date().toISOString() }));

// Formulario de la página web (abierto a CORS)
app.options('/api/v1/prospectos', cors());
app.post('/api/v1/prospectos', cors(), (req, res) => {
  const b = req.body || {};
  if (texto(b.sitio_web)) return res.status(201).json({ ok: true }); // campo trampa anti-bots
  const nombre = texto(b.nombre), empresa = texto(b.empresa), telefonoDado = texto(b.telefono, 30), telefono = telefonoDado || '—';
  if (!nombre || !empresa || (!telefonoDado && !texto(b.correo))) return res.status(400).json({ error: 'Faltan nombre, empresa y un teléfono o correo' });
  const tipo = ['flota', 'aseguradora', 'broker'].includes(b.tipo) ? b.tipo : 'flota';
  const r = q.insProspecto.run(nombre, empresa, texto(b.unidades, 30), texto(b.corredor), telefono, texto(b.correo), tipo, texto(b.origen, 60) || 'web');
  const extra = { motivo: texto(b.motivo, 40) || null, mensaje: texto(b.mensaje, 1500) || null };
  db.prepare('UPDATE prospectos SET motivo = ?, mensaje = ? WHERE id = ?').run(extra.motivo, extra.mensaje, r.lastInsertRowid);
  emitir('prospecto', { id: Number(r.lastInsertRowid), nombre, empresa, tipo });
  res.status(201).json({ ok: true, id: Number(r.lastInsertRowid) });
});

// ---------- rutas del dispositivo (autenticadas por firma) ----------
app.post('/api/v1/dispositivo/mensajes', (req, res) => {
  const sobre = req.body;
  const disp = typeof sobre?.dispositivo === 'string' ? q.disp.get(sobre.dispositivo) : null;
  if (!disp) return res.status(404).json({ error: 'Dispositivo no dado de alta' });

  const v = verificarSobre(sobre, disp.llave_publica);
  if (!v.ok) return res.status(401).json({ error: v.motivo });
  const d = v.datos;
  if (d.dispositivo !== disp.id) return res.status(401).json({ error: 'El payload pertenece a otro dispositivo' });
  if (!Number.isInteger(d.contador) || d.contador <= disp.ultimo_contador) {
    return res.status(409).json({ error: 'Contador repetido o fuera de orden (posible reenvío)', ultimo_contador: disp.ultimo_contador, hora: new Date().toISOString() });
  }

  if (d.tipo === 'telemetria') {
    const nivel = Number.isInteger(d.nivel) && d.nivel >= 0 && d.nivel <= 3 ? d.nivel : 0;
    q.insTel.run(disp.id, texto(d.ts, 40) || new Date().toISOString(), numero(d.lat), numero(d.lon), numero(d.vel), nivel,
      numero(d.cn0), numero(d.sats), numero(d.rssi), d.motor ? 1 : 0, numero(d.bateria), numero(d.alimentacion),
      d.simulacro ? 1 : 0, typeof d.fix === 'boolean' ? +d.fix : null, typeof d.bus === 'boolean' ? +d.bus : null, texto(d.firmware, 20) || null);
    q.actContador.run(d.contador, disp.id);
    const r = resumenUnidad(disp);
    ultimoEstado.set(disp.id, r.estado);
    emitir('unidad', r);
    return res.status(202).json({ ok: true, hora: new Date().toISOString(), comandos: entregarComandos(disp.id) });
  }

  if (d.tipo === 'evento') {
    const integra = d.hash_prev === disp.ultimo_hash ? 1 : 0;
    const id = v.hash.slice(0, 12);
    const pos = d.ultima_pos || {};
    try {
      db.exec('BEGIN');
      q.insEv.run(id, disp.id, texto(d.inicio, 40), texto(d.fin, 40) || null, Number(d.nivel_max) || 0,
        numero(pos.lat), numero(pos.lon), sobre.payload, sobre.firma, v.hash, texto(d.hash_prev, 64), integra, d.simulacro ? 1 : 0);
      q.actContador.run(d.contador, disp.id);
      q.actHash.run(v.hash, disp.id);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      return res.status(409).json({ error: 'Expediente duplicado', detalle: err.message });
    }
    emitir('evento', { id, dispositivo_id: disp.id, unidad: disp.unidad, inicio: d.inicio, nivel_max: d.nivel_max, cadena_integra: integra, simulacro: !!d.simulacro });
    return res.status(201).json({ ok: true, id, hash: v.hash, cadena_integra: !!integra, hora: new Date().toISOString(), comandos: entregarComandos(disp.id) });
  }

  if (d.tipo === 'diagnostico') {
    const resultado = JSON.stringify({
      ok: !!d.ok, ts: texto(d.ts, 40) || null, firmware: texto(d.firmware, 20) || null, simulacro: !!d.simulacro,
      pruebas: Array.isArray(d.pruebas) ? d.pruebas.slice(0, 30).map(p => ({ prueba: texto(p.prueba, 40), ok: p.ok === null ? null : !!p.ok, valor: texto(String(p.valor ?? ''), 60), detalle: texto(p.detalle || '', 160) })) : [],
      firma_valida: true,
    });
    let id = Number(d.comando_id);
    const r = id ? q.completar.run(resultado, id, disp.id) : { changes: 0 };
    if (!r.changes) id = Number(q.insComandoHecho.run(disp.id, resultado).lastInsertRowid); // diagnóstico pedido con el botón del equipo
    q.actContador.run(d.contador, disp.id);
    const c = comandoPublico(q.comando.get(id));
    emitir('diagnostico', { dispositivo_id: disp.id, unidad: disp.unidad, comando: c });
    return res.status(201).json({ ok: true, hora: new Date().toISOString(), comandos: entregarComandos(disp.id) });
  }

  res.status(400).json({ error: 'tipo desconocido' });
});

// ---------- rutas de la central ----------
app.post('/api/v1/dispositivos', soloCentral, (req, res) => {
  const b = { ...(req.body || {}) };
  if (b.codigo) {
    try { const c = leerCodigoAlta(b.codigo); b.id = c.id; b.llave_publica = c.pem; } catch (e) { return res.status(400).json({ error: e.message }); }
  }
  const id = texto(b.id, 32).toUpperCase(), unidad = texto(b.unidad, 32);
  if (!/^NVK-[0-9A-Z]{4,}$/.test(id)) return res.status(400).json({ error: 'El número de serie debe tener la forma NVK-0001' });
  if (!unidad) return res.status(400).json({ error: 'Falta el número económico de la unidad' });
  let pem;
  try { pem = validarLlavePublica(b.llave_publica); } catch (e) { return res.status(400).json({ error: e.message }); }
  try {
    db.prepare('INSERT INTO dispositivos (id, unidad, corredor, llave_publica) VALUES (?,?,?,?)').run(id, unidad, texto(b.corredor) || null, pem);
  } catch {
    return res.status(409).json({ error: 'Ese dispositivo ya está dado de alta' });
  }
  const r = resumenUnidad(q.disp.get(id));
  emitir('unidad', r);
  res.status(201).json(r);
});

app.get('/api/v1/unidades', soloCentral, (_req, res) => {
  res.json(q.dispTodos.all().map(resumenUnidad));
});

app.get('/api/v1/unidades/:id', soloCentral, (req, res) => {
  const d = q.disp.get(req.params.id);
  if (!d) return res.status(404).json({ error: 'No existe' });
  res.json({
    ...resumenUnidad(d),
    creado: d.creado,
    telemetria: q.telRecientes.all(d.id, 120).reverse(),
    eventos: q.eventosDisp.all(d.id, 50),
    comandos: q.comandosDisp.all(d.id).map(comandoPublico),
  });
});

app.get('/api/v1/eventos', soloCentral, (req, res) => {
  const lim = Math.min(Number(req.query.limite) || 100, 500);
  res.json(req.query.dispositivo ? q.eventosDisp.all(String(req.query.dispositivo), lim) : q.eventos.all(lim));
});

app.get('/api/v1/eventos/:id', soloCentral, (req, res) => {
  const e = q.evento.get(req.params.id);
  if (!e) return res.status(404).json({ error: 'No existe' });
  const v = verificarSobre({ payload: e.payload_b64, firma: e.firma }, e.llave_publica);
  res.json({
    id: e.id, dispositivo_id: e.dispositivo_id, unidad: e.unidad, corredor: e.corredor,
    inicio: e.inicio, fin: e.fin, nivel_max: e.nivel_max, recibido: e.recibido, simulacro: !!e.simulacro,
    expediente: v.ok ? v.datos : null,
    verificacion: { firma_valida: v.ok, cadena_integra: !!e.cadena_integra, hash: e.hash, hash_prev: e.hash_prev },
    // Lo necesario para que un tercero verifique por su cuenta:
    sobre: { dispositivo: e.dispositivo_id, payload: e.payload_b64, firma: e.firma },
    llave_publica: e.llave_publica,
  });
});

app.get('/api/v1/riesgo/zonas', soloCentral, (_req, res) => {
  res.json({ modelo: 'v0-frecuencia-ponderada', zonas: zonasDeRiesgo(q.eventosRiesgo.all()) });
});

app.get('/api/v1/prospectos', soloCentral, (_req, res) => res.json(q.prospectos.all()));

// ---------- pruebas remotas ----------
app.post('/api/v1/unidades/:id/comandos', soloCentral, (req, res) => {
  const d = q.disp.get(req.params.id);
  if (!d) return res.status(404).json({ error: 'No existe' });
  const tipo = req.body?.tipo;
  if (!['diagnostico', 'simulacro'].includes(tipo)) return res.status(400).json({ error: 'tipo debe ser diagnostico o simulacro' });
  const r = q.insComando.run(d.id, tipo);
  const c = comandoPublico(q.comando.get(Number(r.lastInsertRowid)));
  emitir('comando', { dispositivo_id: d.id, ids: [c.id], estado: 'pendiente' });
  res.status(201).json(c);
});
app.get('/api/v1/unidades/:id/comandos', soloCentral, (req, res) => res.json(q.comandosDisp.all(req.params.id).map(comandoPublico)));

// ---------- tienda ----------
app.get('/api/v1/catalogo', cors(), (_req, res) => res.json(CATALOGO));

function cotizar(unidades) {
  const dispositivos = unidades * CATALOGO.dispositivo.precio;
  const primerMes = unidades * CATALOGO.plan.precio;
  const subtotal = dispositivos + primerMes;
  const iva = redondeo(subtotal * CATALOGO.iva);
  return { unidades, dispositivos, primer_mes: primerMes, subtotal_hoy: subtotal, iva_hoy: iva, total_hoy: redondeo(subtotal + iva), mensual: redondeo(primerMes * (1 + CATALOGO.iva)) };
}

app.options('/api/v1/pedidos', cors());
app.post('/api/v1/pedidos', cors(), (req, res) => {
  const b = req.body || {};
  if (texto(b.sitio_web)) return res.status(201).json({ ok: true });
  const unidades = Math.floor(Number(b.unidades));
  if (!Number.isFinite(unidades) || unidades < 1 || unidades > 500) return res.status(400).json({ error: 'El número de unidades debe estar entre 1 y 500' });
  const campos = { nombre: texto(b.nombre), empresa: texto(b.empresa), correo: texto(b.correo), telefono: texto(b.telefono, 30) };
  const falta = Object.entries(campos).filter(([, v]) => !v).map(([k]) => k);
  if (falta.length) return res.status(400).json({ error: `Faltan datos: ${falta.join(', ')}` });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(campos.correo)) return res.status(400).json({ error: 'El correo no parece válido' });
  const metodo = ['tarjeta', 'transferencia', 'mercadopago'].includes(b.metodo_pago) ? b.metodo_pago : 'transferencia';
  const c = cotizar(unidades);
  const r = q.insPedido.run(campos.nombre, campos.empresa, texto(b.rfc, 13).toUpperCase() || null, campos.correo, campos.telefono,
    texto(b.estado_mx, 40) || null, texto(b.direccion, 200) || null, texto(b.corredor) || null, unidades, metodo,
    c.subtotal_hoy, c.iva_hoy, c.total_hoy, c.mensual, texto(b.notas, 500) || null);
  const id = Number(r.lastInsertRowid);
  const folio = `NVK-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`;
  db.prepare('UPDATE pedidos SET folio = ? WHERE id = ?').run(folio, id);
  emitir('pedido', { id, folio, empresa: campos.empresa, unidades });
  res.status(201).json({ ok: true, folio, metodo_pago: metodo, ...c });
});
app.get('/api/v1/pedidos', soloCentral, (_req, res) => res.json(q.pedidos.all()));
app.patch('/api/v1/pedidos/:id', soloCentral, (req, res) => {
  const estado = req.body?.estado;
  if (!['pendiente_pago', 'pagado', 'instalado', 'cancelado'].includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  const r = db.prepare('UPDATE pedidos SET estado = ? WHERE id = ?').run(estado, Number(req.params.id));
  if (!r.changes) return res.status(404).json({ error: 'No existe' });
  res.json({ ok: true });
});

// Datos crudos de una unidad para analizar falsas alarmas (requisito F-02) y entrenar el modelo TinyML
app.get('/api/v1/unidades/:id/telemetria.csv', soloCentral, (req, res) => {
  const d = q.disp.get(req.params.id);
  if (!d) return res.status(404).json({ error: 'No existe' });
  const cols = ['ts', 'recibido', 'lat', 'lon', 'vel', 'nivel', 'cn0', 'sats', 'rssi', 'motor', 'bateria', 'alimentacion', 'fix', 'bus', 'simulacro'];
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="telemetria-${d.id}.csv"` });
  res.write(cols.join(',') + '\n');
  for (const t of q.telTodo.iterate(d.id)) res.write(cols.map(c => t[c] ?? '').join(',') + '\n');
  res.end();
});

// ---------- demostración pública del prototipo (para la página web) ----------
// Solo expone el estado del dispositivo indicado en PROTOTIPO_ID (por defecto, el primero NVK-P…),
// con la posición redondeada a ~1 km para no revelar ubicaciones exactas.
const PROTOTIPO_ID = process.env.PROTOTIPO_ID || '';
const redondear = v => (v == null ? null : Math.round(v * 100) / 100);
app.get('/api/v1/demo', cors(), (_req, res) => {
  const d = PROTOTIPO_ID ? q.disp.get(PROTOTIPO_ID) : db.prepare("SELECT * FROM dispositivos WHERE id LIKE 'NVK-P%' ORDER BY creado LIMIT 1").get();
  if (!d) return res.json({ conectado: false });
  const r = resumenUnidad(d);
  const e = q.ultimoEvDisp.get(d.id);
  let expediente = null;
  if (e) {
    const v = verificarSobre({ payload: e.payload_b64, firma: e.firma }, e.llave_publica);
    const x = v.ok ? v.datos : {};
    expediente = {
      id: e.id, inicio: e.inicio, fin: e.fin, nivel_max: e.nivel_max, simulacro: !!e.simulacro,
      firma_valida: v.ok, hash: e.hash,
      linea_tiempo: (x.linea_tiempo || []).map(p => ({ ts: p.ts, tipo: p.tipo, detalle: p.detalle, vel: p.vel })),
    };
  }
  res.json({
    conectado: true,
    dispositivo: d.id, unidad: d.unidad,
    estado: r.estado, nivel: r.nivel, nivel_texto: r.nivel_texto, segundos_sin_reporte: r.segundos_sin_reporte,
    ultima: r.ultima && { ts: r.ultima.ts, recibido: r.ultima.recibido, vel: r.ultima.vel, cn0: r.ultima.cn0, sats: r.ultima.sats, rssi: r.ultima.rssi, simulacro: r.ultima.simulacro, lat: redondear(r.ultima.lat), lon: redondear(r.ultima.lon) },
    expediente,
  });
});

// ---------- archivos estáticos: página web en / y app de monitoreo en /app (compilada en web/app) ----------
const WEB = fileURLToPath(new URL('../../web', import.meta.url));
if (existsSync(WEB)) app.use('/', express.static(WEB));

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON mal formado' });
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PUERTO, () => console.log(`Nervik API escuchando en http://localhost:${PUERTO}`));
}

export default app;
