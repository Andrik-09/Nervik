// Estado de la flota en tiempo real: carga inicial + Server-Sent Events.
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api } from './api.js';
import { enAlerta } from './formato.js';

const Ctx = createContext(null);
export const useFlota = () => useContext(Ctx);

function sello(u) {
  // momento local equivalente al último reporte, para contar "hace X s" sin pedir al servidor
  return { ...u, _desde: u.segundos_sin_reporte == null ? null : Date.now() - u.segundos_sin_reporte * 1000 };
}

function sonar() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25].forEach(t => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.15, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.2);
      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.2);
    });
  } catch { /* sin audio */ }
}

export function FlotaProvider({ children, onNoAutorizado }) {
  const [unidades, setUnidades] = useState({});
  const [zonas, setZonas] = useState([]);
  const [conectado, setConectado] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [versionEventos, setVersionEventos] = useState(0);
  const [, setTick] = useState(0);
  const previo = useRef({});

  const avisar = useCallback((texto, fuerte) => {
    setAviso({ texto, t: Date.now() });
    if (fuerte) {
      sonar();
      try { if (Notification.permission === 'granted') new Notification('Nervik', { body: texto, tag: texto }); } catch { /* sin notificaciones */ }
    }
  }, []);

  const cargarZonas = useCallback(() => api.zonas().then(z => setZonas(z.zonas)).catch(() => {}), []);

  useEffect(() => {
    let es, vivo = true;
    api.unidades()
      .then(lista => {
        if (!vivo) return;
        const m = {};
        lista.forEach(u => { m[u.id] = sello(u); previo.current[u.id] = u.estado; });
        setUnidades(m);
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
        avisar(u.estado === 'muda' ? `${u.unidad} dejó de reportar con motor encendido` : `${u.unidad}: ${u.nivel_texto}`, true);
      }
      setUnidades(prev => ({ ...prev, [u.id]: sello(u) }));
    });
    es.addEventListener('evento', ev => {
      const e = JSON.parse(ev.data);
      avisar(`Nuevo expediente firmado de ${e.unidad}`, false);
      setVersionEventos(v => v + 1);
      cargarZonas();
    });
    const t = setInterval(() => setTick(x => x + 1), 1000);
    return () => { vivo = false; es?.close(); clearInterval(t); };
  }, [avisar, cargarZonas, onNoAutorizado]);

  const lista = Object.values(unidades).map(u => ({
    ...u,
    segundos: u._desde == null ? null : Math.max(0, Math.round((Date.now() - u._desde) / 1000)),
  }));

  return (
    <Ctx.Provider value={{ unidades: lista, zonas, conectado, aviso, cerrarAviso: () => setAviso(null), versionEventos }}>
      {children}
    </Ctx.Provider>
  );
}
