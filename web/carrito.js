// Carrito: dispositivos + plan mensual (uno por dispositivo) y confirmación del pedido.
(function () {
  const N = window.Nervik;
  const $ = id => document.getElementById(id);
  const cant = $('cant');

  function pintar() {
    const n = N.carrito.leer().unidades;
    $('vacio').hidden = n > 0;
    $('compra').hidden = !n;
    if (!n) return;
    const c = N.cotizar(n), cat = N.catalogo;
    cant.value = n;
    $('cant-plan').textContent = `${n} ${n === 1 ? 'plan' : 'planes'}, uno por dispositivo`;
    $('imp-disp').innerHTML = `${N.pesos(c.dispositivos)}<small>${N.pesos(cat.dispositivo.precio)} c/u</small>`;
    $('imp-plan').innerHTML = `${N.pesos(c.primerMes)}<small>${N.pesos(cat.plan.precio)} c/u al mes</small>`;
    $('r-sub').textContent = N.pesosCentavos(c.subtotal);
    $('r-iva').textContent = N.pesosCentavos(c.iva);
    $('r-total').textContent = N.pesos(c.total);
    $('r-mes').textContent = N.pesos(c.mensual);
  }

  function fijar(n) { N.carrito.guardar({ unidades: Math.max(1, Math.min(500, Math.floor(n) || 1)) }); pintar(); }
  document.querySelectorAll('[data-cambio]').forEach(b => b.addEventListener('click', () => fijar(N.carrito.leer().unidades + Number(b.dataset.cambio))));
  cant.addEventListener('change', () => fijar(Number(cant.value)));
  $('vaciar').addEventListener('click', () => { N.carrito.guardar({ unidades: 0 }); pintar(); });

  const METODOS = {
    tarjeta: 'Te enviamos a tu correo una liga de pago segura para pagar con tarjeta de crédito o débito.',
    mercadopago: 'Te enviamos a tu correo la liga de Mercado Pago.',
    transferencia: 'Te enviamos a tu correo la CLABE para transferir por SPEI. Usa tu folio como referencia.',
  };

  $('pedido').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target, err = $('p-error');
    const d = Object.fromEntries(new FormData(f).entries());
    for (const k in d) d[k] = String(d[k]).trim();
    d.unidades = N.carrito.leer().unidades;
    const falta = [['nombre', 'tu nombre'], ['empresa', 'la empresa'], ['correo', 'un correo'], ['telefono', 'un teléfono']].filter(([k]) => !d[k]).map(([, t]) => t);
    err.hidden = true;
    if (falta.length) { err.textContent = `Falta ${falta.join(', ')}.`; err.hidden = false; return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.correo)) { err.textContent = 'Revisa el correo: ahí te llega la liga de pago.'; err.hidden = false; return; }
    const b = $('p-enviar');
    b.disabled = true; b.textContent = 'Confirmando…';
    try {
      const r = await fetch(`${N.api}/api/v1/pedidos`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) });
      const p = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(p.error || `error ${r.status}`);
      N.carrito.guardar({ unidades: 0 });
      $('compra').hidden = true;
      $('titulo').textContent = 'Pedido confirmado';
      const listo = $('listo');
      listo.innerHTML = `
        <p>Tu folio es</p>
        <p class="folio">${N.esc(p.folio)}</p>
        <dl>
          <dt>Unidades</dt><dd>${p.unidades} ${p.unidades === 1 ? 'dispositivo' : 'dispositivos'} con su plan mensual</dd>
          <dt>Pagas hoy</dt><dd>${N.pesosCentavos(p.total_hoy)} con IVA</dd>
          <dt>Cada mes</dt><dd>${N.pesosCentavos(p.mensual)} con IVA, desde el segundo mes</dd>
        </dl>
        <h2 class="subtitulo-tienda">Qué sigue</h2>
        <ol class="siguientes">
          <li>${METODOS[p.metodo_pago] || METODOS.transferencia}</li>
          <li>Cuando se acredite el pago te llamamos para agendar la instalación en tu patio.</li>
          <li>El día de la instalación damos de alta tus unidades en la app de monitoreo y te entregamos el acceso para tu central.</li>
        </ol>
        <a class="boton boton-contorno-oscuro" href="index.html">Volver al inicio</a>`;
      listo.hidden = false;
      listo.scrollIntoView({ block: 'start' });
    } catch (e) {
      err.textContent = `No se pudo registrar el pedido (${e.message}). Revisa tu conexión e inténtalo de nuevo.`;
      err.hidden = false;
    }
    b.disabled = false; b.textContent = 'Confirmar pedido';
  });

  N.listo.then(pintar);
  pintar();
})();
