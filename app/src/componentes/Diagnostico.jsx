// Pruebas remotas de un equipo: diagnóstico completo y prueba de alerta (simulacro).
// La orden viaja al equipo en la respuesta a su siguiente reporte; el resultado regresa firmado.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useFlota } from '../flota.jsx';
import { fechaHora } from '../formato.js';
import Icono from './Iconos.jsx';

export const PRUEBAS = {
  receptor_gnss: ['Receptor GNSS', 'satelite'],
  posicion_gnss: ['Posición GNSS', 'monitor'],
  red: ['Red celular', 'senal'],
  bus_j1939: ['Bus J1939 (solo escucha)', 'camion'],
  imu: ['Sensor de movimiento', 'velocidad'],
  alimentacion: ['Energía del vehículo', 'rayo'],
  bateria: ['Batería de respaldo', 'bateria'],
  memoria: ['Memoria y cola', 'servidor'],
  firma: ['Firma digital', 'candado'],
  reloj: ['Reloj', 'reloj'],
  luces_y_buzzer: ['Luces y buzzer', 'campana'],
  deteccion: ['Detección de inhibidor', 'escudo'],
};

export function resumenDiagnostico(c) {
  if (!c) return 'Sin diagnósticos';
  if (c.estado === 'pendiente') return 'Esperando a que el equipo reporte';
  if (c.estado === 'entregado') return 'El equipo está haciendo las pruebas';
  const p = c.resultado?.pruebas || [];
  const fallas = p.filter(x => x.ok === false).length;
  return fallas ? `${fallas} prueba${fallas > 1 ? 's' : ''} con falla` : `Todo correcto, ${p.filter(x => x.ok).length} pruebas`;
}

export default function Diagnostico({ id, unidad }) {
  const { versionComandos } = useFlota();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState('');
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => { api.comandos(id).then(setLista).catch(e => setError(e.message)); }, [id, versionComandos]);

  async function pedir(tipo) {
    setConfirmar(false); setEnviando(tipo); setError('');
    try { await api.pedirComando(id, tipo); setLista(await api.comandos(id)); } catch (e) { setError(e.message); }
    setEnviando('');
  }

  const diag = lista?.find(c => c.tipo === 'diagnostico');
  const enCurso = diag && diag.estado !== 'completado';
  const pruebas = diag?.estado === 'completado' ? diag.resultado?.pruebas || [] : [];
  const fallas = pruebas.filter(p => p.ok === false).length;

  return (
    <section className="tarjeta-seccion diagnostico">
      <div className="seccion-cab">
        <div>
          <h2>Pruebas del equipo {unidad}</h2>
          <p className="nota">{diag ? `${resumenDiagnostico(diag)}. Pedido ${fechaHora(diag.creado)}${diag.completado ? `, respondido ${fechaHora(diag.completado)}` : ''}.` : 'Aún no se ha hecho un diagnóstico de este equipo.'}</p>
        </div>
        <div className="acciones">
          <button className="btn btn-ambar" onClick={() => pedir('diagnostico')} disabled={!!enviando || enCurso}><Icono n="pruebas" tam={17} />{enCurso ? 'Diagnóstico en curso…' : 'Hacer diagnóstico'}</button>
          <button className="btn btn-sec" onClick={() => setConfirmar(true)} disabled={!!enviando}><Icono n="campana" tam={17} />Prueba de alerta</button>
        </div>
      </div>

      {confirmar && (
        <div className="confirmar" role="dialog" aria-label="Confirmar prueba de alerta">
          <Icono n="alerta" tam={22} />
          <p><b>{unidad} simulará un ataque durante unos 2 minutos.</b> Se verá en el monitor como alerta marcada «Simulacro» y el equipo dejará de transmitir un momento.</p>
          <div className="acciones">
            <button className="btn btn-ambar" onClick={() => pedir('simulacro')}>Iniciar prueba</button>
            <button className="btn btn-sec" onClick={() => setConfirmar(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      {enCurso && (
        <ul className="pruebas-rejilla escaneando" aria-label="Pruebas en curso">
          {Object.entries(PRUEBAS).map(([k, [t, ic]], i) => (
            <li key={k} style={{ animationDelay: `${i * 120}ms` }}><Icono n={ic} tam={18} /><span>{t}</span><em>esperando…</em></li>
          ))}
        </ul>
      )}

      {pruebas.length > 0 && (
        <>
          <div className={`diag-resumen${fallas ? ' falla' : ''}`}>
            <Icono n={fallas ? 'alerta' : 'escudo'} tam={24} />
            <b>{fallas ? `${fallas} prueba${fallas > 1 ? 's' : ''} por revisar` : 'Equipo en perfecto estado'}</b>
            <span>{pruebas.filter(p => p.ok).length} de {pruebas.length} correctas · resultado firmado por {id}</span>
          </div>
          <ul className="pruebas-rejilla">
            {pruebas.map((p, i) => {
              const [t, ic] = PRUEBAS[p.prueba] || [p.prueba, 'pruebas'];
              return (
                <li key={p.prueba} className={p.ok === true ? 'ok' : p.ok === false ? 'falla' : 'na'} style={{ animationDelay: `${i * 70}ms` }}>
                  <Icono n={ic} tam={18} />
                  <span>{t}{p.ok === false && p.detalle ? <small>{p.detalle}</small> : null}</span>
                  <em>{p.valor}</em>
                  <i className="estado-prueba">{p.ok === true ? <Icono n="check" tam={14} /> : p.ok === false ? <Icono n="cerrar" tam={14} /> : '–'}</i>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
