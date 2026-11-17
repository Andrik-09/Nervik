// Íconos de línea propios (24×24, trazo 1.8) para que la app no dependa de librerías externas.
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const T = {
  monitor: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="M12 12 18.4 5.6" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></>,
  expedientes: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="m10 14 2 2 4-4" /></>,
  pruebas: <><path d="M3 12h4l2-5 4 10 2-5h6" /></>,
  instalar: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" /></>,
  ajustes: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  camion: <><path d="M2 6h11v10H2zM13 9h4l4 4v3h-8" /><circle cx="6" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  escudo: <><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  alerta: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></>,
  senal: <><path d="M4 20v-3M9 20v-6M14 20V10M19 20V5" /></>,
  satelite: <><path d="m13 7 4 4M5 15l4 4M9 11l4 4" /><path d="m7 9 6-6 4 4-6 6zM11 13l-6 6" /><path d="M16 21a5 5 0 0 0 5-5" /></>,
  telefono: <path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2" />,
  compartir: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" /></>,
  check: <path d="m5 12 5 5 9-10" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  flecha: <path d="M9 6l6 6-6 6" />,
  atras: <path d="M15 6l-6 6 6 6" />,
  rayo: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  candado: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  descargar: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 21h16" /></>,
  imprimir: <><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>,
  campana: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></>,
  volumen: <><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></>,
  salir: <><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  celular: <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></>,
  bateria: <><rect x="2" y="7" width="17" height="10" rx="2" /><path d="M22 11v2" /></>,
  velocidad: <><path d="M4 18a9 9 0 1 1 16 0" /><path d="m12 14 4-5" /></>,
  buscar: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 5 5" /></>,
  capas: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  web: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></>,
  servidor: <><rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="13" width="18" height="7" rx="1.5" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
};

export default function Icono({ n, tam = 22, ...resto }) {
  return <svg {...base} width={tam} height={tam} {...resto}>{T[n]}</svg>;
}
