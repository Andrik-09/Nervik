// Modelo de zonas de riesgo v0.
// Agrupa los expedientes en celdas de ~5 km y pondera cada evento por su antigüedad
// (vida media de 30 días) y su nivel. Es una línea base honesta y explicable;
// el modelo predictivo (hora del día, tramo, tipo de carga) se entrena encima de estos datos.
const CELDA = 0.05;          // grados (~5.5 km en latitud)
const VIDA_MEDIA_DIAS = 30;

export function zonasDeRiesgo(eventos, ahora = Date.now()) {
  const celdas = new Map();
  for (const e of eventos) {
    if (e.lat == null || e.lon == null) continue;
    const i = Math.floor(e.lat / CELDA);
    const j = Math.floor(e.lon / CELDA);
    const clave = `${i}:${j}`;
    const dias = Math.max(0, (ahora - Date.parse(e.inicio)) / 86_400_000);
    const peso = Math.pow(0.5, dias / VIDA_MEDIA_DIAS) * (e.nivel_max >= 3 ? 1 : 0.5);
    const c = celdas.get(clave) || { lat: (i + 0.5) * CELDA, lon: (j + 0.5) * CELDA, eventos: 0, puntaje: 0, horas: new Array(24).fill(0) };
    c.eventos += 1;
    c.puntaje += peso;
    c.horas[new Date(e.inicio).getUTCHours()] += 1;
    celdas.set(clave, c);
  }
  const lista = [...celdas.values()].sort((a, b) => b.puntaje - a.puntaje);
  const max = lista[0]?.puntaje || 1;
  return lista.map(c => {
    // hora (UTC) con más eventos en la celda
    const horaPico = c.horas.indexOf(Math.max(...c.horas));
    return {
      lat: +c.lat.toFixed(4),
      lon: +c.lon.toFixed(4),
      radio_m: 2800,
      eventos: c.eventos,
      puntaje: +c.puntaje.toFixed(3),
      relativo: +(c.puntaje / max).toFixed(3),
      hora_pico_utc: horaPico,
    };
  });
}
