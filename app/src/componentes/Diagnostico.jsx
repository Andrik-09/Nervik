// Pruebas remotas de un equipo: diagnóstico completo y prueba de alerta (simulacro).
// La orden viaja al equipo en la respuesta a su siguiente reporte; el resultado regresa firmado.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useFlota } from '../flota.jsx';
import { fechaHora } from '../formato.js';

export const PRUEBAS = {
  receptor_gnss: 'Receptor GNSS',
  posicion_gnss: 'Posición GNSS',
  red: 'Red celular',
  bus_j1939: 'Bus J1939 (solo escucha)',
  imu: 'Sensor de movimiento',
  alimentacion: 'Energía del vehículo',
  bateria: 'Batería de respaldo',
  memoria: 'Memoria y mensajes en cola',
  firma: 'Firma digital',
  reloj: 'Reloj',
  luces_y_buzzer: 'Luces y buzzer',
  deteccion: 'Detección de inhibidor',
};

export function resumenDiagnostico(c) {
  if (!c) return 'Sin diagnósticos';
  if (c.estado === 'pendiente') return 'Esperando a que el equipo reporte';
  if (c.estado === 'entregado') return 'El equipo está haciendo las pruebas';
  const p = c.resultado?.pruebas || [];
  const fallas = p.filter(x => x.ok === false).length;
  return fallas ? `${fallas} prueba${fallas > 1 ? 's' : ''} con falla` : `Todo correcto (${p.filter(x => x.ok).length} pruebas)`;
}

export default function Diagnostico({ id, unidad }) {
  const { versionComandos } = useFlota();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState('');

  useEffect(() => { api.comandos(id).then(setLista).catch(e => setError(e.message)); }, [id, versionComandos]);

  async function pedir(tipo) {
    if (tipo === 'simulacro' && !window.confirm(`La prueba de alerta hace que ${unidad} simule un ataque durante unos 2 minutos: se verá en el monitor como alerta marcada «SIMULACRO» y el equipo dejará de transmitir un momento. ¿Iniciarla?`)) return;
    setEnviando(tipo); setError('');
    try { await api.pedirComando(id, tipo); setLista(await api.comandos(id)); } catch (e) { setError(e.message); }
    setEnviando('');
  }

  const diag = lista?.find(c => c.tipo === 'diagnostico');
  const enCurso = diag && diag.estado !== 'completado';
  const pruebas = diag?.estado === 'completado' ? diag.resultado?.pruebas || [] : [];

  return (
    <section className="diagnostico">
      <div className="diag-cab">
        <div>
          <h2>Pruebas del equipo</h2>
          <p className="nota">{diag ? `${resumenDiagnostico(diag)}. Pedido ${fechaHora(diag.creado)}${diag.completado ? `, respondido ${fechaHora(diag.completado)}` : ''}.` : 'Aún no se ha hecho un diagnóstico de este equipo.'}</p>
        </div>
        <div className="acciones">
          <button className="btn" onClick={() => pedir('diagnostico')} disabled={!!enviando || enCurso}>{enCurso ? 'Diagnóstico en curso…' : 'Hacer diagnóstico'}</button>
          <button className="btn btn-sec" onClick={() => pedir('simulacro')} disabled={!!enviando}>Prueba de alerta</button>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {pruebas.length > 0 && (
        <ul className="pruebas">
          {pruebas.map(p => (
            <li key={p.prueba} className={p.ok === true ? 'ok' : p.ok === false ? 'falla' : 'na'}>
              <b>{p.ok === true ? '✓' : p.ok === false ? '✗' : '–'}</b>
              <span className="p-nombre">{PRUEBAS[p.prueba] || p.prueba}{p.ok === false && p.detalle ? <small>{p.detalle}</small> : null}</span>
              <span>{p.valor}</span>
            </li>
          ))}
        </ul>
      )}
      {diag?.estado === 'completado' && <p className="nota">Resultado firmado por el equipo {id}{diag.resultado?.firmware ? `, firmware ${diag.resultado.firmware}` : ''}.</p>}
    </section>
  );
}
