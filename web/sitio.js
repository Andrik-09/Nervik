// Página principal: animación de la portada, cotizador, carrito, canales y formulario de contacto.
(function () {
  const N = window.Nervik;
  const $ = id => document.getElementById(id);

  // ---- Portada: la huella del inhibidor (un solo momento animado) ----
  const senal = $('senal');
  const pasos = senal.querySelectorAll('.registro li');
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function atacar() {
    senal.classList.add('atacada');
    pasos.forEach((li, i) => setTimeout(() => li.classList.add('visible'), sinMovimiento ? 0 : 1300 + i * 1100));
  }
  if (sinMovimiento) atacar();
  else if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(e => { if (e[0].isIntersecting) { setTimeout(atacar, 900); obs.disconnect(); } }, { threshold: 0.5 });
    obs.observe(senal);
  } else atacar();

  // ---- Cotizador y carrito ----
  const campo = $('unidades');
  function unidades() { return Math.max(1, Math.min(500, Math.floor(Number(campo.value) || 1))); }
  function recalcular() {
    const c = N.cotizar(unidades());
    $('c-hoy').textContent = N.pesos(c.total);
    $('c-mes').textContent = N.pesos(c.mensual);
  }
  document.querySelectorAll('[data-cambio]').forEach(b => b.addEventListener('click', () => {
    campo.value = Math.max(1, Math.min(500, unidades() + Number(b.dataset.cambio)));
    recalcular();
  }));
  campo.addEventListener('input', recalcular);
  campo.addEventListener('blur', () => { campo.value = unidades(); recalcular(); });
  $('cotizador').addEventListener('submit', ev => {
    ev.preventDefault();
    const n = unidades();
    N.carrito.agregar(n);
    const total = N.carrito.leer().unidades;
    $('agregado').innerHTML = `Agregaste ${n} ${n === 1 ? 'unidad' : 'unidades'}. Llevas ${total} en el carrito. <a href="carrito.html">Ir al carrito</a>`;
  });
  N.listo.then(cat => {
    document.querySelectorAll('[data-precio]').forEach(el => { el.textContent = N.pesos(cat[el.dataset.precio].precio); });
    recalcular();
  });
  recalcular();

  // ---- Canales de contacto (se llenan en contacto.js) ----
  const C = window.NERVIK_CONTACTO || {};
  const canales = [
    C.whatsapp && ['WhatsApp', `https://wa.me/${C.whatsapp.replace(/\D/g, '')}`, `+${C.whatsapp.replace(/\D/g, '')}`],
    C.telefono && ['Teléfono', `tel:${C.telefono.replace(/\s/g, '')}`, C.telefono],
    C.correo && ['Correo', `mailto:${C.correo}`, C.correo],
    C.facebook && ['Facebook', C.facebook, C.facebook.replace(/^https?:\/\/(www\.)?/, '')],
    C.instagram && ['Instagram', C.instagram, C.instagram.replace(/^https?:\/\/(www\.)?/, '')],
    C.linkedin && ['LinkedIn', C.linkedin, C.linkedin.replace(/^https?:\/\/(www\.)?/, '')],
    C.tiktok && ['TikTok', C.tiktok, C.tiktok.replace(/^https?:\/\/(www\.)?/, '')],
  ].filter(Boolean);
  $('canales').innerHTML =
    canales.map(([t, href, txt]) => `<li><a href="${N.esc(href)}"${href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}><em>${t}</em><b>${N.esc(txt)}</b></a></li>`).join('') +
    (C.horario ? `<li><span><em>Horario</em>${N.esc(C.horario)}</span></li>` : '') +
    (C.ubicacion ? `<li><span><em>Ubicación</em>${N.esc(C.ubicacion)}</span></li>` : '');
  if (C.whatsapp) {
    const w = $('whatsapp');
    w.href = `https://wa.me/${C.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, quiero información de Nervik para mi flota.')}`;
    w.target = '_blank'; w.rel = 'noopener'; w.hidden = false;
  }
  if (window.NERVIK_BITACORA) $('enlace-bitacora').href = window.NERVIK_BITACORA;

  // ---- Formulario de contacto ----
  document.querySelectorAll('[data-motivo]').forEach(a => a.addEventListener('click', () => { $('motivo').value = a.dataset.motivo; }));
  const f = $('form-contacto');
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(f).entries());
    for (const k in d) d[k] = String(d[k]).trim();
    const err = $('c-error');
    err.hidden = true;
    if (!d.nombre || !d.empresa) { err.textContent = 'Escribe tu nombre y el de tu empresa.'; err.hidden = false; return; }
    if (!d.correo && !d.telefono) { err.textContent = 'Déjanos un correo o un teléfono para responderte.'; err.hidden = false; return; }
    d.tipo = d.motivo === 'aseguradora' ? 'aseguradora' : 'flota';
    d.origen = 'web-contacto';
    if (N.vistaPrevia) { err.textContent = N.mensajeVistaPrevia; err.hidden = false; return; }
    const b = $('c-enviar');
    b.disabled = true; b.textContent = 'Enviando…';
    try {
      const r = await fetch(`${N.api}/api/v1/prospectos`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `error ${r.status}`);
      f.reset();
      const ok = $('c-ok');
      ok.textContent = `Gracias, ${d.nombre}. Recibimos tu mensaje y te respondemos en menos de un día hábil.`;
      ok.hidden = false;
    } catch (e) {
      err.textContent = `No se pudo enviar el mensaje (${e.message}). Revisa tu conexión e inténtalo de nuevo.`;
      err.hidden = false;
    }
    b.disabled = false; b.textContent = 'Enviar mensaje';
  });
})();
