import { useState, useCallback } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { FlotaProvider, useFlota } from './flota.jsx';
import { llave, guardarLlave } from './api.js';
import Monitor from './paginas/Monitor.jsx';
import Unidad from './paginas/Unidad.jsx';
import Expedientes from './paginas/Expedientes.jsx';
import Expediente from './paginas/Expediente.jsx';
import Instalar from './paginas/Instalar.jsx';
import Pruebas from './paginas/Pruebas.jsx';

function Entrar({ onListo }) {
  const [v, setV] = useState(import.meta.env.DEV ? 'dev-central' : '');
  return (
    <main className="entrar">
      <div className="logo grande">NERVIK</div>
      <p>Centro de control</p>
      <form className="formulario" onSubmit={e => { e.preventDefault(); guardarLlave(v.trim()); onListo(); }}>
        <label>Llave de acceso de la central<input type="password" value={v} onChange={e => setV(e.target.value)} required autoFocus /></label>
        <button className="btn" type="submit">Entrar</button>
      </form>
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
        <span className={conectado ? 'en-linea' : 'en-linea fuera'}>{conectado ? '● En vivo' : '○ Reconectando…'} · {unidades.length} unidades</span>
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
  const [dentro, setDentro] = useState(!!llave());
  const salir = useCallback(() => { guardarLlave(''); setDentro(false); }, []);
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
