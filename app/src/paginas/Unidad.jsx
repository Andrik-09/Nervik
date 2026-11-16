import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useFlota } from '../flota.jsx';
import Mapa from '../componentes/Mapa.jsx';
import Senal from '../componentes/Senal.jsx';
import { ESTADOS, NIVELES, enAlerta, hace, coord, fechaHora, duracion } from '../formato.js';

export default function Unidad() {
  const { id } = useParams();
  const { unidades, versionEventos } = useFlota();
  const vivo = unidades.find(u => u.id === id);
  const [det, setDet] = useState(null);
  const [error, setError] = useState('');

  // recarga el historial cuando llega un reporte nuevo de esta unidad
  const marcaTiempo = vivo?.ultima?.recibido;
  useEffect(() => {
    api.unidad(id).then(setDet).catch(e => setError(e.message));
  }, [id, marcaTiempo, versionEventos]);

  if (error) return <p className="error">{error}</p>;
  if (!det) return <p>Cargando…</p>;
  const u = vivo || det;
  const trazo = det.telemetria.filter(t => t.lat != null).map(t => [t.lat, t.lon]);

  return (
    <>
      <p className="miga"><Link to="/">Monitor</Link> / {u.unidad}</p>
      <section className={enAlerta(u) ? 'franja franja-alerta' : 'franja'}>
        <h1>{u.unidad} · {ESTADOS[u.estado]?.texto}</h1>
        <p>{u.corredor} · Dispositivo {u.id} · Último reporte {hace(u.segundos ?? u.segundos_sin_reporte)} · Nivel del equipo: {NIVELES[u.nivel]}</p>
      </section>

      <div className="dos-col">
        <Mapa unidades={[u]} trazo={trazo} alto={360}
          marca={u.estado === 'muda' ? { lat: u.ultima?.lat, lon: u.ultima?.lon, texto: 'Última posición válida' } : null} />
        <div className="datos">
          <dl>
            <dt>Posición</dt><dd>{coord(u.ultima?.lat, u.ultima?.lon)}</dd>
            <dt>Velocidad</dt><dd>{Math.round(u.ultima?.vel ?? 0)} km/h</dd>
            <dt>Motor</dt><dd>{u.ultima?.motor ? 'Encendido' : 'Apagado'}</dd>
            <dt>Alimentación</dt><dd>{u.ultima?.alimentacion ?? '—'} V</dd>
            <dt>Batería de respaldo</dt><dd>{u.ultima?.bateria ?? '—'} %</dd>
          </dl>
        </div>
      </div>

      <h2>Huella de señal</h2>
      <p className="nota">Un inhibidor se reconoce porque la calidad GNSS cae en todos los satélites a la vez y, segundos después, se pierde la red celular, con la unidad en tramo abierto.</p>
      <div className="senales">
        <Senal datos={det.telemetria} campo="cn0" titulo="Calidad GNSS (C/N0)" unidad="dB-Hz" min={0} max={50} umbral={25} />
        <Senal datos={det.telemetria} campo="rssi" titulo="Red celular" unidad="dBm" min={-120} max={-60} />
        <Senal datos={det.telemetria} campo="vel" titulo="Velocidad" unidad="km/h" min={0} max={110} />
      </div>

      <h2>Expedientes de esta unidad ({det.eventos.length})</h2>
      <ul className="lista-eventos">
        {det.eventos.map(e => (
          <li key={e.id}><Link to={`/expedientes/${e.id}`}>
            <b>{fechaHora(e.inicio)}</b><span>{NIVELES[e.nivel_max]} · {duracion(e.inicio, e.fin)}</span>
          </Link></li>
        ))}
        {!det.eventos.length && <li>Sin expedientes.</li>}
      </ul>
    </>
  );
}
