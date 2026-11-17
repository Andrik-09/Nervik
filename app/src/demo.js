// Modo demostración: una flota simulada que vive en el navegador, para usar la app sin servidor
// (por ejemplo, publicada en GitHub Pages). Responde igual que la API real: unidades, alertas,
// expedientes firmados con ECDSA P-256 de verdad (WebCrypto), zonas de riesgo, pruebas y alta.
// Todo se pierde al recargar la página.

const CORREDORES = {
  'México–Puebla': [[19.36, -99.06], [19.26, -98.90], [19.35, -98.67], [19.28, -98.43], [19.06, -98.25]],
  'Puebla–Veracruz': [[19.06, -98.25], [19.04, -98.04], [18.84, -97.55], [18.86, -97.37], [18.80, -97.18], [18.85, -97.10], [18.89, -96.93], [19.17, -96.14]],
  'Puebla–Oaxaca': [[19.06, -98.25], [18.75, -97.85], [18.46, -97.39], [17.95, -97.05], [17.07, -96.72]],
  'Bajío (Querétaro–León)': [[20.59, -100.39], [20.52, -100.81], [20.57, -101.19], [20.67, -101.35], [21.12, -101.68]],
};
const CALIENTES = [[18.84, -97.55, 'Puebla–Veracruz'], [18.86, -97.37, 'Puebla–Veracruz'], [19.35, -98.67, 'México–Puebla'], [20.54, -101.0, 'Bajío (Querétaro–León)'], [18.46, -97.39, 'Puebla–Oaxaca']];
const NIVELES = ['Normal', 'Anomalía', 'Sospecha', 'Evento confirmado'];
const PERIODO = 3000, UMBRAL_MUDA_S = 45, SILENCIO_S = 60, ATAQUE_CADA_S = 75, ACELERACION = 15;

// ---------- utilidades ----------
const rad = g => g * Math.PI / 180;
const km = (a, b) => { const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]); const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const largo = r => r.slice(1).reduce((s, p, i) => s + km(r[i], p), 0);
function puntoEn(r, d) {
  for (let i = 0; i < r.length - 1; i++) { const t = km(r[i], r[i + 1]); if (d <= t) { const f = d / t; return [r[i][0] + (r[i + 1][0] - r[i][0]) * f, r[i][1] + (r[i + 1][1] - r[i][1]) * f]; } d -= t; }
  return r[r.length - 1];
}
const azar = (a, b) => a + Math.random() * (b - a);
const r5 = x => Math.round(x * 1e5) / 1e5;
const ahoraIso = () => new Date().toISOString();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const pem = der => `-----BEGIN PUBLIC KEY-----\n${b64(der).match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----\n`;
const espera = ms => new Promise(r => setTimeout(r, ms));

// ---------- un equipo simulado con su propia llave ----------
class Equipo {
  static async crear(id, unidad, corredor, pos) {
    const e = new Equipo();
    e.id = id; e.unidad = unidad; e.corredor = corredor; e.creado = ahoraIso();
    e.llaves = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    e.llavePem = pem(await crypto.subtle.exportKey('spki', e.llaves.publicKey));
    e.hashPrev = '0'.repeat(64);
    e.ruta = CORREDORES[corredor];
    e.L = e.ruta ? largo(e.ruta) : 0;
    e.dist = azar(0, e.L); e.sentido = Math.random() < 0.5 ? 1 : -1;
    e.vel = e.ruta ? azar(70, 90) : 0;
    e.fijo = pos || null;   // equipo instalado en el laboratorio: no se mueve
    e.bateria = azar(85, 100);
    e.telemetria = [];
    e.ataque = null;
    return e;
  }
  pos() { return this.fijo || puntoEn(this.ruta, this.dist); }
  avanzar() {
    if (this.fijo) return;
    if (this.ataque?.parada) { this.vel = 0; return; }
    this.vel = Math.max(55, Math.min(95, this.vel + azar(-4, 4)));
    this.dist += this.sentido * this.vel * (PERIODO / 1000 * ACELERACION) / 3600;
    if (this.dist > this.L) { this.dist = this.L; this.sentido = -1; }
    if (this.dist < 0) { this.dist = 0; this.sentido = 1; }
  }
  reportar(nivel, cn0, sats, rssi) {
    const [lat, lon] = this.pos();
    const t = {
      ts: ahoraIso(), recibido: ahoraIso(), lat: r5(lat), lon: r5(lon), vel: Math.round(this.vel), nivel,
      cn0: Math.round(cn0 * 10) / 10, sats, rssi: Math.round(rssi), motor: 1, bateria: Math.round(this.bateria),
      alimentacion: Math.round(azar(26.8, 27.8) * 10) / 10, simulacro: !!this.ataque?.simulacro, fix: sats > 0, bus: true, firmware: 'demo',
    };
    this.telemetria.push(t);
    if (this.telemetria.length > 120) this.telemetria.shift();
    return t;
  }
  // Firma el expediente igual que el firmware: ECDSA P-256 sobre los bytes del payload
  async firmar(datos) {
    const bytes = new TextEncoder().encode(JSON.stringify({ dispositivo: this.id, tipo: 'evento', ...datos, hash_prev: this.hashPrev }));
    const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, this.llaves.privateKey, bytes);
    const hash = hex(await crypto.subtle.digest('SHA-256', bytes));
    const prev = this.hashPrev;
    this.hashPrev = hash;
    return { payload: b64(bytes), firma: b64(firma), hash, hash_prev: prev };
  }
}

function expedienteDe(inicio, pos, vel, lineaReal, conParada = true) {
  const t = s => new Date(inicio.getTime() + s * 1000).toISOString();
  const [lat, lon] = [r5(pos[0]), r5(pos[1])];
  const linea = lineaReal || [
    { ts: t(0), tipo: 'gnss_degradado', detalle: `C/N0 promedio cae de 41 a 17 dB-Hz en todos los satélites a la vez a ${vel} km/h (no es túnel)`, lat, lon, vel },
    { ts: t(13), tipo: 'red_perdida', detalle: 'Se pierde la red celular. Alerta en cabina encendida.', lat, lon, vel: vel - 10 },
    ...(conParada ? [
      { ts: t(154), tipo: 'parada_no_programada', detalle: 'Velocidad 0 km/h con motor encendido fuera de punto autorizado.', lat, lon, vel: 0 },
      { ts: t(154), tipo: 'nivel_3', detalle: 'Evento confirmado (N3): interferencia + pérdida de red + parada no programada.' },
    ] : []),
    { ts: t(conParada ? 1068 : 240), tipo: 'fin_interferencia', detalle: 'Regresan GNSS y red. Expediente enviado a la central.' },
  ];
  return { inicio: linea[0].ts, fin: linea[linea.length - 1].ts, nivel_max: conParada ? 3 : 2, ultima_pos: { lat, lon, vel, ts: linea[0].ts }, linea_tiempo: linea, firmware: 'demo' };
}

// ---------- motor de la demostración ----------
class Motor {
  constructor() {
    this.equipos = [];
    this.eventos = [];      // expedientes
    this.comandos = [];
    this.siguienteComando = 1;
    this.oyentes = new Set();
    this.ultimoAtaque = Date.now() - (ATAQUE_CADA_S - 20) * 1000;
    this.listo = this.iniciar();
  }

  emitir(tipo, datos) { for (const o of this.oyentes) o(tipo, datos); }

  async iniciar() {
    const nombres = Object.keys(CORREDORES);
    for (let i = 0; i < 6; i++) this.equipos.push(await Equipo.crear(`NVK-${String(i + 1).padStart(4, '0')}`, `ECO-${11 + i * 3}`, nombres[i % nombres.length]));
    // historial de 60 días para las zonas de riesgo
    const hist = [];
    for (let k = 0; k < 36; k++) {
      const [lat, lon, corredor] = CALIENTES[Math.floor(Math.random() ** 1.6 * CALIENTES.length)];
      const inicio = new Date(Date.now() - azar(1, 60) * 86_400_000);
      inicio.setUTCHours(Math.random() < 0.75 ? Math.floor(azar(6, 11)) : Math.floor(azar(0, 24)), Math.floor(azar(0, 60)));
      hist.push({ inicio, lat: lat + azar(-0.03, 0.03), lon: lon + azar(-0.03, 0.03), corredor });
    }
    hist.sort((a, b) => a.inicio - b.inicio);
    for (const h of hist) {
      const e = this.equipos.find(x => x.corredor === h.corredor) || this.equipos[0];
      await this.guardarExpediente(e, expedienteDe(h.inicio, [h.lat, h.lon], 82, null, Math.random() < 0.7), new Date(h.inicio.getTime() + 1_100_000).toISOString(), false);
    }
    for (const e of this.equipos) e.reportar(0, azar(38, 44), Math.floor(azar(9, 14)), azar(-85, -70));
    setInterval(() => this.ciclo(), PERIODO);
  }

  async guardarExpediente(e, datos, recibido = ahoraIso(), avisar = true) {
    const s = await e.firmar(datos);
    const ev = {
      id: s.hash.slice(0, 12), dispositivo_id: e.id, unidad: e.unidad, corredor: e.corredor, inicio: datos.inicio, fin: datos.fin,
      nivel_max: datos.nivel_max, lat: datos.ultima_pos.lat, lon: datos.ultima_pos.lon, hash: s.hash, hash_prev: s.hash_prev,
      cadena_integra: 1, simulacro: datos.simulacro ? 1 : 0, recibido, sobre: { dispositivo: e.id, payload: s.payload, firma: s.firma }, llave_publica: e.llavePem, datos,
    };
    this.eventos.push(ev);
    if (avisar) this.emitir('evento', { id: ev.id, dispositivo_id: e.id, unidad: e.unidad, inicio: ev.inicio, nivel_max: ev.nivel_max, cadena_integra: 1, simulacro: !!ev.simulacro });
  }

  resumen(e) {
    const t = e.telemetria[e.telemetria.length - 1];
    if (!t) return { id: e.id, unidad: e.unidad, corredor: e.corredor, estado: 'sin_datos', nivel: 0, nivel_texto: NIVELES[0], segundos_sin_reporte: null, ultima: null };
    const seg = Math.round((Date.now() - Date.parse(t.recibido)) / 1000);
    let estado = 'normal';
    if (seg > UMBRAL_MUDA_S) estado = t.motor ? 'muda' : 'estacionada';
    else if (t.nivel >= 1) estado = 'alerta';
    return { id: e.id, unidad: e.unidad, corredor: e.corredor, estado, nivel: t.nivel, nivel_texto: NIVELES[t.nivel], segundos_sin_reporte: seg, ultima: { ...t } };
  }

  async ciclo() {
    // ataque simulado cada cierto tiempo, nunca dos a la vez
    const enMovimiento = this.equipos.filter(e => !e.fijo);
    if (Date.now() - this.ultimoAtaque > ATAQUE_CADA_S * 1000 && !this.equipos.some(e => e.ataque) && enMovimiento.length) {
      const e = enMovimiento[Math.floor(Math.random() * enMovimiento.length)];
      e.ataque = { t0: Date.now(), linea: [] };
      this.ultimoAtaque = Date.now();
    }
    for (const e of this.equipos) {
      e.avanzar();
      const a = e.ataque;
      const enviar = t => this.emitir('unidad', this.resumen(e)) || t;
      if (!a) { e.reportar(0, azar(38, 44), Math.floor(azar(9, 14)), azar(-85, -70)); enviar(); }
      else {
        const s = (Date.now() - a.t0) / 1000;
        const [lat, lon] = e.pos();
        if (s < 4) {
          if (!a.n1) { a.n1 = true; a.pos = [lat, lon]; a.vel = Math.round(e.vel); a.linea.push({ ts: ahoraIso(), tipo: 'gnss_degradado', detalle: `C/N0 cae en todos los satélites a la vez a ${Math.round(e.vel)} km/h`, lat: r5(lat), lon: r5(lon), vel: Math.round(e.vel) }); }
          e.reportar(1, azar(15, 19), 3, -95); enviar();
        } else if (!a.n2) {
          a.n2 = true;
          a.linea.push({ ts: ahoraIso(), tipo: 'red_perdida', detalle: 'Se pierde la red celular. Alerta en cabina encendida.', lat: r5(lat), lon: r5(lon), vel: Math.round(e.vel) });
          e.reportar(2, 0, 0, -113); enviar();
        } else if (s < SILENCIO_S) {
          if (s > 15 && !a.parada) {
            a.parada = true;
            const t = ahoraIso();
            a.linea.push({ ts: t, tipo: 'parada_no_programada', detalle: 'Velocidad 0 km/h con motor encendido fuera de punto autorizado.', lat: r5(lat), lon: r5(lon), vel: 0 });
            a.linea.push({ ts: t, tipo: 'nivel_3', detalle: 'Evento confirmado (N3): interferencia + pérdida de red + parada no programada.' });
          }
          this.emitir('unidad', this.resumen(e));   // sin reportes: la central solo ve el silencio
        } else {
          a.linea.push({ ts: ahoraIso(), tipo: 'fin_interferencia', detalle: 'Regresan GNSS y red. Expediente enviado a la central.' });
          const exp = expedienteDe(new Date(a.t0), a.pos, a.vel, a.linea);
          if (a.simulacro) exp.simulacro = true;
          e.ataque = null; e.vel = e.fijo ? 0 : 60;
          await this.guardarExpediente(e, exp);
          e.reportar(0, azar(38, 44), Math.floor(azar(9, 14)), azar(-85, -70)); enviar();
        }
      }
      // órdenes pendientes: se entregan cuando el equipo reporta
      if (!e.ataque || !e.ataque.n2) for (const c of this.comandos.filter(c => c.dispositivo_id === e.id && c.estado === 'pendiente')) this.entregar(e, c);
    }
  }

  entregar(e, c) {
    c.estado = 'entregado'; c.entregado = ahoraIso();
    this.emitir('comando', { dispositivo_id: e.id, ids: [c.id], estado: 'entregado' });
    if (c.tipo === 'simulacro') {
      if (!e.ataque) e.ataque = { t0: Date.now(), linea: [], simulacro: true };
      c.estado = 'completado'; c.completado = ahoraIso();
      return;
    }
    setTimeout(() => {
      const t = e.telemetria[e.telemetria.length - 1] || {};
      const pruebas = [
        ['receptor_gnss', true, 'recibe tramas NMEA'],
        ['posicion_gnss', (t.sats ?? 10) >= 4, `${t.sats ?? 10} sat, C/N0 ${t.cn0 ?? 41} dB-Hz`],
        ['red', true, `LTE-M ${t.rssi ?? -75} dBm`],
        ['bus_j1939', true, 'recibe tramas (solo escucha)'],
        ['imu', true, 'LSM6DSOX responde'],
        ['alimentacion', true, `${t.alimentacion ?? 27.2} V`],
        ['bateria', (t.bateria ?? 90) >= 20, `${t.bateria ?? 90} %`],
        ['memoria', true, '24 de 1024 kB, 0 en cola'],
        ['firma', true, 'ECDSA P-256 correcta'],
        ['reloj', true, new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC'],
        ['luces_y_buzzer', true, 'destello realizado'],
        ['deteccion', true, `nivel N${t.nivel ?? 0}, base C/N0 41.0 dB-Hz`],
      ].map(([prueba, ok, valor]) => ({ prueba, ok, valor, detalle: '' }));
      c.estado = 'completado'; c.completado = ahoraIso();
      c.resultado = { ok: pruebas.every(p => p.ok), ts: ahoraIso(), firmware: 'demo', simulacro: false, pruebas, firma_valida: true };
      this.emitir('diagnostico', { dispositivo_id: e.id, unidad: e.unidad, comando: { ...c } });
    }, 1500);
  }

  equipo(id) {
    const e = this.equipos.find(x => x.id === id);
    if (!e) throw Object.assign(new Error('No existe'), { status: 404 });
    return e;
  }
}

let motor = null;
const m = async () => { motor ||= new Motor(); await motor.listo; return motor; };
const sinFirma = ({ sobre, llave_publica, datos, ...resto }) => resto;

// Zonas de riesgo: mismo modelo v0 de la API (frecuencia por celda de ~5 km, vida media de 30 días)
function zonas(eventos) {
  const C = 0.05, celdas = new Map(), ahora = Date.now();
  for (const e of eventos) {
    if (e.simulacro) continue;
    const i = Math.floor(e.lat / C), j = Math.floor(e.lon / C), k = `${i}:${j}`;
    const peso = Math.pow(0.5, Math.max(0, (ahora - Date.parse(e.inicio)) / 86_400_000) / 30) * (e.nivel_max >= 3 ? 1 : 0.5);
    const c = celdas.get(k) || { lat: (i + 0.5) * C, lon: (j + 0.5) * C, eventos: 0, puntaje: 0 };
    c.eventos++; c.puntaje += peso; celdas.set(k, c);
  }
  const l = [...celdas.values()].sort((a, b) => b.puntaje - a.puntaje), max = l[0]?.puntaje || 1;
  return l.map(c => ({ ...c, radio_m: 2800, relativo: +(c.puntaje / max).toFixed(3) }));
}

export const demo = {
  unidades: async () => (await m()).equipos.map(e => motor.resumen(e)),
  unidad: async id => {
    const M = await m(), e = M.equipo(id);
    return {
      ...M.resumen(e), creado: e.creado, telemetria: e.telemetria.map(t => ({ ...t })),
      eventos: M.eventos.filter(x => x.dispositivo_id === id).sort((a, b) => b.inicio.localeCompare(a.inicio)).map(sinFirma),
      comandos: M.comandos.filter(c => c.dispositivo_id === id).slice().reverse(),
    };
  },
  eventos: async () => (await m()).eventos.slice().sort((a, b) => b.inicio.localeCompare(a.inicio)).map(sinFirma),
  evento: async id => {
    const e = (await m()).eventos.find(x => x.id === id);
    if (!e) throw Object.assign(new Error('No existe'), { status: 404 });
    return {
      id: e.id, dispositivo_id: e.dispositivo_id, unidad: e.unidad, corredor: e.corredor, inicio: e.inicio, fin: e.fin, nivel_max: e.nivel_max,
      recibido: e.recibido, simulacro: !!e.simulacro, expediente: { dispositivo: e.dispositivo_id, tipo: 'evento', ...e.datos, hash_prev: e.hash_prev },
      verificacion: { firma_valida: true, cadena_integra: true, hash: e.hash, hash_prev: e.hash_prev }, sobre: e.sobre, llave_publica: e.llave_publica,
    };
  },
  zonas: async () => ({ modelo: 'v0-frecuencia-ponderada', zonas: zonas((await m()).eventos) }),
  comandos: async id => (await m()).comandos.filter(c => c.dispositivo_id === id).slice().reverse().map(c => ({ ...c })),
  pedirComando: async (id, tipo) => {
    const M = await m(); M.equipo(id);
    const c = { id: M.siguienteComando++, dispositivo_id: id, tipo, estado: 'pendiente', creado: ahoraIso(), entregado: null, completado: null, resultado: null };
    M.comandos.push(c);
    M.emitir('comando', { dispositivo_id: id, ids: [c.id], estado: 'pendiente' });
    return { ...c };
  },
  alta: async datos => {
    const M = await m();
    const codigo = String(datos.codigo || '');
    const id = (codigo.startsWith('NVK1:') ? codigo.split(':')[1] : datos.id || '').toUpperCase();
    if (!/^NVK-[0-9A-Z]{4,}$/.test(id)) throw Object.assign(new Error('El código de alta debe tener la forma NVK1:NVK-0001:…'), { status: 400 });
    if (!datos.unidad) throw Object.assign(new Error('Falta el número económico de la unidad'), { status: 400 });
    if (M.equipos.some(e => e.id === id)) throw Object.assign(new Error('Ese dispositivo ya está dado de alta'), { status: 409 });
    const e = await Equipo.crear(id, datos.unidad, datos.corredor || 'Laboratorio', [19.0318, -98.2399]);
    M.equipos.push(e);
    M.emitir('unidad', M.resumen(e));
    // primeros reportes del equipo recién conectado
    espera(2500).then(() => { e.reportar(0, 41.3, 9, -63); M.emitir('unidad', M.resumen(e)); });
    return M.resumen(e);
  },
  csv: async id => {
    const e = (await m()).equipo(id);
    const cols = ['ts', 'recibido', 'lat', 'lon', 'vel', 'nivel', 'cn0', 'sats', 'rssi', 'motor', 'bateria', 'alimentacion', 'fix', 'bus', 'simulacro'];
    return new Blob([[cols.join(','), ...e.telemetria.map(t => cols.map(c => (typeof t[c] === 'boolean' ? +t[c] : t[c] ?? '')).join(','))].join('\n')], { type: 'text/csv' });
  },
  stream: () => {
    const objetivo = new EventTarget();
    const oyente = (tipo, datos) => objetivo.dispatchEvent(new MessageEvent(tipo, { data: JSON.stringify(datos) }));
    m().then(M => { M.oyentes.add(oyente); oyente('hola', { umbral_muda_s: UMBRAL_MUDA_S, demo: true }); });
    objetivo.close = () => motor?.oyentes.delete(oyente);
    return objetivo;
  },
};
