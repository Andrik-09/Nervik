import { useState, useCallback } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { FlotaProvider, useFlota } from './flota.jsx';
import { entrar, salir as cerrarSesion, sesionActiva, enDemo, servidor, probarServidor } from './api.js';
import Monitor from './paginas/Monitor.jsx';
import Unidad from './paginas/Unidad.jsx';
import Expedientes from './paginas/Expedientes.jsx';
import Expediente from './paginas/Expediente.jsx';
import Instalar from './paginas/Instalar.jsx';
import Pruebas from './paginas/Pruebas.jsx';

function Entrar({ onListo }) {
  // Si la app la sirve la propia API (Render o la computadora), el servidor es esta misma dirección.
  const enGithub = location.hostname.endsWith('github.io');
  const [url, setUrl] = useState(enGithub ? servidor() : '');
  const [v, setV] = useState(import.meta.env.DEV ? 'dev-central' : '');
  const [error, setError] = useState('');
  const [probando, setProbando] = useState(false);

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
      <div className="logo grande">NERVIK</div>
      <p>App de monitoreo para tu central</p>

      <form className="formulario" onSubmit={conectar}>
        <h2>Entrar a mi central</h2>
        {enGithub && (
          <label>Dirección del servidor
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://nervik-xxxx.onrender.com" required />
          </label>
        )}
        <label>Llave de acceso de la central<input type="password" value={v} onChange={e => setV(e.target.value)} required autoFocus={!enGithub} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" type="submit" disabled={probando}>{probando ? 'Conectando…' : 'Entrar'}</button>
      </form>

      <section className="entrar-demo">
        <h2>¿Aún no tienes servidor?</h2>
        <p>Prueba la app con una flota simulada de 6 tractocamiones en tu navegador: mapa, alertas, expedientes firmados, pruebas y diagnóstico.</p>
        <button className="btn btn-sec" onClick={() => { entrar({ modo: 'demo' }); onListo(); }}>Ver demostración</button>
      </section>
      <p className="nota volver-web"><a href="../">Volver a la página de Nervik</a></p>
    </main>
  );
}

function Aviso() {
  const { aviso, cerrarAviso } = useFlota();
  if (!aviso) return null;
  return (
    <div className="aviso" role="status" aria-live="assertive">
      {aviso.texto}<button onClick={cerrarAviso} aria-label="Cerrar aviso">×</button>
    </div>
  );
}

function Cabecera({ onSalir }) {
  const { conectado, unidades } = useFlota();
  const [permiso, setPermiso] = useState(() => { try { return Notification.permission; } catch { return 'denied'; } });
  return (
    <header className="cab no-imprimir">
      <div className="cab-sup">
        <span className="logo">NERVIK</span>
        <span className={conectado ? 'en-linea' : 'en-linea fuera'}>
          {enDemo() && <span className="etiqueta-demo">DEMOSTRACIÓN</span>}
          {conectado ? '● En vivo' : '○ Reconectando…'} · {unidades.length} unidades
        </span>
      </div>
      <nav>
        <NavLink to="/" end>Monitor</NavLink>
        <NavLink to="/expedientes">Expedientes</NavLink>
        <NavLink to="/pruebas">Pruebas</NavLink>
        <NavLink to="/instalar">Instalar</NavLink>
        {permiso === 'default' && <button className="enlace" onClick={() => Notification.requestPermission().then(setPermiso)}>Activar avisos</button>}
        <button className="enlace" onClick={onSalir}>Salir</button>
      </nav>
    </header>
  );
}

export default function App() {
  const [dentro, setDentro] = useState(sesionActiva());
  const salir = useCallback(() => { cerrarSesion(); setDentro(false); }, []);
  if (!dentro) return <Entrar onListo={() => setDentro(true)} />;
  return (
    <FlotaProvider onNoAutorizado={salir}>
      <Cabecera onSalir={salir} />
      <Aviso />
      <main className="contenido">
        <Routes>
          <Route path="/" element={<Monitor />} />
          <Route path="/unidad/:id" element={<Unidad />} />
          <Route path="/expedientes" element={<Expedientes />} />
          <Route path="/expedientes/:id" element={<Expediente />} />
          <Route path="/instalar" element={<Instalar />} />
          <Route path="/pruebas" element={<Pruebas />} />
          <Route path="*" element={<p>No existe esta página.</p>} />
        </Routes>
      </main>
    </FlotaProvider>
  );
}
