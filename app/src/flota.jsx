// Estado de la flota en tiempo real: carga inicial + Server-Sent Events.
// Además guarda un historial corto de señal por unidad (para las gráficas en vivo),
// qué alertas ya está atendiendo la central y las preferencias de sonido.
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api } from './api.js';
import { enAlerta } from './formato.js';

const Ctx = createContext(null);
export const useFlota = () => useContext(Ctx);
const HISTORIAL = 48;

function sello(u) {
  // momento local equivalente al último reporte, para contar "hace X s" sin pedir al servidor
  return { ...u, _desde: u.segundos_sin_reporte == null ? null : Date.now() - u.segundos_sin_reporte * 1000 };
}

const leerPref = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v === '1'; } catch { return d; } };

function sonar() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.22, 0.44].forEach((t, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; o.frequency.value = i === 2 ? 1175 : 880; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.18, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.18);
      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.2);
    });
    navigator.vibrate?.([200, 80, 200]);
  } catch { /* sin audio */ }
}

export function FlotaProvider({ children, onNoAutorizado }) {
  const [unidades, setUnidades] = useState({});
  const [historial, setHistorial] = useState({});
  const [zonas, setZonas] = useState([]);
  const [conectado, setConectado] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [versionEventos, setVersionEventos] = useState(0);
  const [versionComandos, setVersionComandos] = useState(0);
  const [atendidas, setAtendidas] = useState({});
  const [alertaDesde, setAlertaDesde] = useState({});
  const [sonido, setSonidoEstado] = useState(() => leerPref('nervik.sonido', true));
  const [, setTick] = useState(0);
  const previo = useRef({});
  const sonidoRef = useRef(sonido);
  sonidoRef.current = sonido;

  const setSonido = v => { setSonidoEstado(v); try { localStorage.setItem('nervik.sonido', v ? '1' : '0'); } catch { /* */ } };

  const avisar = useCallback((texto, fuerte, tipo = 'info', enlace) => {
    setAviso({ texto, tipo, enlace, t: Date.now() });
    if (fuerte) {
      if (sonidoRef.current) sonar();
      try { if (Notification.permission === 'granted') new Notification('Nervik', { body: texto, tag: texto, icon: './icono-192.png' }); } catch { /* sin notificaciones */ }
    }
  }, []);

  const cargarZonas = useCallback(() => api.zonas().then(z => setZonas(z.zonas)).catch(() => {}), []);

  const anotar = useCallback(u => {
    if (!u.ultima) return;
    setHistorial(prev => {
      const l = prev[u.id] || [];
      if (l.length && l[l.length - 1].ts === u.ultima.ts && u.estado !== 'muda') return prev;
      // mientras la unidad está muda se anota "sin señal" para que la gráfica muestre el hueco
      const p = u.estado === 'muda' ? { ts: Date.now(), cn0: 0, rssi: -120, vel: null, sats: 0, muda: true } : { ts: u.ultima.ts, cn0: u.ultima.cn0, rssi: u.ultima.rssi, vel: u.ultima.vel, sats: u.ultima.sats };
      return { ...prev, [u.id]: [...l, p].slice(-HISTORIAL) };
    });
  }, []);

  useEffect(() => {
    let es, vivo = true;
    api.unidades()
      .then(lista => {
        if (!vivo) return;
        const m = {};
        lista.forEach(u => { m[u.id] = sello(u); previo.current[u.id] = u.estado; anotar(u); });
        setAlertaDesde(Object.fromEntries(lista.filter(enAlerta).map(u => [u.id, Date.now() - (u.segundos_sin_reporte ?? 0) * 1000])));
        setUnidades(m);
        // historial inicial de cada unidad, para que las gráficas no empiecen vacías
        lista.forEach(u => api.unidad(u.id).then(d => {
          if (!vivo) return;
          const pts = d.telemetria.slice(-HISTORIAL).map(t => ({ ts: t.ts, cn0: t.cn0, rssi: t.rssi, vel: t.vel, sats: t.sats }));
          setHistorial(prev => ({ ...prev, [u.id]: pts }));
        }).catch(() => {}));
      })
      .catch(e => { if (e.status === 401) onNoAutorizado?.(); });
    cargarZonas();

    es = api.stream();
    es.addEventListener('hola', () => setConectado(true));
    es.onerror = () => setConectado(false);
    es.addEventListener('unidad', ev => {
      const u = JSON.parse(ev.data);
      const antes = previo.current[u.id];
      previo.current[u.id] = u.estado;
      if (antes && antes !== u.estado && enAlerta(u) && !['muda', 'alerta'].includes(antes)) {
        avisar(u.estado === 'muda' ? `${u.unidad} dejó de reportar con motor encendido` : `${u.unidad}: ${u.nivel_texto}`, true, 'alerta', `/unidad/${u.id}`);
      }
      if (!enAlerta(u)) {
        setAtendidas(a => (a[u.id] ? (({ [u.id]: _, ...r }) => r)(a) : a));
        setAlertaDesde(a => (a[u.id] ? (({ [u.id]: _, ...r }) => r)(a) : a));
      } else setAlertaDesde(a => (a[u.id] ? a : { ...a, [u.id]: Date.now() - (u.estado === 'muda' ? (u.segundos_sin_reporte ?? 0) * 1000 : 0) }));
      setUnidades(prev => ({ ...prev, [u.id]: sello(u) }));
      anotar(u);
    });
    es.addEventListener('evento', ev => {
      const e = JSON.parse(ev.data);
      avisar(`Nuevo expediente firmado de ${e.unidad}`, false, 'listo', `/expedientes/${e.id}`);
      setVersionEventos(v => v + 1);
      cargarZonas();
    });
    es.addEventListener('comando', () => setVersionComandos(v => v + 1));
    es.addEventListener('diagnostico', ev => {
      const d = JSON.parse(ev.data);
      const fallas = (d.comando?.resultado?.pruebas || []).filter(p => p.ok === false).length;
      avisar(`Diagnóstico de ${d.unidad}: ${fallas ? `${fallas} prueba${fallas > 1 ? 's' : ''} con falla` : 'todo correcto'}`, false, fallas ? 'alerta' : 'listo');
      setVersionComandos(v => v + 1);
    });
    const t = setInterval(() => setTick(x => x + 1), 1000);
    return () => { vivo = false; es?.close(); clearInterval(t); };
  }, [avisar, cargarZonas, onNoAutorizado, anotar]);

  const lista = Object.values(unidades).map(u => ({
    ...u,
    alerta_s: alertaDesde[u.id] ? Math.max(0, Math.round((Date.now() - alertaDesde[u.id]) / 1000)) : null,
    segundos: u._desde == null ? null : Math.max(0, Math.round((Date.now() - u._desde) / 1000)),
  }));

  const valor = {
    unidades: lista, historial, zonas, conectado, aviso, avisar, cerrarAviso: () => setAviso(null), versionEventos, versionComandos,
    atendidas, atender: (id, pasos) => setAtendidas(a => ({ ...a, [id]: { desde: a[id]?.desde || Date.now(), pasos } })),
    sonido, setSonido, probarSonido: sonar,
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
