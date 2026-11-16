export const NIVELES = ['N0 Normal', 'N1 Anomalía', 'N2 Sospecha', 'N3 Evento confirmado'];

export const ESTADOS = {
  muda: { texto: 'Sin señal · posible inhibidor', orden: 0, alerta: true },
  alerta: { texto: 'Alerta del equipo', orden: 1, alerta: true },
  normal: { texto: 'Protegida', orden: 2 },
  estacionada: { texto: 'Estacionada', orden: 3 },
  sin_datos: { texto: 'Esperando primer reporte', orden: 4 },
};

export const enAlerta = u => !!ESTADOS[u.estado]?.alerta;

export function hace(seg) {
  if (seg == null) return '—';
  if (seg < 60) return `hace ${seg} s`;
  const m = Math.floor(seg / 60), s = seg % 60;
  if (m < 60) return `hace ${m} min${s ? ` ${s} s` : ''}`;
  const h = Math.floor(m / 60);
  return h < 48 ? `hace ${h} h ${m % 60} min` : `hace ${Math.floor(h / 24)} días`;
}

const fmtHora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const fmtFecha = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
export const hora = iso => (iso ? fmtHora.format(new Date(iso)) : '—');
export const fecha = iso => (iso ? fmtFecha.format(new Date(iso)) : '—');
export const fechaHora = iso => (iso ? `${fecha(iso)} · ${hora(iso)}` : '—');

export function duracion(a, b) {
  if (!a || !b) return '—';
  const s = Math.round((Date.parse(b) - Date.parse(a)) / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

export const coord = (lat, lon) => (lat == null ? '—' : `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
