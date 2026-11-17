// Ficha de una unidad: señal en vivo, nivel de detección, recorrido, pruebas y expedientes.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, enDemo } from '../api.js';
import { useFlota } from '../flota.jsx';
import Mapa from '../componentes/Mapa.jsx';
import Senal from '../componentes/Senal.jsx';
import Diagnostico from '../componentes/Diagnostico.jsx';
import Respuesta from '../componentes/Respuesta.jsx';
import Icono from '../componentes/Iconos.jsx';
import { Medidor, Constelacion, BarrasRed, Escalera } from '../componentes/Graficas.jsx';
import { ESTADOS, NIVELES, enAlerta, hace, fechaHora, duracion } from '../formato.js';

export default function Unidad() {
  const { id } = useParams();
  const { unidades, versionEventos, avisar } = useFlota();
  const vivo = unidades.find(u => u.id === id);
  const [det, setDet] = useState(null);
  const [error, setError] = useState('');

  // recarga el historial cuando llega un reporte nuevo de esta unidad
  const marcaTiempo = vivo?.ultima?.recibido;
  useEffect(() => {
    api.unidad(id).then(setDet).catch(e => setError(e.message));
  }, [id, marcaTiempo, versionEventos]);

  async function descargarCsv() {
    const url = URL.createObjectURL(await api.csv(id));
    Object.assign(document.createElement('a'), { href: url, download: `telemetria-${id}.csv` }).click();
    URL.revokeObjectURL(url);
  }

  async function atacar() {
    try { await api.atacar(id); avisar(`Inhibidor encendido junto a ${u.unidad}.`, false, 'info'); } catch (x) { avisar(x.message, false, 'info'); }
  }

  if (error) return <p className="error">{error}</p>;
  if (!det) return <div className="cargando"><span className="latido" />Cargando unidad…</div>;
  const u = vivo || det;
  const t = u.ultima || {};
  const alerta = enAlerta(u);
  const muda = u.estado === 'muda';
  const trazo = det.telemetria.filter(x => x.lat != null).map(x => [x.lat, x.lon]);

  return (
    <>
      <Link className="volver" to="/"><Icono n="atras" tam={18} />Monitor</Link>
      <header className="pagina-cab unidad-cab">
        <div>
          <h1>{u.unidad}</h1>
          <p className="pagina-sub">{u.corredor || 'Sin corredor'} · Dispositivo {u.id}{t.firmware ? ` · firmware ${t.firmware}` : ''}</p>
        </div>
        <div className="unidad-estado">
          <span className={`pill ${alerta ? 'pill-alerta' : u.estado === 'normal' ? 'pill-ok' : ''}`}><i className={`punto-estado ${u.estado}`} />{ESTADOS[u.estado]?.texto}</span>
          <span className="nota">Último reporte {hace(u.segundos ?? u.segundos_sin_reporte)}</span>
          {enDemo() && !alerta && <button className="btn btn-sec btn-chico" onClick={atacar}><Icono n="rayo" tam={16} />Lanzar ataque aquí</button>}
        </div>
      </header>

      {alerta && <Respuesta u={u} />}

      <section className="vivo">
        <Medidor valor={muda ? 0 : t.cn0} min={0} max={50} umbral={25} unidad="dB-Hz" etiqueta="Calidad GNSS (C/N0)" alerta={muda || (t.cn0 ?? 50) < 25} />
        <Constelacion sats={muda ? 0 : t.sats} alerta={muda || (t.sats ?? 9) < 4} />
        <div className="vivo-red">
          <BarrasRed rssi={muda ? null : t.rssi} />
          <b>{muda ? 'Sin red' : `${t.rssi ?? '—'} dBm`}</b>
          <span>Red celular</span>
        </div>
        <ul className="vivo-datos">
          <li><Icono n="velocidad" tam={18} /><span>Velocidad</span><b>{Math.round(t.vel ?? 0)} km/h</b></li>
          <li><Icono n="rayo" tam={18} /><span>Motor</span><b>{t.motor ? 'Encendido' : 'Apagado'}</b></li>
          <li><Icono n="servidor" tam={18} /><span>Alimentación</span><b>{t.alimentacion ?? '—'} V</b></li>
          <li><Icono n="bateria" tam={18} /><span>Batería de respaldo</span><b>{t.bateria ?? '—'} %</b></li>
        </ul>
      </section>

      <div className="dos-col">
        <section className="tarjeta-seccion">
          <h2>Nivel de detección</h2>
          <p className="nota">Nervik sube de nivel solo cuando las señales cuentan la historia de un inhibidor, no la de un túnel.</p>
          <Escalera nivel={u.nivel ?? 0} muda={muda} />
        </section>
        <section className="tarjeta-seccion sin-relleno">
          <Mapa unidades={[u]} trazo={trazo} alto={340}
            marca={muda ? { lat: t.lat, lon: t.lon, texto: 'Última posición válida' } : null} />
        </section>
      </div>

      <section className="tarjeta-seccion">
        <div className="seccion-cab">
          <div>
            <h2>Huella de señal</h2>
            <p className="nota">Un inhibidor se reconoce porque la calidad GNSS cae en todos los satélites a la vez y, segundos después, se pierde la red celular, con la unidad en tramo abierto.</p>
          </div>
          <button className="btn btn-sec btn-chico" onClick={descargarCsv}><Icono n="descargar" tam={16} />Datos crudos (CSV)</button>
        </div>
        <div className="senales">
          <Senal datos={det.telemetria} campo="cn0" titulo="Calidad GNSS (C/N0)" unidad="dB-Hz" min={0} max={50} umbral={25} />
          <Senal datos={det.telemetria} campo="rssi" titulo="Red celular" unidad="dBm" min={-120} max={-60} />
          <Senal datos={det.telemetria} campo="vel" titulo="Velocidad" unidad="km/h" min={0} max={110} />
        </div>
      </section>

      <Diagnostico id={u.id} unidad={u.unidad} />

      <section className="tarjeta-seccion">
        <h2>Expedientes de esta unidad <span className="contador">{det.eventos.length}</span></h2>
        <ul className="lista-eventos">
          {det.eventos.map(e => (
            <li key={e.id}><Link to={`/expedientes/${e.id}`}>
              <span className={`nivel-chip n${e.nivel_max}`}>N{e.nivel_max}</span>
              <div><b>{fechaHora(e.inicio)}</b><span>{NIVELES[e.nivel_max]} · {duracion(e.inicio, e.fin)}{e.simulacro ? ' · simulacro' : ''}</span></div>
              <Icono n="flecha" tam={18} />
            </Link></li>
          ))}
          {!det.eventos.length && <li className="vacio-lista">Sin expedientes todavía.</li>}
        </ul>
      </section>
    </>
  );
}
