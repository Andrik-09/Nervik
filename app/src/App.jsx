import { useState, useCallback, useEffect } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate, Link } from 'react-router-dom';
import { FlotaProvider, useFlota } from './flota.jsx';
import { salir as cerrarSesion, sesionActiva, enDemo } from './api.js';
import { enAlerta, hace } from './formato.js';
import Icono from './componentes/Iconos.jsx';
import Entrar from './paginas/Entrar.jsx';
import Monitor from './paginas/Monitor.jsx';
import Unidad from './paginas/Unidad.jsx';
import Expedientes from './paginas/Expedientes.jsx';
import Expediente from './paginas/Expediente.jsx';
import Instalar from './paginas/Instalar.jsx';
import Pruebas from './paginas/Pruebas.jsx';
import Ajustes from './paginas/Ajustes.jsx';

const SECCIONES = [
  ['/', 'Monitor', 'monitor'],
  ['/expedientes', 'Expedientes', 'expedientes'],
  ['/pruebas', 'Pruebas', 'pruebas'],
  ['/instalar', 'Instalar', 'instalar'],
  ['/ajustes', 'Ajustes', 'ajustes'],
];

function Aviso() {
  const { aviso, cerrarAviso } = useFlota();
  const navegar = useNavigate();
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(cerrarAviso, aviso.tipo === 'alerta' ? 9000 : 5000);
    return () => clearTimeout(t);
  }, [aviso, cerrarAviso]);
  if (!aviso) return null;
  return (
    <div key={aviso.t} className={`aviso aviso-${aviso.tipo}`} role="status" aria-live="assertive">
      <Icono n={aviso.tipo === 'alerta' ? 'alerta' : aviso.tipo === 'listo' ? 'escudo' : 'campana'} />
      <span>{aviso.texto}</span>
      {aviso.enlace && <button className="aviso-ir" onClick={() => { navegar(aviso.enlace); cerrarAviso(); }}>Ver</button>}
      <button className="aviso-cerrar" onClick={cerrarAviso} aria-label="Cerrar aviso"><Icono n="cerrar" tam={18} /></button>
    </div>
  );
}

// Franja de alerta visible en todas las secciones (menos en el monitor, que ya la muestra en grande)
function AlertaGlobal() {
  const { unidades } = useFlota();
  const { pathname } = useLocation();
  const atacadas = unidades.filter(enAlerta);
  if (!atacadas.length || pathname === '/' || atacadas.some(u => pathname === `/unidad/${u.id}`)) return null;
  const u = atacadas[0];
  return (
    <Link className="alerta-global" to={`/unidad/${u.id}`}>
      <span className="latido" />
      <b>{atacadas.length > 1 ? `${atacadas.length} unidades con posible ataque` : `${u.unidad}: posible ataque`}</b>
      <span className="alerta-global-det">{u.estado === 'muda' ? `sin señal ${hace(u.segundos)}` : u.nivel_texto}</span>
      <Icono n="flecha" tam={18} />
    </Link>
  );
}

function Navegacion() {
  const { conectado, unidades } = useFlota();
  const atacadas = unidades.filter(enAlerta).length;
  return (
    <>
      <aside className="lateral no-imprimir">
        <Link to="/" className="logo">NERVIK</Link>
        <p className="lateral-sub">Centro de control</p>
        <nav className="lateral-nav">
          {SECCIONES.map(([ruta, t, ic]) => (
            <NavLink key={ruta} to={ruta} end={ruta === '/'}>
              <Icono n={ic} /> <span>{t}</span>
              {ruta === '/' && atacadas > 0 && <em className="insignia">{atacadas}</em>}
            </NavLink>
          ))}
        </nav>
        <div className="lateral-pie">
          {enDemo() && <span className="etiqueta-demo">Demostración</span>}
          <span className={conectado ? 'en-linea' : 'en-linea fuera'}><i />{conectado ? 'En vivo' : 'Reconectando…'} · {unidades.length} unidades</span>
          <a className="lateral-web" href="../">Página de Nervik</a>
        </div>
      </aside>
      <header className="barra-movil no-imprimir">
        <Link to="/" className="logo">NERVIK</Link>
        <span className={conectado ? 'en-linea' : 'en-linea fuera'}><i />{enDemo() ? 'Demo · ' : ''}{conectado ? 'En vivo' : 'Reconectando'}</span>
      </header>
      <nav className="pestanas-movil no-imprimir" aria-label="Secciones">
        {SECCIONES.map(([ruta, t, ic]) => (
          <NavLink key={ruta} to={ruta} end={ruta === '/'}>
            <span className="pm-icono"><Icono n={ic} />{ruta === '/' && atacadas > 0 && <em className="insignia">{atacadas}</em>}</span>
            <span>{t}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}

function ArribaAlCambiar() {
  const { pathname } = useLocation();
  useEffect(() => { document.querySelector('.contenido')?.scrollTo?.(0, 0); window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  const [dentro, setDentro] = useState(sesionActiva());
  const salir = useCallback(() => { cerrarSesion(); setDentro(false); }, []);
  if (!dentro) return <Entrar onListo={() => setDentro(true)} />;
  return (
    <FlotaProvider onNoAutorizado={salir}>
      <div className="marco-app">
        <Navegacion />
        <main className="contenido">
          <ArribaAlCambiar />
          <AlertaGlobal />
          <Routes>
            <Route path="/" element={<Monitor />} />
            <Route path="/unidad/:id" element={<Unidad />} />
            <Route path="/expedientes" element={<Expedientes />} />
            <Route path="/expedientes/:id" element={<Expediente />} />
            <Route path="/instalar" element={<Instalar />} />
            <Route path="/pruebas" element={<Pruebas />} />
            <Route path="/ajustes" element={<Ajustes onSalir={salir} />} />
            <Route path="*" element={<div className="vacio-sel">No existe esta sección. <Link to="/">Volver al monitor</Link></div>} />
          </Routes>
        </main>
        <Aviso />
      </div>
    </FlotaProvider>
  );
}
