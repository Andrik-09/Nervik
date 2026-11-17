// Expedientes firmados: patrones de ataque (hora y corredor) que filtran la lista al tocarlos.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useFlota } from '../flota.jsx';
import Icono from '../componentes/Iconos.jsx';
import { NIVELES, fechaHora, duracion } from '../formato.js';

const horaLocal = iso => new Date(iso).getHours();

export default function Expedientes() {
  const { versionEventos } = useFlota();
  const [lista, setLista] = useState(null);
  const [nivel, setNivel] = useState('todos');
  const [hora, setHora] = useState(null);
  const [corredor, setCorredor] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => { api.eventos().then(setLista).catch(() => setLista([])); }, [versionEventos]);
  if (!lista) return <div className="cargando"><span className="latido" />Cargando expedientes…</div>;

  const reales = lista.filter(e => !e.simulacro);
  const porHora = Array.from({ length: 24 }, (_, h) => reales.filter(e => horaLocal(e.inicio) === h).length);
  const maxHora = Math.max(1, ...porHora);
  const pico = porHora.indexOf(Math.max(...porHora));
  const corredores = Object.entries(reales.reduce((m, e) => ({ ...m, [e.corredor]: (m[e.corredor] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const maxCorr = Math.max(1, ...corredores.map(c => c[1]));
  const n3 = lista.filter(e => e.nivel_max >= 3).length;

  const texto = q.trim().toLowerCase();
  const vis = lista
    .filter(e => nivel === 'todos' || (nivel === 'n3' ? e.nivel_max >= 3 : e.nivel_max < 3))
    .filter(e => hora == null || horaLocal(e.inicio) === hora)
    .filter(e => !corredor || e.corredor === corredor)
    .filter(e => !texto || `${e.unidad} ${e.corredor} ${e.id}`.toLowerCase().includes(texto));
  const hayFiltro = hora != null || corredor || nivel !== 'todos' || texto;

  return (
    <>
      <header className="pagina-cab">
        <div>
          <h1>Expedientes firmados</h1>
          <p className="pagina-sub">Cada expediente lleva la firma del equipo y el hash del anterior: cualquier cambio rompe la verificación.</p>
        </div>
      </header>

      <ul className="cifras-app tres">
        <li><Icono n="expedientes" /><b>{lista.length}</b><span>Expedientes</span></li>
        <li className={n3 ? 'alerta' : ''}><Icono n="alerta" /><b>{n3}</b><span>Eventos confirmados (N3)</span></li>
        <li><Icono n="reloj" /><b>{reales.length ? `${String(pico).padStart(2, '0')}:00` : '—'}</b><span>Hora con más ataques</span></li>
      </ul>

      <div className="patrones">
        <section className="tarjeta-seccion">
          <div className="seccion-cab"><h2>¿A qué hora atacan?</h2>{hora != null && <button className="chip activo" onClick={() => setHora(null)}>{String(hora).padStart(2, '0')}:00 <Icono n="cerrar" tam={14} /></button>}</div>
          <div className="horas" role="group" aria-label="Expedientes por hora del día">
            {porHora.map((n, h) => (
              <button key={h} className={`hora-barra${hora === h ? ' activa' : ''}${h === pico && n ? ' pico' : ''}`} onClick={() => setHora(hora === h ? null : h)} title={`${String(h).padStart(2, '0')}:00 · ${n} expediente(s)`} aria-label={`${h} horas, ${n} expedientes`}>
                <i style={{ height: `${Math.max(4, (n / maxHora) * 100)}%` }} />
              </button>
            ))}
          </div>
          <div className="horas-eje"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>24 h</span></div>
        </section>
        <section className="tarjeta-seccion">
          <div className="seccion-cab"><h2>Por corredor</h2>{corredor && <button className="chip activo" onClick={() => setCorredor(null)}>Quitar filtro <Icono n="cerrar" tam={14} /></button>}</div>
          <ul className="corredores">
            {corredores.map(([c, n]) => (
              <li key={c}>
                <button className={corredor === c ? 'activo' : ''} onClick={() => setCorredor(corredor === c ? null : c)}>
                  <span>{c}</span><b>{n}</b>
                  <i style={{ width: `${(n / maxCorr) * 100}%` }} />
                </button>
              </li>
            ))}
            {!corredores.length && <li className="nota">Sin expedientes todavía.</li>}
          </ul>
        </section>
      </div>

      <section className="tarjeta-seccion">
        <div className="lista-herramientas fila">
          <label className="buscador"><Icono n="buscar" tam={17} /><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar unidad, corredor o folio" /></label>
          <div className="chips" role="group" aria-label="Filtrar por nivel">
            {[['todos', 'Todos'], ['n3', 'Confirmados N3'], ['n2', 'N1–N2']].map(([v, t]) => (
              <button key={v} className={`chip${nivel === v ? ' activo' : ''}`} onClick={() => setNivel(v)} aria-pressed={nivel === v}>{t}</button>
            ))}
          </div>
        </div>
        <p className="nota lista-conteo">{vis.length} de {lista.length} expedientes{hayFiltro ? ' con los filtros elegidos' : ''}</p>
        <ul className="lista-eventos">
          {vis.map(e => (
            <li key={e.id}><Link to={`/expedientes/${e.id}`}>
              <span className={`nivel-chip n${e.nivel_max}`}>N{e.nivel_max}</span>
              <div>
                <b>{e.unidad} · {fechaHora(e.inicio)}</b>
                <span>{NIVELES[e.nivel_max]} · {duracion(e.inicio, e.fin)} · {e.corredor}{e.simulacro ? ' · simulacro' : ''}</span>
              </div>
              <span className={`sello-mini${e.cadena_integra ? '' : ' roto'}`}><Icono n="candado" tam={14} />{e.cadena_integra ? 'Firmado' : 'Cadena rota'}</span>
              <Icono n="flecha" tam={18} />
            </Link></li>
          ))}
          {!vis.length && <li className="vacio-lista">No hay expedientes con estos filtros.</li>}
        </ul>
      </section>
    </>
  );
}
