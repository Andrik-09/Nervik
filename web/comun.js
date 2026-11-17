// Utilidades compartidas por la página principal y el carrito.
(function () {
  // Precios acordados (semana 7). Se reemplazan por los del servidor en cuanto responde /api/v1/catalogo,
  // que es el que manda al calcular el pedido.
  const CATALOGO_BASE = {
    dispositivo: { nombre: 'Dispositivo Nervik', precio: 1800 },
    plan: { nombre: 'Plan mensual Nervik', precio: 300 },
    iva: 0.16,
  };
  const CLAVE = 'nervik.carrito';
  const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  const pesosCentavos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

  function leer() {
    try { const v = JSON.parse(localStorage.getItem(CLAVE)); return v && v.unidades > 0 ? v : { unidades: 0 }; } catch { return window.__carrito || { unidades: 0 }; }
  }
  function guardar(c) {
    window.__carrito = c;
    try { localStorage.setItem(CLAVE, JSON.stringify(c)); } catch { /* navegador sin almacenamiento */ }
    pintarContador();
  }
  function pintarContador() {
    const n = leer().unidades;
    document.querySelectorAll('[data-contador-carrito]').forEach(el => {
      el.textContent = n ? String(n) : '';
      el.hidden = !n;
    });
  }

  function cotizar(unidades, cat) {
    const c = cat || window.Nervik.catalogo;
    const dispositivos = unidades * c.dispositivo.precio;
    const primerMes = unidades * c.plan.precio;
    const subtotal = dispositivos + primerMes;
    const iva = Math.round(subtotal * c.iva * 100) / 100;
    return { unidades, dispositivos, primerMes, subtotal, iva, total: subtotal + iva, mensual: Math.round(primerMes * (1 + c.iva) * 100) / 100 };
  }

  const api = window.NERVIK_API ?? ((location.port === '8080' || location.protocol === 'file:') ? 'http://localhost:3000' : '');

  // Vista previa: la página está publicada sin servidor (p. ej. GitHub Pages antes de Render),
  // o el servidor no responde. El carrito y el contacto avisan en lugar de fingir que guardaron algo.
  let vistaPrevia = !!window.NERVIK_VISTA_PREVIA;
  function mostrarAvisoVistaPrevia() {
    if (document.querySelector('.aviso-vista-previa') || !document.body) return;
    const aviso = document.createElement('p');
    aviso.className = 'aviso-vista-previa';
    aviso.textContent = 'Vista previa: la tienda y el formulario de contacto se activan cuando conectemos el servidor. La app de monitoreo ya funciona en modo demostración.';
    document.body.prepend(aviso);
  }

  window.Nervik = {
    api,
    get vistaPrevia() { return vistaPrevia; },
    mensajeVistaPrevia: 'Esta página todavía está en vista previa: los pedidos y mensajes se guardarán cuando conectemos el servidor. Mientras tanto no se registró nada.',
    catalogo: CATALOGO_BASE,
    carrito: { leer, guardar, agregar: n => { const c = leer(); guardar({ unidades: Math.min(500, (c.unidades || 0) + n) }); } },
    cotizar,
    pesos: v => pesos.format(v),
    pesosCentavos: v => pesosCentavos.format(v),
    esc: s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
    listo: vistaPrevia
      ? Promise.resolve(CATALOGO_BASE)
      : fetch(`${api}/api/v1/catalogo`).then(r => r.json()).then(c => { window.Nervik.catalogo = c; return c; })
        .catch(() => { vistaPrevia = true; mostrarAvisoVistaPrevia(); return CATALOGO_BASE; }),
  };
  document.addEventListener('DOMContentLoaded', () => {
    pintarContador();
    if (vistaPrevia) mostrarAvisoVistaPrevia();
    // menú en pantallas angostas
    const cab = document.querySelector('.cabecera'), b = document.querySelector('.abrir-menu');
    if (!cab || !b) return;
    const cerrar = () => { cab.classList.remove('abierta'); b.setAttribute('aria-expanded', 'false'); b.textContent = 'Menú'; };
    b.addEventListener('click', () => {
      const abierto = cab.classList.toggle('abierta');
      b.setAttribute('aria-expanded', String(abierto)); b.textContent = abierto ? 'Cerrar' : 'Menú';
    });
    cab.querySelectorAll('.menu a').forEach(a => a.addEventListener('click', cerrar));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });
  });
})();
