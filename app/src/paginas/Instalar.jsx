// Flujo de instalación en 3 pasos, como el wireframe de la semana 6:
// 1) escanear el QR del equipo · 2) conectar al puerto de 9 pines y fijar con cinchos · 3) prueba automática de 30 s
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const PRUEBAS = [
  ['energia', 'Energía del vehículo', t => t.alimentacion, v => v >= 11, v => `${v} V`],
  ['bateria', 'Batería de respaldo', t => t.bateria, v => v >= 20, v => `${v} %`],
  ['bus', 'Datos del bus J1939', t => (t.bus === 0 ? null : t.motor), () => true, v => (v ? 'motor encendido' : 'motor apagado')],
  ['gnss', 'Satélites GNSS', t => (t.sats == null ? undefined : { sats: t.sats, cn0: t.cn0 }), v => v.sats >= 4 && v.cn0 >= 30, v => `${v.sats} sat · ${v.cn0} dB-Hz`],
  ['red', 'Red celular', t => t.rssi, v => v > -110, v => `${v} dBm`],
];
// Energía, batería y bus pueden no existir en el prototipo de banco: si el equipo no los reporta
// se muestran como "no instalado" y no bloquean la prueba. GNSS y red siempre son obligatorios.
const OBLIGATORIAS = ['gnss', 'red'];

function useCamaraQR(activo, onCodigo) {
  const video = useRef(null);
  const [aviso, setAviso] = useState('');
  useEffect(() => {
    if (!activo) return;
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices) { setAviso('Este navegador no lee QR con la cámara; pega el código abajo.'); return; }
    let flujo, vivo = true;
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(s => {
      flujo = s; video.current.srcObject = s; video.current.play();
      const buscar = async () => {
        if (!vivo) return;
        try {
          const r = await detector.detect(video.current);
          if (r[0]?.rawValue?.startsWith('NVK1:')) { onCodigo(r[0].rawValue); return; }
        } catch { /* cuadro sin QR */ }
        setTimeout(buscar, 300);
      };
      buscar();
    }).catch(() => setAviso('No se pudo abrir la cámara (requiere https y permiso). Pega el código abajo.'));
    return () => { vivo = false; flujo?.getTracks().forEach(t => t.stop()); };
  }, [activo, onCodigo]);
  return { video, aviso };
}

export default function Instalar() {
  const [paso, setPaso] = useState(1);
  const [f, setF] = useState({ codigo: '', unidad: '', corredor: '' });
  const [camara, setCamara] = useState(false);
  const [error, setError] = useState('');
  const [id, setId] = useState('');
  const [tel, setTel] = useState(null);
  const [inicio, setInicio] = useState(null);
  const cambiar = k => ev => setF({ ...f, [k]: ev.target.value });
  const { video, aviso } = useCamaraQR(camara, v => { setF(x => ({ ...x, codigo: v })); setCamara(false); });

  async function darDeAlta(ev) {
    ev.preventDefault(); setError('');
    const codigo = f.codigo.trim();
    const datos = codigo.startsWith('NVK1:')
      ? { codigo, unidad: f.unidad, corredor: f.corredor }
      : { id: f.id, llave_publica: codigo, unidad: f.unidad, corredor: f.corredor };
    try {
      const r = await api.alta(datos);
      setId(r.id); setPaso(2);
    } catch (x) {
      if (x.status === 409) { // ya existía: se puede repetir la prueba
        const serie = codigo.split(':')[1];
        if (serie) { setId(serie); setPaso(2); return; }
      }
      setError(x.message);
    }
  }

  useEffect(() => {
    if (paso !== 3) return;
    setInicio(Date.now());
    const t = setInterval(() => api.unidad(id).then(d => setTel(d.ultima)).catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [paso, id]);

  const fresca = tel && inicio && Date.parse(tel.recibido) > inicio - 15000;
  const resultados = PRUEBAS.map(([k, nombre, leer, ok, txt]) => {
    const v = fresca ? leer(tel) : undefined;
    if (v === undefined) return { k, nombre, estado: 'espera', txt: 'esperando…' };
    if (v === null) return { k, nombre, estado: OBLIGATORIAS.includes(k) ? 'falla' : 'na', txt: 'no instalado en este equipo' };
    return { k, nombre, estado: ok(v) ? 'ok' : 'falla', txt: txt(v) };
  });
  const listo = fresca && resultados.every(r => r.estado === 'ok' || r.estado === 'na');
  const seg = inicio ? Math.round((Date.now() - inicio) / 1000) : 0;

  return (
    <>
      <h1>Instalar un dispositivo</h1>
      <ol className="pasos-inst">
        {['Escanear', 'Conectar', 'Prueba automática'].map((t, i) => (
          <li key={t} className={paso === i + 1 && !(i === 2 && listo) ? 'activo' : paso > i + 1 || (i === 2 && listo) ? 'hecho' : ''}>Paso {i + 1} de 3 · {t}</li>
        ))}
      </ol>

      {paso === 1 && (
        <form className="formulario" onSubmit={darDeAlta}>
          <p>Escanea el código QR de la caja del equipo. En el prototipo, el QR y el código aparecen en el monitor serie al encender la Pico.</p>
          {camara
            ? <div className="camara"><video ref={video} muted playsInline /><button type="button" className="btn btn-sec" onClick={() => setCamara(false)}>Cerrar cámara</button></div>
            : <button type="button" className="btn btn-sec" onClick={() => setCamara(true)}>Escanear QR con la cámara</button>}
          {aviso && <p className="nota">{aviso}</p>}
          <label>Código de alta (NVK1:…) o llave pública PEM
            <textarea rows={3} value={f.codigo} onChange={cambiar('codigo')} placeholder="NVK1:NVK-P001:BHk3…" required /></label>
          {f.codigo.trim() && !f.codigo.trim().startsWith('NVK1:') && (
            <label>Número de serie<input value={f.id || ''} onChange={cambiar('id')} placeholder="NVK-0007" required /></label>
          )}
          <label>Unidad (número económico)<input value={f.unidad} onChange={cambiar('unidad')} placeholder="TR-0417" required /></label>
          <label>Corredor principal<input value={f.corredor} onChange={cambiar('corredor')} placeholder="Puebla–Veracruz" /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn" type="submit">Siguiente</button>
        </form>
      )}

      {paso === 2 && (
        <section className="formulario">
          <div className="ilustracion" aria-hidden="true">
            <svg viewBox="0 0 320 120" width="100%" height="120">
              <circle cx="70" cy="60" r="38" fill="none" stroke="currentColor" strokeWidth="4" />
              {[[70, 38], [52, 50], [88, 50], [52, 70], [88, 70], [70, 82], [70, 60], [60, 60], [80, 60]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="currentColor" />)}
              <text x="70" y="115" textAnchor="middle" fontSize="12">conector verde 9 pines</text>
              <path d="M150 85 L290 85 L290 45 L150 75 Z" fill="none" stroke="currentColor" strokeWidth="4" />
              <line x1="185" y1="40" x2="185" y2="100" stroke="currentColor" strokeWidth="3" strokeDasharray="5 4" />
              <line x1="255" y1="35" x2="255" y2="100" stroke="currentColor" strokeWidth="3" strokeDasharray="5 4" />
              <text x="220" y="115" textAnchor="middle" fontSize="12">cuña + 2 cinchos</text>
            </svg>
          </div>
          <p><b>Conecta el cable al puerto de 9 pines</b> (conector verde redondo bajo el tablero). En el prototipo de banco, conecta la Pico a la corriente.</p>
          <p><b>Fija la cuña con los 2 cinchos</b>, con la cara inclinada hacia el piso de la cabina.</p>
          <p className="nota">Equipo {id}. Al terminar deben encender las luces de energía y comunicación.</p>
          <button className="btn" onClick={() => setPaso(3)}>Ya está conectado</button>
        </section>
      )}

      {paso === 3 && (
        <section className="formulario">
          <p>{listo ? `Prueba superada en ${seg} s. El equipo ${id} ya protege la unidad ${f.unidad}.` : `Prueba automática… ${seg} s`}</p>
          <ul className="pruebas">
            {resultados.map(r => (
              <li key={r.k} className={r.estado}><b>{r.estado === 'ok' ? '✓' : r.estado === 'falla' ? '✗' : r.estado === 'na' ? '–' : '…'}</b> {r.nombre} <span>{r.txt}</span></li>
            ))}
          </ul>
          {!listo && seg > 45 && <p className="error">Lleva más de 45 s. Revisa que el LED de comunicación esté fijo y que la antena GNSS tenga vista al cielo (junto a una ventana sirve).</p>}
          {listo && <Link className="btn" to={`/unidad/${id}`}>Terminar</Link>}
        </section>
      )}
    </>
  );
}
