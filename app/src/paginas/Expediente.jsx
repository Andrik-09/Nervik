// Expediente de evento: la evidencia que se entrega a la aseguradora.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Mapa from '../componentes/Mapa.jsx';
import { verificarExpediente } from '../verificar.js';
import { NIVELES, fechaHora, hora, duracion, coord } from '../formato.js';

const TIPOS = {
  gnss_degradado: 'Degradación GNSS',
  red_perdida: 'Pérdida de red celular',
  parada_no_programada: 'Parada no programada',
  nivel_3: 'Evento confirmado',
  fin_interferencia: 'Fin de la interferencia',
};

export default function Expediente() {
  const { id } = useParams();
  const [e, setE] = useState(null);
  const [error, setError] = useState('');
  const [local, setLocal] = useState(null);

  useEffect(() => { api.evento(id).then(setE).catch(x => setError(x.message)); }, [id]);

  async function verificar() {
    setLocal({ cargando: true });
    try {
      const r = await verificarExpediente(e.sobre, e.llave_publica);
      setLocal({ ...r, coincide: r.hash === e.verificacion.hash });
    } catch (x) {
      setLocal({ error: x.message });
    }
  }

  function descargar() {
    const paquete = {
      formato: 'nervik-expediente-v1',
      instrucciones: 'Verificar ECDSA P-256 / SHA-256 de los bytes base64 de sobre.payload con llave_publica. La firma está en formato r||s (64 bytes) en base64.',
      unidad: e.unidad, dispositivo: e.dispositivo_id, sobre: e.sobre, llave_publica: e.llave_publica,
      hash: e.verificacion.hash, hash_prev: e.verificacion.hash_prev,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(paquete, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `expediente-${e.unidad}-${e.id}.json` });
    a.click(); URL.revokeObjectURL(url);
  }

  if (error) return <p className="error">{error}</p>;
  if (!e) return <p>Cargando…</p>;
  const x = e.expediente || {};
  const pos = x.ultima_pos || {};

  return (
    <article className="expediente">
      <p className="miga no-imprimir"><Link to="/expedientes">Expedientes</Link> / {e.id}</p>
      <header className="exp-cab">
        <div>
          <h1>Expediente de evento · {e.unidad}</h1>
          <p>{e.corredor} · Dispositivo {e.dispositivo_id}</p>
        </div>
        <span className="sello">{NIVELES[e.nivel_max]}</span>
      </header>

      <div className="dos-col">
        <dl className="datos">
          <dt>Inicio</dt><dd>{fechaHora(e.inicio)}</dd>
          <dt>Fin</dt><dd>{fechaHora(e.fin)}</dd>
          <dt>Duración</dt><dd>{duracion(e.inicio, e.fin)}</dd>
          <dt>Última posición válida</dt><dd>{coord(pos.lat, pos.lon)}</dd>
          <dt>Velocidad al inicio</dt><dd>{pos.vel ?? '—'} km/h</dd>
          <dt>Recibido en la central</dt><dd>{fechaHora(e.recibido)}</dd>
        </dl>
        <Mapa marca={{ lat: pos.lat, lon: pos.lon, texto: 'Última posición válida' }} alto={260} />
      </div>

      <h2>Línea de tiempo</h2>
      <ol className="linea">
        {(x.linea_tiempo || []).map((p, i) => (
          <li key={i}>
            <span className="hora">{hora(p.ts)}</span>
            <div><b>{TIPOS[p.tipo] || p.tipo}</b><br />{p.detalle}{p.lat != null && <span className="nota"> · {coord(p.lat, p.lon)}</span>}</div>
          </li>
        ))}
      </ol>

      <h2>Integridad</h2>
      <div className="integridad">
        <p><b>{e.verificacion.firma_valida ? '✓' : '✗'} Firma del dispositivo</b> {e.verificacion.firma_valida ? 'válida (verificada por la central)' : 'NO válida'}</p>
        <p><b>{e.verificacion.cadena_integra ? '✓' : '✗'} Cadena de expedientes</b> {e.verificacion.cadena_integra ? 'íntegra: enlaza con el expediente anterior de este equipo' : 'rota: falta un expediente anterior o fue alterado'}</p>
        <p className="hash">SHA-256: {e.verificacion.hash}<br />Anterior: {e.verificacion.hash_prev}</p>
        <div className="no-imprimir acciones">
          <button className="btn" onClick={verificar}>Verificar en este navegador</button>
          <button className="btn btn-sec" onClick={descargar}>Descargar para la aseguradora</button>
          <button className="btn btn-sec" onClick={() => window.print()}>Imprimir</button>
        </div>
        {local && (
          <p role="status" className="resultado">
            {local.cargando ? 'Verificando…'
              : local.error ? `No se pudo verificar: ${local.error}`
              : local.firmaValida && local.coincide ? '✓ Verificación independiente correcta: la firma ECDSA P-256 es válida y el hash coincide. El contenido no cambió desde que lo firmó el dispositivo.'
              : '✗ La verificación independiente falló: el contenido o la firma no corresponden.'}
          </p>
        )}
      </div>
    </article>
  );
}
