// Pruebas de toda la flota: estado del último diagnóstico de cada equipo y acceso a sus pruebas.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useFlota } from '../flota.jsx';
import Diagnostico, { resumenDiagnostico } from '../componentes/Diagnostico.jsx';
import { ESTADOS, hace } from '../formato.js';

export default function Pruebas() {
  const { unidades, versionComandos } = useFlota();
  const [ultimos, setUltimos] = useState({});
  const [sel, setSel] = useState(null);
  const [masivo, setMasivo] = useState('');
  const ordenadas = [...unidades].sort((a, b) => a.unidad.localeCompare(b.unidad));

  useEffect(() => {
    Promise.all(unidades.map(u => api.comandos(u.id).then(l => [u.id, l.find(c => c.tipo === 'diagnostico')]).catch(() => [u.id, null])))
      .then(pares => setUltimos(Object.fromEntries(pares)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidades.length, versionComandos]);

  async function diagnosticarTodos() {
    setMasivo('Enviando…');
    await Promise.all(unidades.map(u => api.pedirComando(u.id, 'diagnostico').catch(() => null)));
    setMasivo(`Diagnóstico pedido a ${unidades.length} equipos. Cada uno responde en su siguiente reporte.`);
  }

  const seleccion = sel && unidades.find(u => u.id === sel);

  return (
    <>
      <div className="diag-cab">
        <div>
          <h1>Pruebas y diagnóstico</h1>
          <p>Revisa a distancia que cada equipo funcione: receptor GNSS, red, bus del vehículo, energía, memoria, firma y luces. Las pruebas actúan solo sobre el equipo, nunca sobre el camión.</p>
        </div>
        <button className="btn" onClick={diagnosticarTodos} disabled={!unidades.length}>Diagnosticar toda la flota</button>
      </div>
      {masivo && <p className="nota" role="status">{masivo}</p>}

      <div className="dos-col pruebas-col">
        <ul className="lista-unidades" aria-label="Equipos">
          {ordenadas.map(u => {
            const d = ultimos[u.id];
            const falla = d?.resultado?.pruebas?.some(p => p.ok === false);
            return (
              <li key={u.id} className={`tarjeta${sel === u.id ? ' tarjeta-sel' : ''}`}>
                <button className="tarjeta-boton" onClick={() => setSel(u.id)} aria-pressed={sel === u.id}>
                  <div className="tarjeta-cab"><b>{u.unidad}</b><span>{falla ? '✗ Revisar' : d?.estado === 'completado' ? '✓ Correcto' : ''}</span></div>
                  <div className="tarjeta-det">Equipo {u.id}, {ESTADOS[u.estado]?.texto.toLowerCase()}, reportó {hace(u.segundos)}<br />{resumenDiagnostico(d)}</div>
                </button>
              </li>
            );
          })}
          {!unidades.length && <li className="tarjeta"><div className="tarjeta-det" style={{ padding: 12 }}>No hay equipos instalados.</div></li>}
        </ul>
        <div>
          {seleccion ? <Diagnostico key={seleccion.id} id={seleccion.id} unidad={seleccion.unidad} /> : <p className="vacio-sel">Elige un equipo de la lista para ver sus pruebas o hacer un diagnóstico.</p>}
        </div>
      </div>
    </>
  );
}
