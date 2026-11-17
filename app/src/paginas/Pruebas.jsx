// Pruebas de toda la flota: salud de cada equipo y diagnóstico a distancia.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useFlota } from '../flota.jsx';
import Diagnostico, { resumenDiagnostico } from '../componentes/Diagnostico.jsx';
import Icono from '../componentes/Iconos.jsx';
import { hace } from '../formato.js';

function Anillo({ ok, total, estado }) {
  const R = 20, C = 2 * Math.PI * R, f = total ? ok / total : 0;
  return (
    <svg className={`anillo ${estado}`} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r={R} fill="none" stroke="#222" strokeWidth="5" />
      <circle cx="24" cy="24" r={R} fill="none" strokeWidth="5" strokeDasharray={`${C * f} ${C}`} transform="rotate(-90 24 24)" strokeLinecap="round" className="anillo-arco" />
      <text x="24" y="28.5" textAnchor="middle">{total ? ok : '–'}</text>
    </svg>
  );
}

export default function Pruebas() {
  const { unidades, versionComandos } = useFlota();
  const [ultimos, setUltimos] = useState({});
  const [sel, setSel] = useState(null);
  const [masivo, setMasivo] = useState(false);
  const panel = useRef(null);
  const ordenadas = [...unidades].sort((a, b) => a.unidad.localeCompare(b.unidad));

  useEffect(() => {
    Promise.all(unidades.map(u => api.comandos(u.id).then(l => [u.id, l.find(c => c.tipo === 'diagnostico')]).catch(() => [u.id, null])))
      .then(pares => setUltimos(Object.fromEntries(pares)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidades.length, versionComandos]);

  async function diagnosticarTodos() {
    setMasivo(true);
    await Promise.all(unidades.map(u => api.pedirComando(u.id, 'diagnostico').catch(() => null)));
  }

  function elegir(id) {
    setSel(id);
    if (window.matchMedia('(max-width: 980px)').matches) setTimeout(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  const diags = Object.values(ultimos).filter(Boolean);
  const completos = diags.filter(d => d.estado === 'completado');
  const conFalla = completos.filter(d => d.resultado?.pruebas?.some(p => p.ok === false)).length;
  const enCurso = diags.filter(d => d.estado !== 'completado').length;
  const seleccion = sel && unidades.find(u => u.id === sel);

  return (
    <>
      <header className="pagina-cab">
        <div>
          <h1>Pruebas y diagnóstico</h1>
          <p className="pagina-sub">Revisa a distancia el receptor GNSS, la red, el bus del vehículo, la energía, la memoria, la firma y las luces. Las pruebas actúan solo sobre el equipo, nunca sobre el camión.</p>
        </div>
        <button className="btn btn-ambar" onClick={diagnosticarTodos} disabled={!unidades.length || enCurso > 0}><Icono n="pruebas" tam={17} />{enCurso ? `Diagnosticando… ${unidades.length - enCurso}/${unidades.length}` : 'Diagnosticar toda la flota'}</button>
      </header>

      <ul className="cifras-app tres">
        <li><Icono n="escudo" /><b>{completos.length - conFalla}<small>/{unidades.length}</small></b><span>Equipos sin fallas</span></li>
        <li className={conFalla ? 'alerta' : ''}><Icono n="alerta" /><b>{conFalla}</b><span>Equipos por revisar</span></li>
        <li><Icono n="reloj" /><b>{unidades.length - completos.length}</b><span>Sin diagnóstico reciente</span></li>
      </ul>
      {masivo && enCurso > 0 && <div className="progreso-flota"><i style={{ width: `${((unidades.length - enCurso) / unidades.length) * 100}%` }} /></div>}

      <div className="pruebas-col">
        <ul className="equipos" aria-label="Equipos">
          {ordenadas.map(u => {
            const d = ultimos[u.id];
            const p = d?.resultado?.pruebas || [];
            const falla = p.some(x => x.ok === false);
            const estado = !d ? 'sin' : d.estado !== 'completado' ? 'curso' : falla ? 'falla' : 'ok';
            return (
              <li key={u.id}>
                <button className={`equipo${sel === u.id ? ' sel' : ''}`} onClick={() => elegir(u.id)} aria-pressed={sel === u.id}>
                  <Anillo ok={p.filter(x => x.ok).length} total={p.length} estado={estado} />
                  <span className="equipo-texto"><b>{u.unidad}</b><small>{u.id} · reportó {hace(u.segundos)}</small><em className={estado}>{resumenDiagnostico(d)}</em></span>
                  <Icono n="flecha" tam={18} />
                </button>
              </li>
            );
          })}
          {!unidades.length && <li className="vacio-sel">No hay equipos instalados.</li>}
        </ul>
        <div ref={panel}>
          {seleccion
            ? <Diagnostico key={seleccion.id} id={seleccion.id} unidad={seleccion.unidad} />
            : <div className="vacio-sel grande"><Icono n="pruebas" tam={34} /><p>Elige un equipo para ver sus 12 pruebas o pedir un diagnóstico a distancia.</p></div>}
        </div>
      </div>
    </>
  );
}
