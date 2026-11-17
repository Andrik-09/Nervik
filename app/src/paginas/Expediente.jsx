// Expediente de evento: la evidencia que se entrega a la aseguradora.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Mapa from '../componentes/Mapa.jsx';
import Icono from '../componentes/Iconos.jsx';
import { verificarExpediente } from '../verificar.js';
import { NIVELES, fechaHora, hora, duracion, coord } from '../formato.js';

const TIPOS = {
  gnss_degradado: 'Degradación GNSS',
  red_perdida: 'Pérdida de red celular',
  parada_no_programada: 'Parada no programada',
  nivel_3: 'Evento confirmado',
  fin_interferencia: 'Fin de la interferencia',
};
const PASOS_VERIF = ['Leer el expediente y la firma del equipo', 'Calcular la huella SHA-256 del contenido', 'Comprobar la firma ECDSA P-256 con la llave pública', 'Comparar con la huella registrada en la cadena'];
const espera = ms => new Promise(r => setTimeout(r, ms));

// Cambia un solo carácter del contenido firmado, para demostrar que la verificación lo detecta
function alterar(sobre) {
  const txt = atob(sobre.payload);
  const i = txt.search(/\d/);
  const cambiado = txt.slice(0, i) + (txt[i] === '9' ? '8' : String(+txt[i] + 1)) + txt.slice(i + 1);
  return { ...sobre, payload: btoa(cambiado) };
}

export default function Expediente() {
  const { id } = useParams();
  const [e, setE] = useState(null);
  const [error, setError] = useState('');
  const [verif, setVerif] = useState(null); // { paso, resultado, alterado }

  useEffect(() => { api.evento(id).then(setE).catch(x => setError(x.message)); }, [id]);

  async function verificar(alterado = false) {
    setVerif({ paso: 0, alterado });
    try {
      const r = await verificarExpediente(alterado ? alterar(e.sobre) : e.sobre, e.llave_publica);
      for (let p = 1; p <= PASOS_VERIF.length; p++) { await espera(420); setVerif({ paso: p, alterado }); }
      setVerif({ paso: PASOS_VERIF.length, alterado, ok: r.firmaValida && r.hash === e.verificacion.hash, hash: r.hash });
    } catch (x) {
      setVerif({ paso: 0, alterado, error: x.message });
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
  if (!e) return <div className="cargando"><span className="latido" />Cargando expediente…</div>;
  const x = e.expediente || {};
  const pos = x.ultima_pos || {};
  const terminado = verif && verif.ok !== undefined;

  return (
    <article className="expediente">
      <Link className="volver no-imprimir" to="/expedientes"><Icono n="atras" tam={18} />Expedientes</Link>
      <header className="pagina-cab exp-cab">
        <div>
          <p className="pagina-fecha">Folio {e.id}</p>
          <h1>Expediente de evento · {e.unidad}</h1>
          <p className="pagina-sub">{e.corredor} · Dispositivo {e.dispositivo_id}</p>
        </div>
        <div className="sellos">
          {e.simulacro && <span className="pill">Simulacro, prueba sin inhibidor</span>}
          <span className={`nivel-chip grande n${e.nivel_max}`}>{NIVELES[e.nivel_max]}</span>
        </div>
      </header>

      <ul className="cifras-app">
        <li><Icono n="reloj" /><b>{hora(e.inicio)}</b><span>Inicio · {fechaHora(e.inicio).split(' · ')[0]}</span></li>
        <li><Icono n="reloj" /><b>{duracion(e.inicio, e.fin)}</b><span>Duración del ataque</span></li>
        <li><Icono n="velocidad" /><b>{pos.vel ?? '—'}<small> km/h</small></b><span>Velocidad al inicio</span></li>
        <li><Icono n="servidor" /><b>{hora(e.recibido)}</b><span>Recibido en la central</span></li>
      </ul>

      <div className="dos-col">
        <section className="tarjeta-seccion">
          <h2>Línea de tiempo</h2>
          <ol className="linea">
            {(x.linea_tiempo || []).map((p, i) => (
              <li key={i} className={p.tipo === 'nivel_3' ? 'clave' : p.tipo === 'fin_interferencia' ? 'fin' : ''}>
                <span className="hora">{hora(p.ts)}</span>
                <div><b>{TIPOS[p.tipo] || p.tipo}</b><p>{p.detalle}</p>{p.lat != null && <small>{coord(p.lat, p.lon)}</small>}</div>
              </li>
            ))}
          </ol>
        </section>
        <section className="tarjeta-seccion sin-relleno exp-mapa">
          <Mapa marca={{ lat: pos.lat, lon: pos.lon, texto: 'Última posición válida' }} alto={300} />
          <p className="exp-coord">Última posición válida <b>{coord(pos.lat, pos.lon)}</b></p>
        </section>
      </div>

      <section className={`tarjeta-seccion integridad${terminado ? (verif.ok ? ' valida' : ' invalida') : ''}`}>
        <div className="seccion-cab">
          <div>
            <h2>Integridad</h2>
            <p className="nota">Cualquiera puede comprobar este expediente sin confiar en Nervik: basta la llave pública del equipo.</p>
          </div>
          <div className="sello-grande">
            <Icono n={e.verificacion.firma_valida && e.verificacion.cadena_integra ? 'escudo' : 'alerta'} tam={26} />
            <span><b>{e.verificacion.firma_valida ? 'Firma válida' : 'Firma no válida'}</b><small>{e.verificacion.cadena_integra ? 'Cadena íntegra' : 'Cadena rota'}</small></span>
          </div>
        </div>

        <ol className="verif-pasos" aria-live="polite">
          {PASOS_VERIF.map((t, i) => {
            const hecho = verif && verif.paso > i;
            const fallo = terminado && !verif.ok && i >= 2;
            return <li key={t} className={fallo ? 'falla' : hecho ? 'hecho' : verif && verif.paso === i && !terminado ? 'activo' : ''}><i>{fallo ? <Icono n="cerrar" tam={14} /> : hecho ? <Icono n="check" tam={14} /> : i + 1}</i>{t}</li>;
          })}
        </ol>
        {terminado && (
          <p role="status" className={`resultado ${verif.ok ? 'ok' : 'falla'}`}>
            {verif.ok
              ? 'Verificación independiente correcta: el contenido no cambió desde que lo firmó el equipo.'
              : verif.alterado
                ? 'Se cambió un solo carácter del expediente y la firma ya no corresponde. Así detecta la aseguradora cualquier alteración.'
                : 'La verificación falló: el contenido o la firma no corresponden.'}
          </p>
        )}
        {verif?.error && <p className="error">No se pudo verificar: {verif.error}</p>}
        <p className="hash">SHA-256 {e.verificacion.hash}<br />Anterior {e.verificacion.hash_prev}</p>
        <div className="no-imprimir acciones">
          <button className="btn btn-ambar" onClick={() => verificar(false)}><Icono n="escudo" tam={17} />Verificar firma</button>
          <button className="btn btn-sec" onClick={() => verificar(true)}>Probar con un dato alterado</button>
          <button className="btn btn-sec" onClick={descargar}><Icono n="descargar" tam={17} />Paquete para la aseguradora</button>
          <button className="btn btn-sec" onClick={() => window.print()}><Icono n="imprimir" tam={17} />Imprimir</button>
        </div>
      </section>
    </article>
  );
}
