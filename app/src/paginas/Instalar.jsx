// Flujo de instalación: alta del dispositivo y autoprueba en ~30 s.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const PRUEBAS = [
  ['energia', 'Energía del vehículo', t => t.alimentacion >= 11, t => `${t.alimentacion} V`],
  ['bateria', 'Batería de respaldo', t => t.bateria >= 20, t => `${t.bateria} %`],
  ['bus', 'Datos del bus J1939', t => t.motor != null, t => (t.motor ? 'motor encendido' : 'motor apagado')],
  ['gnss', 'Satélites GNSS', t => t.sats >= 4 && t.cn0 >= 30, t => `${t.sats} sat · ${t.cn0} dB-Hz`],
  ['red', 'Red celular', t => t.rssi > -110, t => `${t.rssi} dBm`],
];

export default function Instalar() {
  const [f, setF] = useState({ id: '', unidad: '', corredor: '', llave_publica: '' });
  const [paso, setPaso] = useState(1);
  const [error, setError] = useState('');
  const [tel, setTel] = useState(null);
  const [inicio, setInicio] = useState(null);
  const cambiar = k => ev => setF({ ...f, [k]: ev.target.value });

  async function dar(ev) {
    ev.preventDefault(); setError('');
    try { await api.alta(f); setPaso(2); setInicio(Date.now()); } catch (x) { setError(x.message); }
  }

  useEffect(() => {
    if (paso !== 2) return;
    const t = setInterval(() => api.unidad(f.id.toUpperCase()).then(d => setTel(d.ultima)).catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [paso, f.id]);

  const resultados = PRUEBAS.map(([k, nombre, ok, txt]) => ({ k, nombre, ok: tel ? ok(tel) : false, txt: tel ? txt(tel) : 'esperando…' }));
  const todo = tel && resultados.every(r => r.ok);
  const seg = inicio ? Math.round((Date.now() - inicio) / 1000) : 0;

  return (
    <>
      <h1>Instalar un dispositivo</h1>
      <ol className="pasos-inst">
        <li className={paso === 1 ? 'activo' : 'hecho'}>1. Datos del equipo</li>
        <li className={paso === 2 && !todo ? 'activo' : todo ? 'hecho' : ''}>2. Autoprueba</li>
        <li className={todo ? 'activo' : ''}>3. Listo</li>
      </ol>

      {paso === 1 && (
        <form className="formulario" onSubmit={dar}>
          <p>Conecta el cable al conector verde de 9 pines y fija el equipo con dos cinchos. Los datos de abajo vienen en la etiqueta y el código QR del dispositivo.</p>
          <label>Número de serie<input value={f.id} onChange={cambiar('id')} placeholder="NVK-0007" required /></label>
          <label>Número económico de la unidad<input value={f.unidad} onChange={cambiar('unidad')} placeholder="ECO-31" required /></label>
          <label>Corredor principal<input value={f.corredor} onChange={cambiar('corredor')} placeholder="Puebla–Veracruz" /></label>
          <label>Llave pública del equipo (PEM)<textarea rows={5} value={f.llave_publica} onChange={cambiar('llave_publica')} placeholder="-----BEGIN PUBLIC KEY-----" required /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn" type="submit">Dar de alta y probar</button>
        </form>
      )}

      {paso === 2 && (
        <section className="formulario">
          <p>{todo ? `Autoprueba superada en ${seg} s.` : `Esperando reportes del equipo… ${seg} s`}</p>
          <ul className="pruebas">
            {resultados.map(r => <li key={r.k} className={r.ok ? 'ok' : ''}><b>{r.ok ? '✓' : '·'}</b> {r.nombre} <span>{r.txt}</span></li>)}
          </ul>
          {!todo && seg > 45 && <p className="error">Lleva más de 45 s. Revisa que el LED de energía esté encendido y que el equipo tenga vista al cielo para GNSS.</p>}
          {todo && <Link className="btn" to={`/unidad/${f.id.toUpperCase()}`}>Ver la unidad en el monitor</Link>}
        </section>
      )}
    </>
  );
}
