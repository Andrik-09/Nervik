// Gráfica compacta de una señal en el tiempo (SVG puro, sin librerías).
export default function Senal({ datos, campo, titulo, unidad, min, max, umbral, alto = 80 }) {
  const ancho = 600;
  const vals = datos.map(d => d[campo]).filter(v => v != null);
  if (vals.length < 2) return <div className="senal vacio">{titulo}: sin datos suficientes</div>;
  const lo = min ?? Math.min(...vals), hi = max ?? Math.max(...vals);
  const y = v => alto - 6 - ((v - lo) / (hi - lo || 1)) * (alto - 12);
  const x = i => (i / (datos.length - 1)) * ancho;
  const puntos = datos.map((d, i) => (d[campo] == null ? null : `${x(i).toFixed(1)},${y(d[campo]).toFixed(1)}`)).filter(Boolean).join(' ');
  const ultimo = vals[vals.length - 1];
  return (
    <figure className="senal">
      <figcaption><span>{titulo}</span><b>{ultimo} {unidad}</b></figcaption>
      <svg viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" role="img" aria-label={`${titulo}, último valor ${ultimo} ${unidad}`}>
        {umbral != null && <line x1="0" x2={ancho} y1={y(umbral)} y2={y(umbral)} className="umbral" />}
        <polyline points={puntos} fill="none" stroke="#000" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      {umbral != null && <div className="pie-senal">Línea punteada: umbral de anomalía ({umbral} {unidad})</div>}
    </figure>
  );
}
