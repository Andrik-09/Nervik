// Mapa oscuro con Leaflet + OpenStreetMap (los mosaicos se invierten con CSS para el tema nocturno).
// Capa base propia (costa, corredores y ciudades) para que se vea aunque no carguen los mosaicos.
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { enAlerta } from '../formato.js';
import mapaBase from '../mapaBase.json';

const CENTRO_MX = [19.3, -98.4];

function icono(u, sel) {
  const clase = enAlerta(u) ? 'pin pin-alerta' : u.estado === 'normal' ? 'pin' : 'pin pin-gris';
  const radar = enAlerta(u) ? '<i class="radar"></i><i class="radar r2"></i>' : '';
  return L.divIcon({
    className: '', iconSize: [0, 0], iconAnchor: [0, 0],
    html: `<div class="${clase}${sel ? ' pin-sel' : ''}">${radar}<i class="punto"></i><span>${u.unidad}</span></div>`,
  });
}

/**
 * unidades: [{id, unidad, estado, ultima:{lat,lon}}]
 * zonas:    [{lat, lon, radio_m, relativo, eventos}]
 * trazo:    [[lat,lon], ...]   recorrido reciente
 * marca:    {lat, lon, texto}   punto destacado (p. ej. última posición válida)
 * seleccion: id de la unidad destacada (el mapa vuela hacia ella)
 */
export default function Mapa({ unidades = [], zonas = [], trazo, marca, alto = 420, onSeleccion, seleccion, ajustar = true, className = '' }) {
  const div = useRef(null);
  const mapa = useRef(null);
  const capas = useRef({});
  const ajustado = useRef(false);
  const selRef = useRef(onSeleccion);
  selRef.current = onSeleccion;

  useEffect(() => {
    const m = L.map(div.current, { zoomControl: false, attributionControl: true }).setView(CENTRO_MX, 7);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    m.createPane('base');
    m.getPane('base').style.zIndex = 150;
    L.geoJSON(mapaBase, {
      pane: 'base',
      interactive: false,
      style: f => (f.properties.tipo === 'tierra'
        ? { color: '#2e2e2e', weight: 1, fillColor: '#121212', fillOpacity: 1 }
        : { color: 'rgba(255,178,26,.5)', weight: 2.5, dashArray: '7 6' }),
      pointToLayer: (f, ll) => L.circleMarker(ll, { pane: 'base', radius: 3, color: '#000', weight: 1.5, fillColor: '#9a9a96', fillOpacity: 1 })
        .bindTooltip(f.properties.nombre, { permanent: true, direction: 'right', className: 'ciudad-base', offset: [5, 0] }),
    }).addTo(m);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(m);
    capas.current = { zonas: L.layerGroup().addTo(m), trazo: L.layerGroup().addTo(m), unidades: L.layerGroup().addTo(m), marcas: {} };
    mapa.current = m;
    // el contenedor puede cambiar de tamaño (panel lateral, giro del celular)
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(div.current);
    return () => { ro.disconnect(); m.remove(); };
  }, []);

  useEffect(() => {
    const g = capas.current.zonas; g.clearLayers();
    zonas.forEach(z => L.circleMarker([z.lat, z.lon], {
      radius: 8 + 20 * z.relativo, color: '#FFB21A', weight: 1, opacity: 0.5,
      fillColor: '#FFB21A', fillOpacity: 0.05 + 0.22 * z.relativo,
    }).bindTooltip(`${z.eventos} evento(s) · riesgo relativo ${Math.round(z.relativo * 100)}%`).addTo(g));
  }, [zonas]);

  useEffect(() => {
    const g = capas.current.trazo; g.clearLayers();
    if (trazo?.length > 1) {
      L.polyline(trazo, { color: '#FFB21A', weight: 8, opacity: 0.15 }).addTo(g);
      L.polyline(trazo, { color: '#FFB21A', weight: 2.5 }).addTo(g);
    }
    if (marca?.lat != null) {
      L.marker([marca.lat, marca.lon], {
        icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="pin pin-alerta pin-marca"><i class="radar"></i><i class="punto"></i>${marca.texto ? `<span>${marca.texto}</span>` : ''}</div>` }),
      }).addTo(g);
    }
  }, [trazo, marca]);

  useEffect(() => {
    const g = capas.current.unidades; g.clearLayers();
    const puntos = [];
    unidades.forEach(u => {
      if (u.ultima?.lat == null) return;
      puntos.push([u.ultima.lat, u.ultima.lon]);
      const mk = L.marker([u.ultima.lat, u.ultima.lon], { icon: icono(u, u.id === seleccion), zIndexOffset: u.id === seleccion ? 2000 : enAlerta(u) ? 1000 : 0, keyboard: false });
      mk.on('click', () => selRef.current?.(u));
      mk.addTo(g);
    });
    const todos = [...puntos, ...(trazo || []), ...(marca?.lat != null ? [[marca.lat, marca.lon]] : [])];
    if (ajustar && !ajustado.current && todos.length) {
      mapa.current.fitBounds(L.latLngBounds(todos).pad(0.2), { maxZoom: 12 });
      ajustado.current = true;
    }
  }, [unidades, trazo, marca, ajustar, seleccion]);

  // al elegir una unidad, el mapa vuela hacia ella
  const selPos = unidades.find(u => u.id === seleccion)?.ultima;
  useEffect(() => {
    if (seleccion && selPos?.lat != null) mapa.current.flyTo([selPos.lat, selPos.lon], Math.max(mapa.current.getZoom(), 9), { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccion]);

  return <div ref={div} className={`mapa ${className}`} style={{ height: alto }} role="region" aria-label="Mapa de la flota" />;
}
