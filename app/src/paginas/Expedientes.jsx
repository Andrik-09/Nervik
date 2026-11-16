import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useFlota } from '../flota.jsx';
import { NIVELES, fechaHora, duracion, coord } from '../formato.js';

export default function Expedientes() {
  const { versionEventos } = useFlota();
  const [lista, setLista] = useState(null);
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => { api.eventos().then(setLista).catch(() => setLista([])); }, [versionEventos]);
  if (!lista) return <p>Cargando…</p>;

  const vis = lista.filter(e => filtro === 'todos' || (filtro === 'n3' ? e.nivel_max >= 3 : e.nivel_max < 3));
  const n3 = lista.filter(e => e.nivel_max >= 3).length;

  return (
    <>
      <h1>Expedientes firmados</h1>
      <p>{lista.length} expedientes · {n3} con evento confirmado (N3). Cada uno lleva la firma del dispositivo y el hash del anterior; cualquier cambio rompe la verificación.</p>
      <div className="filtros" role="group" aria-label="Filtrar">
        {[['todos', 'Todos'], ['n3', 'Solo N3'], ['n2', 'N1–N2']].map(([v, t]) => (
          <button key={v} className={filtro === v ? 'btn' : 'btn btn-sec'} onClick={() => setFiltro(v)} aria-pressed={filtro === v}>{t}</button>
        ))}
      </div>
      <ul className="lista-eventos">
        {vis.map(e => (
          <li key={e.id}><Link to={`/expedientes/${e.id}`}>
            <b>{e.unidad} · {fechaHora(e.inicio)}</b>
            <span>{NIVELES[e.nivel_max]} · {duracion(e.inicio, e.fin)} · {e.corredor} · {coord(e.lat, e.lon)}{e.cadena_integra ? '' : ' · ⚠ cadena rota'}</span>
          </Link></li>
        ))}
      </ul>
    </>
  );
}
