// Pantalla de entrada: el dispositivo en 3D (el mismo de la página) y dos caminos claros:
// ver la demostración con una flota simulada, o conectar la central a su servidor.
import { useEffect, useRef, useState } from 'react';
import { entrar, servidor, probarServidor } from '../api.js';
import Icono from '../componentes/Iconos.jsx';

function Dispositivo() {
  const caja = useRef(null);
  const [con3d, setCon3d] = useState(false);
  useEffect(() => {
    let vivo = true, d;
    const movimiento = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // El modelo 3D vive en la página web (../js/dispositivo3d.js); si no carga, se queda la foto.
    import(/* @vite-ignore */ new URL('../js/dispositivo3d.js', location.href).href)
      .then(m => m.montar(caja.current, { movimiento }))
      .then(x => {
        if (!vivo) return; d = x; setCon3d(true);
        const t1 = setTimeout(() => d.alerta?.(true), 1800);
        const t2 = setTimeout(() => d.alerta?.(false), 5200);
        caja.current._t = [t1, t2];
      })
      .catch(() => {});
    return () => { vivo = false; (caja.current?._t || []).forEach(clearTimeout); };
  }, []);
  return (
    <div className={`entrar-equipo${con3d ? ' con-3d' : ''}`} ref={caja}>
      <img src="../img/dispositivo.png" alt="Dispositivo Nervik" />
    </div>
  );
}

export default function Entrar({ onListo }) {
  const enGithub = location.hostname.endsWith('github.io');
  const [url, setUrl] = useState(enGithub ? servidor() : '');
  const [v, setV] = useState(import.meta.env.DEV ? 'dev-central' : '');
  const [error, setError] = useState('');
  const [probando, setProbando] = useState(false);
  const [central, setCentral] = useState(!enGithub);

  async function conectar(e) {
    e.preventDefault(); setError(''); setProbando(true);
    try {
      await probarServidor(url.trim(), v.trim());
      entrar({ modo: 'servidor', llave: v.trim(), servidor: url.trim() });
      onListo();
    } catch (x) { setError(x.message); }
    setProbando(false);
  }

  return (
    <main className="entrar">
      <section className="entrar-escena">
        <Dispositivo />
        <div className="entrar-texto">
          <span className="logo grande">NERVIK</span>
          <h1>Tu flota, vigilada aunque el inhibidor apague todo.</h1>
          <ul className="entrar-puntos">
            <li><Icono n="monitor" tam={20} />Mapa en vivo y alertas en segundos</li>
            <li><Icono n="expedientes" tam={20} />Expedientes firmados para tu aseguradora</li>
            <li><Icono n="pruebas" tam={20} />Pruebas del equipo a distancia</li>
          </ul>
        </div>
      </section>

      <section className="entrar-panel">
        <div className="entrar-opcion destacada">
          <h2>Ver la demostración</h2>
          <p>Seis tractocamiones simulados en tu navegador. Puedes lanzar un ataque con inhibidor cuando quieras y ver cómo responde Nervik.</p>
          <button className="btn btn-ambar btn-grande" onClick={() => { entrar({ modo: 'demo' }); onListo(); }}>
            Entrar a la demostración <Icono n="flecha" tam={18} />
          </button>
        </div>

        {!central ? (
          <button className="entrar-alterno" onClick={() => setCentral(true)}>
            <Icono n="servidor" tam={20} /><span><b>Conectar mi central</b><small>Usa el servidor y la llave de tu flota real</small></span><Icono n="flecha" tam={18} />
          </button>
        ) : (
          <form className="formulario entrar-opcion" onSubmit={conectar}>
            <h2>Conectar mi central</h2>
            {enGithub && (
              <label>Dirección del servidor
                <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://nervik-xxxx.onrender.com" required />
              </label>
            )}
            <label>Llave de acceso de la central<input type="password" value={v} onChange={e => setV(e.target.value)} required autoFocus /></label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn" type="submit" disabled={probando}>{probando ? 'Conectando…' : 'Entrar'}</button>
          </form>
        )}
        <a className="nota volver-web" href="../">← Volver a la página de Nervik</a>
      </section>
    </main>
  );
}
