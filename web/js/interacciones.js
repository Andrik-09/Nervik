// Interacciones de la página: mapa con inhibidor, consola "hoy vs. con Nervik", simulador túnel/inhibidor,
// pestañas de la app, verificación real de la firma del expediente, contadores y luz que sigue al cursor.
(function () {
  const $ = id => document.getElementById(id);
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const alVer = (el, fn, umbral = 0.35) => {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const o = new IntersectionObserver(e => { if (e[0].isIntersecting) { o.disconnect(); fn(); } }, { threshold: umbral });
    o.observe(el);
  };

  // ======================================================================
  // 1) Contadores de las cifras
  // ======================================================================
  const fmt = new Intl.NumberFormat('es-MX');
  document.querySelectorAll('[data-contar]').forEach(el => {
    const meta = Number(el.dataset.contar), pre = el.dataset.prefijo || '', suf = el.dataset.sufijo || '';
    const pintar = v => { el.textContent = pre + fmt.format(Math.round(v)) + suf; };
    if (sinMovimiento) return;
    pintar(0);
    alVer(el, () => {
      const t0 = performance.now(), dur = 1400;
      const paso = t => { const k = Math.min(1, (t - t0) / dur); pintar(meta * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(paso); };
      requestAnimationFrame(paso);
    }, 0.6);
  });

  // ======================================================================
  // 2) Luz que sigue al cursor en los paneles
  // ======================================================================
  document.querySelectorAll('.luz').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  // ======================================================================
  // 3) Mapa: unidades recorriendo los corredores; tocar enciende un inhibidor
  // ======================================================================
  (function mapa() {
    const svg = document.querySelector('#mapa-lienzo svg');
    const estado = $('mapa-estado');
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    const rutas = [...svg.querySelectorAll('.mapa-ruta')];
    const capa = document.createElementNS(NS, 'g');
    svg.appendChild(capa);
    let n = 11;
    const unidades = [];
    rutas.forEach((ruta, i) => {
      const L = ruta.getTotalLength();
      for (let k = 0; k < (L > 150 ? 2 : 1); k++) {
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'unidad-mapa');
        g.innerHTML = '<circle class="halo" r="16"/><circle class="cuerpo" r="6.5"/><text class="etiqueta" x="11" y="-11"></text>';
        capa.appendChild(g);
        unidades.push({ g, ruta, L, d: Math.random() * L, v: (0.04 + Math.random() * 0.03) * (Math.random() < 0.5 ? 1 : -1), id: `ECO-${n}`, atacada: 0 });
        n += 3;
      }
    });
    function colocar(u) { const p = u.ruta.getPointAtLength(u.d); u.g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`); u.x = p.x; u.y = p.y; }
    unidades.forEach(colocar);

    let ultimoToque = 0;
    function inhibidor(x, y, porUsuario) {
      if (porUsuario) ultimoToque = performance.now();
      const anillo = document.createElementNS(NS, 'circle');
      anillo.setAttribute('class', 'anillo-inhibidor');
      anillo.setAttribute('cx', x); anillo.setAttribute('cy', y); anillo.setAttribute('r', 6);
      capa.insertBefore(anillo, capa.firstChild);
      const R = 70, t0 = performance.now();
      const crecer = t => {
        const k = Math.min(1, (t - t0) / 900);
        anillo.setAttribute('r', (6 + (R - 6) * (1 - Math.pow(1 - k, 2))).toFixed(1));
        if (k < 1 && !sinMovimiento) requestAnimationFrame(crecer); else anillo.setAttribute('r', R);
      };
      requestAnimationFrame(crecer);
      setTimeout(() => anillo.classList.add('apagandose'), 5200);
      setTimeout(() => anillo.remove(), 6200);
      const alcanzadas = unidades.filter(u => Math.hypot(u.x - x, u.y - y) <= R);
      setTimeout(() => {
        alcanzadas.forEach(u => {
          u.atacada = performance.now();
          u.g.classList.add('atacada');
          u.g.querySelector('.etiqueta').textContent = `${u.id}: alerta en 3 s`;
        });
        estado.innerHTML = alcanzadas.length
          ? `<b>${alcanzadas.map(u => u.id).join(', ')}</b> ${alcanzadas.length === 1 ? 'quedó' : 'quedaron'} bajo el inhibidor. Nervik lo detectó en 3 segundos y tu central ya recibió la alerta, aunque la red se cayó.`
          : 'El inhibidor no alcanzó a ninguna unidad. Toca más cerca de una ruta.';
      }, 600);
      setTimeout(() => alcanzadas.forEach(u => { u.g.classList.remove('atacada'); u.g.querySelector('.etiqueta').textContent = ''; u.atacada = 0; }), 6000);
    }

    function aSvg(e) {
      const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
      return p.matrixTransform(svg.getScreenCTM().inverse());
    }
    svg.addEventListener('click', e => { const p = aSvg(e); inhibidor(p.x, p.y, true); });
    svg.style.cursor = 'crosshair';

    let previo = performance.now(), visible = false;
    new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(svg);
    function cuadro(t) {
      requestAnimationFrame(cuadro);
      const dt = Math.min(60, t - previo); previo = t;
      if (!visible || sinMovimiento) return;
      unidades.forEach(u => {
        if (u.atacada) return;          // la unidad atacada se detiene: parada no programada
        u.d += u.v * dt;
        if (u.d > u.L) { u.d = u.L; u.v *= -1; }
        if (u.d < 0) { u.d = 0; u.v *= -1; }
        colocar(u);
      });
    }
    requestAnimationFrame(cuadro);
    // Si nadie toca el mapa, cada tanto aparece un inhibidor sobre una unidad al azar
    setInterval(() => {
      if (!visible || performance.now() - ultimoToque < 15000) return;
      const u = unidades[Math.floor(Math.random() * unidades.length)];
      inhibidor(u.x + 8, u.y - 6, false);
    }, 9000);
  })();

  // ======================================================================
  // 4) Consola "el mismo ataque, contado dos veces"
  // ======================================================================
  (function consola() {
    const rango = $('tiempo'); if (!rango) return;
    const T0 = 2 * 3600 + 13 * 60 + 30;         // 02:13:30
    const FIN = 2 * 3600 + 32 * 60 + 30;        // 02:32:30
    // El deslizador va más lento en los primeros minutos, donde pasa casi todo
    const aSeg = v => { const k = v / 1000; return k <= 0.7 ? T0 + (k / 0.7) * 240 : T0 + 240 + ((k - 0.7) / 0.3) * (FIN - T0 - 240); };
    const hhmmss = s => [Math.floor(s / 3600), Math.floor(s / 60) % 60, Math.floor(s) % 60].map(x => String(x).padStart(2, '0')).join(':');
    const h = (hh, mm, ss) => hh * 3600 + mm * 60 + ss;
    const HOY = [
      [h(2, 14, 0), 'Se pierde la señal del GPS. La central solo ve el último punto conocido.'],
      [h(2, 16, 41), null],   // la unidad se detiene, pero la central no se entera
    ];
    const CON = [
      [h(2, 14, 7), 'Alerta N1: la señal cae en todos los satélites a la vez. Aviso enviado antes de perder la red.', 'Alerta N1', 'alerta'],
      [h(2, 14, 20), 'N2: se pierde la red celular. Alerta encendida en cabina.', 'Sospecha N2', 'alerta'],
      [h(2, 15, 5), 'La unidad lleva 45 s sin reportar con el motor encendido: la app la marca como posible ataque.', 'Posible ataque', 'alerta'],
      [h(2, 16, 41), 'N3: parada no programada registrada con la última posición válida.', 'Evento confirmado', 'alerta'],
      [h(2, 31, 55), 'Regresa la señal: llega el expediente firmado, listo para la aseguradora.', 'Expediente recibido', 'listo'],
    ];
    const bHoy = $('bitacora-hoy'), bCon = $('bitacora-con'), reloj = $('reloj');
    // Solo se reescribe la bitácora cuando cambia, para que cada evento nuevo entre con su animación
    const poner = (ol, html) => { if (ol.dataset.html !== html) { ol.dataset.html = html; ol.innerHTML = html; } };
    function pintar() {
      const s = aSeg(Number(rango.value));
      reloj.textContent = hhmmss(s);
      rango.style.setProperty('--avance', `${rango.value / 10}%`);
      // hoy
      const sinSenal = s >= HOY[0][0];
      $('estado-hoy').textContent = sinSenal ? 'Sin señal' : 'En ruta';
      $('estado-hoy').className = 'estado-pill' + (sinSenal ? ' apagado' : '');
      $('detalle-hoy').textContent = sinSenal ? `Último reporte 02:14:00, hace ${Math.floor((s - HOY[0][0]) / 60)} min ${Math.floor(s - HOY[0][0]) % 60} s` : 'Puebla–Veracruz, 82 km/h';
      poner(bHoy, sinSenal
        ? `<li><time>02:14:00</time>${HOY[0][1]}</li>` + (s >= h(2, 16, 41) ? '<li class="vacio"><time>02:16:41</time>La unidad se detiene. La central no se entera.</li>' : '')
        : '<li class="vacio">Sin novedades.</li>');
      // con Nervik
      const pasados = CON.filter(e => s >= e[0]);
      const ultimo = pasados[pasados.length - 1];
      $('estado-con').textContent = ultimo ? ultimo[2] : 'Protegida';
      $('estado-con').className = 'estado-pill' + (ultimo ? ` ${ultimo[3]}` : ' ok');
      $('detalle-con').textContent = !ultimo ? 'Puebla–Veracruz, 82 km/h' : ultimo[3] === 'listo' ? 'Expediente firmado recibido' : s >= h(2, 16, 41) ? 'Detenida, motor encendido, última posición válida guardada' : 'Atacada, 82 km/h, alerta en cabina';
      poner(bCon, pasados.length ? pasados.map(e => `<li><time>${hhmmss(e[0])}</time>${e[1]}</li>`).join('') : '<li class="vacio">Sin novedades.</li>');
      document.getElementById('consola').classList.toggle('en-ataque', !!ultimo && ultimo[3] !== 'listo');
    }
    rango.addEventListener('input', () => { detener(); pintar(); });
    let animando = null;
    const boton = $('reproducir');
    function detener() { if (animando) cancelAnimationFrame(animando); animando = null; boton.classList.remove('sonando'); boton.setAttribute('aria-label', 'Reproducir'); }
    function reproducir() {
      if (Number(rango.value) >= 1000) rango.value = 0;
      boton.classList.add('sonando'); boton.setAttribute('aria-label', 'Pausar');
      let previo = performance.now();
      const paso = t => {
        rango.value = Math.min(1000, Number(rango.value) + (t - previo) / 11); previo = t;
        pintar();
        if (Number(rango.value) < 1000) animando = requestAnimationFrame(paso); else detener();
      };
      animando = requestAnimationFrame(paso);
    }
    boton.addEventListener('click', () => (animando ? detener() : reproducir()));
    pintar();
    if (!sinMovimiento) alVer($('consola'), reproducir, 0.5);
  })();

  // ======================================================================
  // 5) Simulador: túnel o inhibidor
  // ======================================================================
  (function simulador() {
    const barras = [...document.querySelectorAll('#senal .barra i')];
    if (!barras.length) return;
    const base = barras.map(b => parseFloat(b.parentElement.style.getPropertyValue('--alto')) || 0.8);
    const estado = $('senal-estado'), veredicto = $('senal-veredicto'), ledAlerta = $('led-alerta'), ledCom = $('led-com');
    const senal = $('senal');
    let modo = 'normal', t0 = 0, temporizadores = [];
    const alturas = f => barras.forEach((b, i) => { b.style.height = `${Math.max(0, f(i)) * 130}px`; });
    const limpiar = () => { temporizadores.forEach(clearTimeout); temporizadores = []; };
    const luego = (ms, fn) => temporizadores.push(setTimeout(fn, sinMovimiento ? 0 : ms));
    function normal() {
      modo = 'normal';
      senal.className = 'senal';
      ledAlerta.classList.add('led-apagado'); ledCom.classList.remove('led-apagado');
      veredicto.textContent = 'Normal';
      estado.textContent = 'La unidad va a 82 km/h con 8 satélites y buena señal.';
    }
    // pequeña variación para que la señal se vea viva
    setInterval(() => { if (modo === 'normal') alturas(i => base[i] + (Math.random() - 0.5) * 0.06); }, 700);
    alturas(i => base[i]);

    document.querySelectorAll('[data-simular]').forEach(b => b.addEventListener('click', () => {
      limpiar(); normal();
      if (b.dataset.simular === 'tunel') {
        modo = 'tunel';
        senal.className = 'senal tunel';
        veredicto.textContent = 'Analizando…';
        alturas(() => 0);
        estado.textContent = 'Entrada al túnel: todos los satélites desaparecen en el mismo segundo.';
        luego(1500, () => { veredicto.textContent = 'No es ataque'; estado.textContent = 'Pérdida de golpe y la red sigue funcionando: es un túnel o un puente. Nervik no da alarma.'; });
        luego(3800, () => { alturas(i => base[i]); estado.textContent = 'Salida del túnel: la señal regresa. Sin falsas alarmas.'; veredicto.textContent = 'Normal'; senal.className = 'senal'; });
        luego(5600, normal);
      } else {
        modo = 'inhibidor';
        senal.className = 'senal inhibidor';
        veredicto.textContent = 'Analizando…';
        estado.textContent = 'La calidad de señal empieza a bajar en todos los satélites a la vez…';
        t0 = performance.now();
        const bajar = t => {
          if (modo !== 'inhibidor') return;
          const k = Math.min(1, (t - t0) / 3200);
          alturas(i => base[i] - (base[i] - 0.1 - (i % 2) * 0.03) * k);
          if (k < 1 && !sinMovimiento) requestAnimationFrame(bajar); else alturas(i => 0.1 - (i % 2) * 0.03);
        };
        requestAnimationFrame(bajar);
        luego(2200, () => { veredicto.textContent = 'Inhibidor detectado'; senal.classList.add('alerta'); ledAlerta.classList.remove('led-apagado'); estado.innerHTML = '<b>Alerta N1 en 3 segundos.</b> La señal se hunde en todos a la vez con la unidad en marcha. Aviso enviado a tu central.'; });
        luego(4200, () => { ledCom.classList.add('led-apagado'); estado.innerHTML = '<b>N2:</b> se perdió la red. Nervik sigue registrando dentro de la unidad y enviará el expediente al volver la señal.'; });
        luego(9000, () => { modo = 'normal'; alturas(i => base[i]); normal(); });
      }
    }));
  })();

  // ======================================================================
  // 6) Pestañas de la app
  // ======================================================================
  (function pestanas() {
    const img = $('vista-app'); if (!img) return;
    const tabs = [...document.querySelectorAll('.pestanas [role=tab]')];
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.setAttribute('aria-selected', String(x === t)));
      img.classList.add('cambiando');
      setTimeout(() => { img.src = t.dataset.captura; img.alt = t.dataset.alt; img.classList.remove('cambiando'); }, sinMovimiento ? 0 : 180);
    }));
    tabs.forEach(t => { const i = new Image(); i.src = t.dataset.captura; });   // precarga
  })();

  // ======================================================================
  // 7) Expediente firmado de verdad: verificar y alterar
  // ======================================================================
  (async function expediente() {
    const verificar = $('exp-verificar'), alterar = $('exp-alterar'), sello = $('exp-sello'), hashEl = $('exp-hash'), hoja = $('exp-hoja'), explica = $('exp-explica');
    if (!verificar) return;
    if (!window.crypto?.subtle) {
      verificar.hidden = alterar.hidden = true; hashEl.textContent = 'SHA-256 9f3c 2a71 … a71e'; sello.textContent = 'Firma verificada'; return;
    }
    const contenido = () => [...document.querySelectorAll('#exp-linea li')].map(li => `${li.querySelector('time').textContent} ${li.querySelector('span').textContent}`).join('\n');
    const bytes = () => new TextEncoder().encode('Expediente ECO-14\n' + contenido());
    const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
    const llaves = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, llaves.privateKey, bytes());
    const mostrarHash = async () => { const h = hex(await crypto.subtle.digest('SHA-256', bytes())); hashEl.textContent = `SHA-256 ${h.slice(0, 4)} ${h.slice(4, 8)} ${h.slice(8, 12)} … ${h.slice(-8, -4)} ${h.slice(-4)}`; };
    await mostrarHash();
    let alterado = false;
    verificar.addEventListener('click', async () => {
      const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, llaves.publicKey, firma, bytes());
      hoja.classList.remove('valida', 'invalida'); void hoja.offsetWidth;
      hoja.classList.add(ok ? 'valida' : 'invalida');
      sello.textContent = ok ? '✓ Firma verificada' : '✗ Firma no válida';
      explica.textContent = ok
        ? 'La firma ECDSA P-256 corresponde a este contenido: nadie lo ha cambiado desde que el equipo lo firmó.'
        : 'El contenido ya no corresponde a la firma: alguien cambió el expediente después de que el equipo lo firmó. La aseguradora lo detecta al instante.';
    });
    alterar.addEventListener('click', async () => {
      const t = document.querySelector('#exp-linea time[data-alterable]');
      const original = t.dataset.original || t.textContent;
      t.dataset.original = original;
      alterado = !alterado;
      t.textContent = alterado ? t.dataset.alterable : original;
      t.parentElement.classList.toggle('alterada', alterado);
      alterar.textContent = alterado ? 'Regresar la hora original' : 'Cambiar la hora de la parada';
      hoja.classList.remove('valida', 'invalida');
      sello.textContent = 'Firma sin verificar';
      explica.textContent = alterado ? 'Cambiaste la hora de la parada de 02:16:41 a 02:46:41. Ahora verifica la firma.' : 'Regresaste el dato original. Verifica otra vez.';
      await mostrarHash();
    });
  })();
})();
