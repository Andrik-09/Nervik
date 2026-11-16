// Mapa con Leaflet + OpenStreetMap (sin costo de licencia para el MVP).
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { enAlerta } from '../formato.js';

const CENTRO_MX = [19.3, -98.4];

function icono(u) {
  const clase = enAlerta(u) ? 'pin pin-alerta' : u.estado === 'normal' ? 'pin' : 'pin pin-gris';
  return L.divIcon({ className: '', html: `<div class="${clase}">${u.unidad}</div>`, iconSize: null, iconAnchor: [28, 14] });
}

/**
 * unidades: [{id, unidad, estado, ultima:{lat,lon}}]
 * zonas:    [{lat, lon, radio_m, relativo, eventos}]
 * trazo:    [[lat,lon], ...]   recorrido reciente
 * marca:    {lat, lon, texto}   punto destacado (p. ej. última posición válida)
 */
export default function Mapa({ unidades = [], zonas = [], trazo, marca, alto = 420, onSeleccion, ajustar = true }) {
  const div = useRef(null);
  const mapa = useRef(null);
  const capas = useRef({});
  const ajustado = useRef(false);

  useEffect(() => {
    const m = L.map(div.current, { zoomControl: true, attributionControl: true }).setView(CENTRO_MX, 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '© OpenStreetMap',
    }).addTo(m);
    capas.current = { zonas: L.layerGroup().addTo(m), trazo: L.layerGroup().addTo(m), unidades: L.layerGroup().addTo(m) };
    mapa.current = m;
    return () => m.remove();
  }, []);

  useEffect(() => {
    const g = capas.current.zonas; g.clearLayers();
    // radio en píxeles para que la zona se vea a cualquier nivel de zoom
    zonas.forEach(z => L.circleMarker([z.lat, z.lon], {
      radius: 8 + 18 * z.relativo, color: '#000', weight: 1,
      fillColor: '#000', fillOpacity: 0.06 + 0.24 * z.relativo,
    }).bindTooltip(`${z.eventos} evento(s) · riesgo relativo ${Math.round(z.relativo * 100)}%`).addTo(g));
  }, [zonas]);

  useEffect(() => {
    const g = capas.current.trazo; g.clearLayers();
    if (trazo?.length > 1) L.polyline(trazo, { color: '#000', weight: 3 }).addTo(g);
    if (marca?.lat != null) {
      L.circleMarker([marca.lat, marca.lon], { radius: 9, color: '#000', weight: 3, fillColor: '#fff', fillOpacity: 1 })
        .bindTooltip(marca.texto || '', { permanent: !!marca.texto, direction: 'top' }).addTo(g);
    }
  }, [trazo, marca]);

  useEffect(() => {
    const g = capas.current.unidades; g.clearLayers();
    const puntos = [];
    unidades.forEach(u => {
      if (u.ultima?.lat == null) return;
      puntos.push([u.ultima.lat, u.ultima.lon]);
      const mk = L.marker([u.ultima.lat, u.ultima.lon], { icon: icono(u), zIndexOffset: enAlerta(u) ? 1000 : 0, keyboard: false });
      if (onSeleccion) mk.on('click', () => onSeleccion(u));
      mk.addTo(g);
    });
    const todos = [...puntos, ...(trazo || []), ...(marca?.lat != null ? [[marca.lat, marca.lon]] : [])];
    if (ajustar && !ajustado.current && todos.length) {
      mapa.current.fitBounds(L.latLngBounds(todos).pad(0.25), { maxZoom: 12 });
      ajustado.current = true;
    }
  }, [unidades, trazo, marca, onSeleccion, ajustar]);

  return <div ref={div} className="mapa" style={{ height: alto }} role="region" aria-label="Mapa de la flota" />;
}
