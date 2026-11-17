// Ajustes: instalar la app, avisos y sonido, conexión y salida.
import { useState } from 'react';
import { useFlota } from '../flota.jsx';
import { enDemo, servidor } from '../api.js';
import { useInstalar } from '../instalable.js';
import Icono from '../componentes/Iconos.jsx';

function Interruptor({ activo, onCambio, etiqueta }) {
  return (
    <button className={`interruptor${activo ? ' activo' : ''}`} role="switch" aria-checked={activo} aria-label={etiqueta} onClick={() => onCambio(!activo)}><i /></button>
  );
}

export default function Ajustes({ onSalir }) {
  const { sonido, setSonido, probarSonido, avisar, unidades } = useFlota();
  const inst = useInstalar();
  const [permiso, setPermiso] = useState(() => { try { return Notification.permission; } catch { return 'unsupported'; } });

  async function pedirAvisos() {
    try {
      const p = await Notification.requestPermission();
      setPermiso(p);
      if (p === 'granted') new Notification('Nervik', { body: 'Así te avisaremos si una unidad sufre un ataque.', icon: './icono-192.png' });
    } catch { setPermiso('unsupported'); }
  }

  async function instalar() {
    const ok = await inst.instalar();
    if (ok) avisar('Nervik quedó instalada en tu dispositivo', false, 'listo');
  }

  return (
    <>
      <header className="pagina-cab"><div><h1>Ajustes</h1><p className="pagina-sub">Configura cómo te avisa Nervik y en qué dispositivo la usas.</p></div></header>

      <section className="tarjeta-seccion instalar-app">
        <div className="instalar-icono"><img src="./icono-192.png" alt="" /></div>
        <div>
          <h2>{inst.instalada ? 'La app ya está instalada' : 'Instala Nervik en este dispositivo'}</h2>
          {inst.instalada
            ? <p className="nota">Estás usando la app instalada. Ábrela desde su ícono como cualquier otra app.</p>
            : inst.disponible
              ? <p className="nota">Queda con su ícono en la pantalla de inicio, abre en pantalla completa y funciona igual en celular y computadora.</p>
              : inst.ios
                ? <ol className="pasos-ios"><li>Toca <b>Compartir</b> <Icono n="compartir" tam={15} /> en Safari.</li><li>Elige <b>Agregar a pantalla de inicio</b>.</li><li>Toca <b>Agregar</b>.</li></ol>
                : <ol className="pasos-ios"><li>Abre el menú del navegador (⋮ en Chrome o Edge).</li><li>Elige <b>Instalar app</b> o <b>Agregar a pantalla principal</b>.</li></ol>}
        </div>
        {inst.disponible && !inst.instalada && <button className="btn btn-ambar" onClick={instalar}><Icono n="descargar" tam={17} />Instalar app</button>}
      </section>

      <section className="tarjeta-seccion">
        <h2>Avisos</h2>
        <ul className="ajustes">
          <li>
            <Icono n="campana" />
            <div><b>Notificaciones del sistema</b><small>{permiso === 'granted' ? 'Activadas: recibirás un aviso aunque la app esté en segundo plano.' : permiso === 'denied' ? 'Bloqueadas en el navegador. Actívalas en los permisos del sitio.' : permiso === 'unsupported' ? 'Este navegador no permite notificaciones.' : 'Recibe un aviso en cuanto una unidad pierda la señal.'}</small></div>
            {permiso === 'default' ? <button className="btn btn-sec btn-chico" onClick={pedirAvisos}>Activar</button> : <span className={`pill ${permiso === 'granted' ? 'pill-ok' : ''}`}>{permiso === 'granted' ? 'Activas' : 'No disponibles'}</span>}
          </li>
          <li>
            <Icono n="volumen" />
            <div><b>Sonido y vibración de alerta</b><small>Suena tres tonos cuando una unidad pasa a posible ataque.</small></div>
            <button className="btn btn-sec btn-chico" onClick={probarSonido}>Probar</button>
            <Interruptor activo={sonido} onCambio={setSonido} etiqueta="Sonido de alerta" />
          </li>
        </ul>
      </section>

      <section className="tarjeta-seccion">
        <h2>Conexión</h2>
        <ul className="ajustes">
          <li>
            <Icono n="servidor" />
            <div><b>{enDemo() ? 'Demostración en este navegador' : 'Servidor de la central'}</b><small>{enDemo() ? `${unidades.length} unidades simuladas con firmas reales. Se reinicia al recargar.` : servidor() || location.origin}</small></div>
            {enDemo() && <button className="btn btn-sec btn-chico" onClick={() => location.reload()}>Reiniciar</button>}
          </li>
          <li>
            <Icono n="web" />
            <div><b>Página de Nervik</b><small>Planes, precios y contacto.</small></div>
            <a className="btn btn-sec btn-chico" href="../">Abrir</a>
          </li>
          <li>
            <Icono n="salir" />
            <div><b>{enDemo() ? 'Salir de la demostración' : 'Cerrar sesión'}</b><small>Vuelve a la pantalla de entrada.</small></div>
            <button className="btn btn-sec btn-chico" onClick={onSalir}>Salir</button>
          </li>
        </ul>
      </section>
      <p className="nota pie-ajustes">Nervik · Proyecto de Ingeniería IV, Equipo 2, IBERO Puebla</p>
    </>
  );
}
