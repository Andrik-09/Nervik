// Panel de una unidad atacada: cronómetro del silencio, última posición válida y protocolo de respuesta.
import { Link } from 'react-router-dom';
import { useFlota } from '../flota.jsx';
import { coord } from '../formato.js';
import Icono from './Iconos.jsx';

const PASOS = [
  ['operador', 'Contactar al operador', 'Llamada o radio a la cabina para confirmar si está a salvo.'],
  ['autoridad', 'Avisar a la autoridad', 'Emergencias 911 o Guardia Nacional 088, con la última posición válida.'],
  ['posicion', 'Compartir la última posición', 'Envíala a tu equipo de reacción o a la custodia.'],
  ['aseguradora', 'Avisar a la aseguradora', 'El expediente firmado llega solo en cuanto vuelva la señal.'],
];

const mmss = s => (s == null ? '--:--' : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);

export default function Respuesta({ u, compacta, enlace }) {
  const { atendidas, atender, avisar } = useFlota();
  const hechos = atendidas[u.id]?.pasos || [];
  const marcar = k => atender(u.id, hechos.includes(k) ? hechos.filter(x => x !== k) : [...hechos, k]);
  const pos = u.ultima;
  const enlaceMapa = pos?.lat != null ? `https://maps.google.com/?q=${pos.lat},${pos.lon}` : '';

  async function compartir() {
    const texto = `Nervik · posible ataque con inhibidor a ${u.unidad} (${u.corredor}). Última posición válida: ${coord(pos?.lat, pos?.lon)} ${enlaceMapa}`;
    try {
      if (navigator.share) await navigator.share({ title: `Nervik · ${u.unidad}`, text: texto, url: enlaceMapa });
      else { await navigator.clipboard.writeText(texto); avisar('Última posición copiada al portapapeles', false, 'listo'); }
      if (!hechos.includes('posicion')) marcar('posicion');
    } catch { /* cancelado */ }
  }

  const progreso = hechos.length / PASOS.length;
  return (
    <section className={`respuesta${atendidas[u.id] ? ' en-atencion' : ''}${compacta ? ' compacta' : ''}`} role="alert">
      <div className="respuesta-cab">
        <div className="respuesta-titulo">
          <span className="respuesta-etiqueta"><span className="latido" />{u.ultima?.simulacro ? 'Simulacro' : atendidas[u.id] ? 'En atención' : 'Posible ataque en curso'}</span>
          <h2>{u.unidad}</h2>
          <p>{u.corredor} · {u.estado === 'muda' ? 'sin señal con motor encendido' : `el equipo reporta ${u.nivel_texto?.toLowerCase()}`}</p>
        </div>
        <div className="cronometro" aria-label="Tiempo sin señal">
          <b>{mmss(u.alerta_s ?? u.segundos)}</b>
          <span>{u.estado === 'muda' ? `desde la alerta · sin señal ${u.segundos ?? 0} s` : 'desde la primera alerta'}</span>
        </div>
      </div>

      <div className="respuesta-datos">
        <div><span>Última posición válida</span><b>{coord(pos?.lat, pos?.lon)}</b></div>
        <div><span>Velocidad al perder señal</span><b>{Math.round(pos?.vel ?? 0)} km/h</b></div>
        <div><span>Satélites</span><b>{pos?.sats ?? 0}</b></div>
      </div>

      {!compacta && (
        <>
          <div className="protocolo-cab">
            <h3>Protocolo de respuesta</h3>
            <span>{hechos.length} de {PASOS.length}</span>
          </div>
          <div className="protocolo-barra"><i style={{ width: `${progreso * 100}%` }} /></div>
          <ol className="protocolo">
            {PASOS.map(([k, t, d], i) => (
              <li key={k} className={hechos.includes(k) ? 'hecho' : ''}>
                <button className="protocolo-check" onClick={() => marcar(k)} aria-pressed={hechos.includes(k)} aria-label={`${t}: ${hechos.includes(k) ? 'hecho' : 'pendiente'}`}>
                  {hechos.includes(k) ? <Icono n="check" tam={16} /> : i + 1}
                </button>
                <div><b>{t}</b><small>{d}</small></div>
                {k === 'autoridad' && <span className="protocolo-acciones"><a className="chip" href="tel:911" onClick={() => !hechos.includes(k) && marcar(k)}><Icono n="telefono" tam={15} />911</a><a className="chip" href="tel:088" onClick={() => !hechos.includes(k) && marcar(k)}><Icono n="telefono" tam={15} />088</a></span>}
                {k === 'posicion' && <span className="protocolo-acciones"><button className="chip" onClick={compartir}><Icono n="compartir" tam={15} />Compartir</button></span>}
              </li>
            ))}
          </ol>
          {enlace && <Link className="btn btn-sec respuesta-enlace" to={`/unidad/${u.id}`}>Ver señal y recorrido de {u.unidad} <Icono n="flecha" tam={16} /></Link>}
        </>
      )}
      {compacta && <Link className="btn btn-ambar" to={`/unidad/${u.id}`}>Atender alerta <Icono n="flecha" tam={16} /></Link>}
    </section>
  );
}
