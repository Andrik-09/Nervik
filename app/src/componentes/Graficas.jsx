// Piezas visuales pequeñas en SVG: línea de señal, medidor radial, barras de red, constelación y escalera de niveles.
import { useId } from 'react';

// Línea con área degradada. puntos: [{v, muda}]
export function Chispa({ valores, min, max, alto = 36, ancho = 120, umbral, alerta }) {
  const id = useId().replace(/:/g, '');
  const vs = valores.filter(v => v != null);
  if (vs.length < 2) return <svg className="chispa" width={ancho} height={alto} aria-hidden="true" />;
  const lo = min ?? Math.min(...vs), hi = max ?? Math.max(...vs);
  const x = i => (i / (valores.length - 1)) * ancho;
  const y = v => alto - 2 - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo || 1)) * (alto - 4);
  const pts = valores.map((v, i) => `${x(i).toFixed(1)},${y(v ?? lo).toFixed(1)}`);
  const color = alerta ? 'var(--ambar)' : 'var(--texto)';
  return (
    <svg className="chispa" width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {umbral != null && <line x1="0" x2={ancho} y1={y(umbral)} y2={y(umbral)} stroke="var(--ambar)" strokeOpacity=".55" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      <path d={`M0,${alto} L${pts.join(' L')} L${ancho},${alto} Z`} fill={`url(#${id})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={x(valores.length - 1)} cy={y(valores[valores.length - 1] ?? lo)} r="2.6" fill={color} />
    </svg>
  );
}

// Medidor radial de 240° (p. ej. C/N0 en dB-Hz)
export function Medidor({ valor, min = 0, max = 50, umbral, unidad, etiqueta, alerta }) {
  const R = 52, C = 2 * Math.PI * R, arco = C * (240 / 360);
  const f = valor == null ? 0 : Math.max(0, Math.min(1, (valor - min) / (max - min)));
  const fu = umbral == null ? null : (umbral - min) / (max - min);
  const ang = a => (150 + a * 240) * Math.PI / 180;
  return (
    <figure className={`medidor${alerta ? ' alerta' : ''}`}>
      <svg viewBox="0 0 128 112" aria-hidden="true">
        <circle cx="64" cy="64" r={R} fill="none" stroke="#222" strokeWidth="9" strokeDasharray={`${arco} ${C}`} transform="rotate(150 64 64)" strokeLinecap="round" />
        <circle className="medidor-arco" cx="64" cy="64" r={R} fill="none" strokeWidth="9" strokeDasharray={`${arco * f} ${C}`} transform="rotate(150 64 64)" strokeLinecap="round" />
        {fu != null && <line x1={64 + Math.cos(ang(fu)) * 42} y1={64 + Math.sin(ang(fu)) * 42} x2={64 + Math.cos(ang(fu)) * 61} y2={64 + Math.sin(ang(fu)) * 61} stroke="var(--ambar)" strokeWidth="2" />}
      </svg>
      <div className="medidor-valor"><b>{valor ?? '—'}</b><span>{unidad}</span></div>
      <figcaption>{etiqueta}</figcaption>
    </figure>
  );
}

// Barras de red tipo celular según dBm
export function BarrasRed({ rssi }) {
  const n = rssi == null || rssi <= -112 ? 0 : rssi > -75 ? 4 : rssi > -87 ? 3 : rssi > -100 ? 2 : 1;
  return (
    <span className={`barras-red${n === 0 ? ' sin' : ''}`} aria-label={`Red ${n} de 4`}>
      {[1, 2, 3, 4].map(i => <i key={i} className={i <= n ? 'on' : ''} style={{ height: 4 + i * 3.5 }} />)}
    </span>
  );
}

// Constelación: 14 puntos, encendidos según satélites en uso
export function Constelacion({ sats = 0, alerta }) {
  const pos = [[18, 30], [40, 16], [66, 12], [92, 18], [112, 34], [28, 56], [56, 44], [84, 46], [110, 62], [16, 82], [44, 76], [72, 72], [98, 86], [62, 96]];
  return (
    <figure className={`constelacion${alerta ? ' alerta' : ''}`}>
      <svg viewBox="0 0 128 108" aria-hidden="true">
        <ellipse cx="64" cy="56" rx="60" ry="50" fill="none" stroke="#1f1f1f" />
        <ellipse cx="64" cy="56" rx="34" ry="28" fill="none" stroke="#1f1f1f" />
        {pos.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i < sats ? 4.2 : 2.6} className={i < sats ? 'sat on' : 'sat'} style={{ animationDelay: `${i * 90}ms` }} />)}
      </svg>
      <div className="medidor-valor"><b>{sats}</b><span>satélites</span></div>
      <figcaption>Satélites en uso</figcaption>
    </figure>
  );
}

const PELDANOS = [
  ['N0', 'Normal', 'Señal sana en todos los satélites'],
  ['N1', 'Anomalía', 'La calidad GNSS cae en todos a la vez'],
  ['N2', 'Sospecha', 'Además se pierde la red celular'],
  ['N3', 'Evento confirmado', 'Parada no programada con motor encendido'],
];
// Escalera de detección N0–N3 con el nivel actual resaltado
export function Escalera({ nivel = 0, muda }) {
  const n = muda ? Math.max(nivel, 2) : nivel;
  return (
    <ol className="escalera" aria-label={`Nivel de detección ${PELDANOS[n][0]}`}>
      {PELDANOS.map(([c, t, d], i) => (
        <li key={c} className={i < n ? 'paso hecho' : i === n ? `paso actual${n > 0 ? ' alerta' : ''}` : 'paso'}>
          <b>{c}</b><div><span>{t}</span><small>{d}</small></div>
        </li>
      ))}
    </ol>
  );
}
