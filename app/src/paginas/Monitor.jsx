// Pantalla principal: responde una sola pregunta — ¿alguna unidad está siendo atacada ahora?
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useFlota } from '../flota.jsx';
import { api, enDemo } from '../api.js';
import Mapa from '../componentes/Mapa.jsx';
import Respuesta from '../componentes/Respuesta.jsx';
import Icono from '../componentes/Iconos.jsx';
import { Chispa, BarrasRed } from '../componentes/Graficas.jsx';
import { ESTADOS, enAlerta, hace } from '../formato.js';

const fmtDia = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtHora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

function Radar({ protegidas, total }) {
  return (
    <div className="radar-grande" aria-hidden="true">
      <div className="radar-barrido" />
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="56" /><circle cx="60" cy="60" r="38" /><circle cx="60" cy="60" r="20" />
        <path d="M60 4v112M4 60h112" />
      </svg>
      <div className="radar-cifra"><b>{protegidas}</b><span>de {total}</span></div>
    </div>
  );
}

export default function Monitor() {
  const { unidades, historial, zonas, versionEventos, avisar } = useFlota();
  const [verZonas, setVerZonas] = useState(true);
  const [sel, setSel] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const [buscar, setBuscar] = useState('');
  const [exp30, setExp30] = useState(null);
  const [lanzando, setLanzando] = useState(false);
  const elegir = useCallback(u => setSel(s => (s === u.id ? null : u.id)), []);

  useEffect(() => {
    api.eventos().then(l => setExp30(l.filter(e => Date.now() - Date.parse(e.inicio) < 30 * 86_400_000).length)).catch(() => {});
  }, [versionEventos]);

  const ordenadas = [...unidades].sort((a, b) => (ESTADOS[a.estado]?.orden ?? 9) - (ESTADOS[b.estado]?.orden ?? 9) || a.unidad.localeCompare(b.unidad));
  const atacadas = ordenadas.filter(enAlerta);
  const protegidas = unidades.filter(u => u.estado === 'normal').length;
  const q = buscar.trim().toLowerCase();
  const visibles = ordenadas
    .filter(u => filtro === 'todas' || (filtro === 'alerta' ? enAlerta(u) : !enAlerta(u)))
    .filter(u => !q || `${u.unidad} ${u.corredor} ${u.id}`.toLowerCase().includes(q));

  async function lanzarAtaque() {
    setLanzando(true);
    try {
      const libre = sel && !enAlerta(unidades.find(u => u.id === sel) || {}) ? sel : undefined;
      const r = await api.atacar(libre);
      avisar(`Inhibidor encendido junto a ${r.unidad}. Observa cómo responde Nervik.`, false, 'info');
      setSel(r.id);
    } catch (x) { avisar(x.message, false, 'info'); }
    setLanzando(false);
  }

  const ahora = new Date();
  return (
    <>
      <header className="pagina-cab">
        <div>
          <p className="pagina-fecha">{fmtDia.format(ahora)} · {fmtHora.format(ahora)}</p>
          <h1>Monitor de flota</h1>
        </div>
        {enDemo() && !atacadas.length && (
          <button className="btn btn-sec btn-ataque" onClick={lanzarAtaque} disabled={lanzando}>
            <Icono n="rayo" tam={18} />Lanzar ataque de prueba
          </button>
        )}
      </header>

      {atacadas.map(u => <Respuesta key={u.id} u={u} enlace />)}

      {!atacadas.length && (
        <section className="estado-ok">
          <Radar protegidas={protegidas} total={unidades.length} />
          <div>
            <h2>Sin ataques en curso</h2>
            <p>{protegidas} de {unidades.length} unidades reportan con normalidad. Si un inhibidor apaga el GPS de alguna, aquí aparece en segundos con su última posición válida.</p>
            {enDemo() && <p className="nota">Prueba: toca <b>Lanzar ataque de prueba</b> para encender un inhibidor junto a una unidad.</p>}
          </div>
        </section>
      )}

      <ul className="cifras-app">
        <li><Icono n="escudo" /><b>{protegidas}<small>/{unidades.length}</small></b><span>Unidades protegidas</span></li>
        <li className={atacadas.length ? 'alerta' : ''}><Icono n="alerta" /><b>{atacadas.length}</b><span>En alerta ahora</span></li>
        <li><Icono n="expedientes" /><b>{exp30 ?? '—'}</b><span>Expedientes en 30 días</span></li>
        <li><Icono n="capas" /><b>{zonas.length}</b><span>Zonas de riesgo</span></li>
      </ul>

      <div className="monitor">
        <div className="mapa-tarjeta">
          <Mapa unidades={unidades} zonas={verZonas ? zonas : []} alto="100%" onSeleccion={elegir} seleccion={sel} />
          <div className="mapa-controles">
            <button className={`chip${verZonas ? ' activo' : ''}`} onClick={() => setVerZonas(v => !v)} aria-pressed={verZonas}><Icono n="capas" tam={15} />Zonas de riesgo</button>
          </div>
          <div className="mapa-leyenda" aria-hidden="true">
            <span><i className="ley-ok" />Protegida</span><span><i className="ley-alerta" />Posible ataque</span><span><i className="ley-zona" />Zona de riesgo</span>
          </div>
        </div>

        <section className="lista-panel" aria-label="Unidades">
          <div className="lista-herramientas">
            <label className="buscador"><Icono n="buscar" tam={17} /><input type="search" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar unidad o corredor" /></label>
            <div className="chips" role="group" aria-label="Filtrar">
              {[['todas', `Todas ${unidades.length}`], ['alerta', `En alerta ${atacadas.length}`], ['ruta', `Sin alerta ${unidades.length - atacadas.length}`]].map(([v, t]) => (
                <button key={v} className={`chip${filtro === v ? ' activo' : ''}`} onClick={() => setFiltro(v)} aria-pressed={filtro === v}>{t}</button>
              ))}
            </div>
          </div>
          <ul className="lista-unidades">
            {visibles.map(u => {
              const h = historial[u.id] || [];
              const abierta = sel === u.id;
              return (
                <li key={u.id} className={`tarjeta${enAlerta(u) ? ' tarjeta-alerta' : ''}${abierta ? ' tarjeta-sel' : ''}`}>
                  <button className="tarjeta-boton" onClick={() => elegir(u)} aria-expanded={abierta}>
                    <div className="tarjeta-cab">
                      <span className="tarjeta-nombre"><i className={`punto-estado ${u.estado}`} />{u.unidad}</span>
                      <span className="tarjeta-estado">{ESTADOS[u.estado]?.texto}</span>
                    </div>
                    <div className="tarjeta-fila">
                      <span className="tarjeta-corredor">{u.corredor}</span>
                      <Chispa valores={h.map(p => p.cn0)} min={0} max={50} alerta={enAlerta(u)} ancho={84} alto={26} />
                    </div>
                    <div className="tarjeta-metricas">
                      <span><Icono n="velocidad" tam={15} />{Math.round(u.ultima?.vel ?? 0)} km/h</span>
                      <span><Icono n="satelite" tam={15} />{u.ultima?.sats ?? 0}</span>
                      <span><BarrasRed rssi={u.estado === 'muda' ? null : u.ultima?.rssi} /></span>
                      <span className="tarjeta-hace">{hace(u.segundos)}</span>
                    </div>
                  </button>
                  {abierta && (
                    <div className="tarjeta-extra">
                      <div className="tarjeta-grafica">
                        <span>Calidad GNSS, últimos reportes</span>
                        <Chispa valores={h.map(p => p.cn0)} min={0} max={50} umbral={25} alerta={enAlerta(u)} ancho={300} alto={56} />
                      </div>
                      <Link className="btn btn-sec" to={`/unidad/${u.id}`}>Abrir unidad <Icono n="flecha" tam={16} /></Link>
                    </div>
                  )}
                </li>
              );
            })}
            {!visibles.length && unidades.length > 0 && <li className="vacio-sel">Ninguna unidad coincide con la búsqueda.</li>}
            {!unidades.length && <li className="vacio-sel">Aún no hay unidades. <Link to="/instalar">Instalar un dispositivo</Link></li>}
          </ul>
        </section>
      </div>
    </>
  );
}
