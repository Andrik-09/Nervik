// Dirección de la API. Vacío = la misma dirección desde la que se abrió la página
// (cuando la sirve la propia API con `npm run prototipo` o en Render).
// Si publicas la página en otro lado (p. ej. GitHub Pages), pon aquí la URL de la API.
window.NERVIK_API = window.NERVIK_API ?? ((location.port === '8080' || location.protocol === 'file:') ? 'http://localhost:3000' : '');
