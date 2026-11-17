// Cliente de la API. Dos modos:
//  - servidor: habla con la API de Nervik (la misma dirección, o la que se escriba al entrar, p. ej. Render)
//  - demo: flota simulada en el navegador (ver demo.js), para usar la app sin servidor, p. ej. en GitHub Pages
// La llave de la central se guarda en el navegador tras entrar.
// (En el piloto se reemplaza por usuarios con Supabase Auth; ver docs/arquitectura.md.)
import { demo } from './demo.js';

const leer = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const escribir = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* sin almacenamiento */ } };

export const llave = () => leer('nervik.llave');
export const modo = () => leer('nervik.modo') || 'servidor';
export const servidor = () => leer('nervik.servidor') || import.meta.env.VITE_API_URL || '';
export const enDemo = () => modo() === 'demo';

export function entrar({ modo: m, llave: k = '', servidor: s = '' }) {
  escribir('nervik.modo', m);
  escribir('nervik.llave', m === 'demo' ? 'demo' : k);
  escribir('nervik.servidor', m === 'demo' ? '' : s.replace(/\/+$/, ''));
}
export function salir() { escribir('nervik.llave', ''); escribir('nervik.modo', ''); }
export const sesionActiva = () => !!llave();

async function pedir(ruta, opciones = {}) {
  let r;
  try {
    r = await fetch(servidor() + ruta, {
      ...opciones,
      headers: { 'content-type': 'application/json', 'x-api-key': llave(), ...(opciones.headers || {}) },
    });
  } catch {
    throw Object.assign(new Error(`No hay conexión con el servidor${servidor() ? ` ${servidor()}` : ''}`), { status: 0 });
  }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(datos.error || `Error ${r.status}`), { status: r.status });
  return datos;
}

// Comprueba la dirección y la llave antes de entrar
export async function probarServidor(url, k) {
  const base = url.replace(/\/+$/, '');
  let r;
  try { r = await fetch(`${base}/api/v1/unidades`, { headers: { 'x-api-key': k } }); } catch { throw new Error(`No se pudo conectar con ${base || 'el servidor'}. Revisa la dirección (debe empezar con https://).`); }
  if (r.status === 401) throw new Error('La llave de la central no es correcta.');
  if (!r.ok) throw new Error(`El servidor respondió con error ${r.status}.`);
}

const real = {
  unidades: () => pedir('/api/v1/unidades'),
  unidad: id => pedir(`/api/v1/unidades/${encodeURIComponent(id)}`),
  eventos: () => pedir('/api/v1/eventos?limite=300'),
  evento: id => pedir(`/api/v1/eventos/${encodeURIComponent(id)}`),
  zonas: () => pedir('/api/v1/riesgo/zonas'),
  comandos: id => pedir(`/api/v1/unidades/${encodeURIComponent(id)}/comandos`),
  pedirComando: (id, tipo) => pedir(`/api/v1/unidades/${encodeURIComponent(id)}/comandos`, { method: 'POST', body: JSON.stringify({ tipo }) }),
  alta: datos => pedir('/api/v1/dispositivos', { method: 'POST', body: JSON.stringify(datos) }),
  csv: async id => {
    const r = await fetch(`${servidor()}/api/v1/unidades/${encodeURIComponent(id)}/telemetria.csv`, { headers: { 'x-api-key': llave() } });
    return r.blob();
  },
  stream: () => new EventSource(`${servidor()}/api/v1/stream?key=${encodeURIComponent(llave())}`),
};

// Cada llamada decide en el momento según el modo con el que se entró
export const api = new Proxy({}, { get: (_, nombre) => (enDemo() ? demo : real)[nombre] });
