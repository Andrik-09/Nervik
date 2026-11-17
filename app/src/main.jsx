import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './instalable.js';
import App from './App.jsx';
import './estilos.css';

// Service worker: permite instalar la app y abrirla aunque la red esté inestable
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Rutas con # para que funcione igual en GitHub Pages, en Render o en la computadora */}
    <HashRouter><App /></HashRouter>
  </React.StrictMode>
);
