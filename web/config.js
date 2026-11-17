// Dirección del servidor (API) de Nervik.
//
// En GitHub Pages la página no tiene servidor propio: cuando publiquen la API en Render,
// pongan aquí su dirección para activar el carrito y el formulario de contacto, por ejemplo:
//   window.NERVIK_API_PUBLICA = 'https://nervik-xxxx.onrender.com';
window.NERVIK_API_PUBLICA = '';

// No cambiar: decide a qué servidor hablar según dónde está abierta la página.
//  - GitHub Pages: el de arriba (si está vacío, la página queda en vista previa)
//  - Render o `npm run prototipo`: la misma dirección de la página
//  - `npm run dev` (puerto 8080): la API local en el puerto 3000
window.NERVIK_API = window.NERVIK_API ?? (
  location.hostname.endsWith('github.io') ? window.NERVIK_API_PUBLICA.replace(/\/+$/, '') :
  (location.port === '8080' || location.protocol === 'file:') ? 'http://localhost:3000' : ''
);
if (location.hostname.endsWith('github.io') && !window.NERVIK_API_PUBLICA) window.NERVIK_VISTA_PREVIA = true;
