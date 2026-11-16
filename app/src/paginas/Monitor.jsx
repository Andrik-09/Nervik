// Pantalla principal: responde una sola pregunta — ¿alguna unidad está siendo atacada ahora?
import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFlota } from '../flota.jsx';
import Mapa from '../componentes/Mapa.jsx';
import { ESTADOS, enAlerta, hace, coord } from '../formato.js';

export default function Monitor() {
  const { unidades, zonas } = useFlota();
  const [verZonas, setVerZonas] = useState(true);
  const navegar = useNavigate();
  const irA = useCallback(u => navegar(`/unidad/${u.id}`), [navegar]);

  const ordenadas = [...unidades].sort((a, b) => (ESTADOS[a.estado]?.orden ?? 9) - (ESTADOS[b.estado]?.orden ?? 9) || a.unidad.localeCompare(b.unidad));
  const atacadas = ordenadas.filter(enAlerta);
  const protegidas = unidades.filter(u => u.estado === 'normal').length;

  return (
    <>
      {atacadas.length ? (
        <section className="franja franja-alerta" role="alert">
          <h1>{atacadas.length === 1 ? 'Posible ataque en curso' : `${atacadas.length} unidades con posible ataque`}</h1>
          {atacadas.map(u => (
            <div key={u.id} className="franja-fila">
              <div>
                <b>{u.unidad}</b> · {u.corredor}{u.ultima?.simulacro && <span className="etiqueta-sim">SIMULACRO</span>}<br />
                {u.estado === 'muda'
                  ? <>Sin señal {hace(u.segundos)} con motor encendido. Última posición válida: {coord(u.ultima?.lat, u.ultima?.lon)}</>
                  : <>El equipo reporta <b>{u.nivel_texto}</b> ({hace(u.segundos)}). GNSS {u.ultima?.sats ?? 0} satélites, C/N0 {u.ultima?.cn0 ?? '—'} dB-Hz</>}
              </div>
              <Link className="btn btn-inv" to={`/unidad/${u.id}`}>Ver unidad</Link>
            </div>
          ))}
        </section>
      ) : (
        <section className="franja">
          <h1>Sin ataques en curso</h1>
          <p>{protegidas} de {unidades.length} unidades reportando con normalidad.</p>
        </section>
      )}

      <div className="monitor">
        <div>
          <div className="barra-mapa">
            <label className="check"><input type="checkbox" checked={verZonas} onChange={e => setVerZonas(e.target.checked)} /> Zonas de riesgo ({zonas.length})</label>
          </div>
          <Mapa unidades={unidades} zonas={verZonas ? zonas : []} alto={460} onSeleccion={irA} />
        </div>
        <ul className="lista-unidades" aria-label="Unidades">
          {ordenadas.map(u => (
            <li key={u.id} className={enAlerta(u) ? 'tarjeta tarjeta-alerta' : 'tarjeta'}>
              <Link to={`/unidad/${u.id}`}>
                <div className="tarjeta-cab"><b>{u.unidad}</b><span>{ESTADOS[u.estado]?.texto}</span></div>
                <div className="tarjeta-det">
                  {u.corredor}<br />
                  {u.ultima ? <>{Math.round(u.ultima.vel ?? 0)} km/h · GNSS {u.ultima.sats ?? 0} sat · red {u.ultima.rssi ?? '—'} dBm · {hace(u.segundos)}</> : 'Sin reportes'}
                </div>
              </Link>
            </li>
          ))}
          {!unidades.length && <li className="tarjeta">Aún no hay unidades. <Link to="/instalar">Instalar un dispositivo</Link></li>}
        </ul>
      </div>
    </>
  );
}
