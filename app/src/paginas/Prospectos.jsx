// Prospectos que llegan desde el formulario de la página web.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fechaHora } from '../formato.js';

export default function Prospectos() {
  const [lista, setLista] = useState(null);
  useEffect(() => { api.prospectos().then(setLista).catch(() => setLista([])); }, []);
  if (!lista) return <p>Cargando…</p>;
  return (
    <>
      <h1>Prospectos de la página web</h1>
      <p>{lista.length} registros. Llegan del formulario "Apartar unidad piloto".</p>
      <ul className="lista-eventos">
        {lista.map(p => (
          <li key={p.id}><div className="fila">
            <b>{p.empresa} · {p.nombre}</b>
            <span>{p.tipo} · {p.unidades || '—'} unidades · {p.corredor || 'sin corredor'} · <a href={`tel:${p.telefono}`}>{p.telefono}</a>{p.correo ? ` · ${p.correo}` : ''} · {fechaHora(p.creado)}</span>
          </div></li>
        ))}
        {!lista.length && <li>Todavía no hay prospectos.</li>}
      </ul>
    </>
  );
}
