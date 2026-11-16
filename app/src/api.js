// Cliente de la API. La llave de la central se guarda en el navegador tras iniciar sesión.
// (En el piloto se reemplaza por usuarios con Supabase Auth; ver docs/arquitectura.md.)
const BASE = import.meta.env.VITE_API_URL || '';

export function llave() {
  try { return localStorage.getItem('nervik.llave') || ''; } catch { return ''; }
}
export function guardarLlave(v) {
  try { v ? localStorage.setItem('nervik.llave', v) : localStorage.removeItem('nervik.llave'); } catch { /* sin almacenamiento */ }
}

async function pedir(ruta, opciones = {}) {
  const r = await fetch(BASE + ruta, {
    ...opciones,
    headers: { 'content-type': 'application/json', 'x-api-key': llave(), ...(opciones.headers || {}) },
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(datos.error || `Error ${r.status}`), { status: r.status });
  return datos;
}

export const api = {
  unidades: () => pedir('/api/v1/unidades'),
  unidad: id => pedir(`/api/v1/unidades/${encodeURIComponent(id)}`),
  eventos: () => pedir('/api/v1/eventos?limite=300'),
  evento: id => pedir(`/api/v1/eventos/${encodeURIComponent(id)}`),
  zonas: () => pedir('/api/v1/riesgo/zonas'),
  prospectos: () => pedir('/api/v1/prospectos'),
  alta: datos => pedir('/api/v1/dispositivos', { method: 'POST', body: JSON.stringify(datos) }),
  stream: () => new EventSource(`${BASE}/api/v1/stream?key=${encodeURIComponent(llave())}`),
};
