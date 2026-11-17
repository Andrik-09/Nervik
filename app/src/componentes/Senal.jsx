// Gráfica de una señal en el tiempo con área degradada y umbral (SVG puro, sin librerías).
import { useId } from 'react';

export default function Senal({ datos, campo, titulo, unidad, min, max, umbral, alto = 96 }) {
  const id = useId().replace(/:/g, '');
  const ancho = 600;
  const vals = datos.map(d => d[campo]).filter(v => v != null);
  if (vals.length < 2) return <div className="senal vacio">{titulo}: sin datos suficientes</div>;
  const lo = min ?? Math.min(...vals), hi = max ?? Math.max(...vals);
  const y = v => alto - 4 - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo || 1)) * (alto - 8);
  const x = i => (i / (datos.length - 1)) * ancho;
  const pts = datos.map((d, i) => (d[campo] == null ? null : `${x(i).toFixed(1)},${y(d[campo]).toFixed(1)}`)).filter(Boolean);
  const ultimo = vals[vals.length - 1];
  const bajo = umbral != null && ultimo < umbral;
  const color = bajo ? 'var(--ambar)' : 'var(--texto)';
  return (
    <figure className={`senal${bajo ? ' alerta' : ''}`}>
      <figcaption><span>{titulo}</span><b>{ultimo} <small>{unidad}</small></b></figcaption>
      <svg viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" role="img" aria-label={`${titulo}, último valor ${ultimo} ${unidad}`}>
        <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".3" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {[0.25, 0.5, 0.75].map(f => <line key={f} x1="0" x2={ancho} y1={alto * f} y2={alto * f} stroke="#1c1c1c" vectorEffect="non-scaling-stroke" />)}
        {umbral != null && <line x1="0" x2={ancho} y1={y(umbral)} y2={y(umbral)} className="umbral" />}
        <path d={`M0,${alto} L${pts.join(' L')} L${ancho},${alto} Z`} fill={`url(#${id})`} />
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="pie-senal"><span>{lo} {unidad}</span>{umbral != null && <span className="pie-umbral">umbral {umbral}</span>}<span>{hi} {unidad}</span></div>
    </figure>
  );
}
