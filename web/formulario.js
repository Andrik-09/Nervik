// Envía el formulario a la API (POST /api/v1/prospectos).
(function () {
  const f = document.getElementById('f');
  const err = document.getElementById('err');
  const ok = document.getElementById('ok');
  const boton = document.getElementById('enviar');
  const campoU = document.getElementById('campo-u');
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  // Los enlaces "Hablar con el equipo" preseleccionan el tipo
  document.querySelectorAll('[data-tipo]').forEach(a => a.addEventListener('click', () => {
    const r = f.querySelector(`input[name="tipo"][value="${a.dataset.tipo}"]`);
    if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
  }));
  // "Unidades" solo aplica a flotas
  f.addEventListener('change', () => { campoU.classList.toggle('hidden', f.tipo.value !== 'flota'); });

  function mostrarError(texto) { err.textContent = texto; err.classList.remove('hidden'); }

  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    err.classList.add('hidden');
    const datos = Object.fromEntries(new FormData(f).entries());
    for (const k in datos) datos[k] = String(datos[k]).trim();
    if (!datos.nombre || !datos.empresa || !datos.telefono) return mostrarError('Falta nombre, empresa o teléfono.');
    if (datos.tipo !== 'flota') delete datos.unidades;
    datos.origen = 'web';

    boton.disabled = true; boton.textContent = 'Enviando…';
    try {
      const r = await fetch(`${window.NERVIK_API}/api/v1/prospectos`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(datos),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Error ${r.status}`);
    } catch (e) {
      boton.disabled = false; boton.textContent = 'Apartar mi unidad';
      return mostrarError(`No pudimos guardar tu registro (${e.message}). Revisa tu conexión e inténtalo de nuevo.`);
    }

    ok.innerHTML = '<h2>' + (datos.tipo === 'flota' ? 'Tu unidad quedó apartada' : 'Recibimos tus datos') + '</h2>' +
      '<p><b>' + esc(datos.nombre) + '</b> · ' + esc(datos.empresa) +
      (datos.unidades ? '<br>Unidades: ' + esc(datos.unidades) : '') +
      (datos.corredor ? '<br>Corredor: ' + esc(datos.corredor) : '') + '<br>Teléfono: ' + esc(datos.telefono) + '</p>' +
      '<p>No se cobró nada. Te llamamos para ' + (datos.tipo === 'flota' ? 'confirmar la instalación.' : 'agendar una reunión.') + '</p>' +
      '<button class="btn sec" type="button" id="otra">Registrar otra persona</button>';
    f.classList.add('hidden'); ok.classList.remove('hidden');
    boton.disabled = false; boton.textContent = 'Apartar mi unidad';
    document.getElementById('otra').addEventListener('click', () => {
      f.reset(); campoU.classList.remove('hidden'); f.classList.remove('hidden'); ok.classList.add('hidden');
    });
  });
})();
