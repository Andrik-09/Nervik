// Conecta la página con el prototipo a través de la API (GET /api/v1/demo, público).
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hora = iso => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const ESTADOS = {
    normal: ['Protegido · sin ataques', false],
    alerta: ['Alerta del equipo', true],
    muda: ['Sin señal · posible inhibidor', true],
    estacionada: ['Estacionado', false],
    sin_datos: ['Esperando el primer reporte', false],
  };
  const TIPOS = { gnss_degradado: 'Degradación GNSS', red_perdida: 'Pérdida de red', parada_no_programada: 'Parada no programada', nivel_3: 'Evento confirmado', fin_interferencia: 'Fin de la interferencia' };
  let expedienteMostrado = '';

  function hace(seg) {
    if (seg == null) return '—';
    return seg < 60 ? `hace ${seg} s` : seg < 3600 ? `hace ${Math.floor(seg / 60)} min` : `hace ${Math.floor(seg / 3600)} h`;
  }

  function pintar(d) {
    const vivo = $('vivo');
    if (!d.conectado) {
      $('v-estado').textContent = 'El prototipo está apagado en este momento';
      vivo.className = 'vivo apagado';
      return;
    }
    const apagado = d.segundos_sin_reporte > 600;
    const [texto, alerta] = apagado ? ['El prototipo está apagado en este momento', false] : (ESTADOS[d.estado] || [d.estado, false]);
    $('v-estado').textContent = `${d.dispositivo} · ${texto}${d.nivel ? ` (${d.nivel_texto})` : ''}`;
    vivo.className = 'vivo' + (alerta ? ' en-alerta' : '') + (apagado ? ' apagado' : '');
    $('v-sim').classList.toggle('hidden', !d.ultima?.simulacro || apagado);
    $('v-cn0').textContent = d.ultima?.cn0 != null ? `${d.ultima.cn0} dB-Hz` : '—';
    $('v-sats').textContent = d.ultima?.sats ?? '—';
    $('v-red').textContent = d.ultima?.rssi != null ? `${d.ultima.rssi} dBm` : (d.estado === 'muda' ? 'perdida' : '—');
    $('v-hace').textContent = hace(d.segundos_sin_reporte);

    // Si el prototipo ya generó un expediente real, sustituye al de ejemplo
    const e = d.expediente;
    if (e && e.id !== expedienteMostrado) {
      expedienteMostrado = e.id;
      $('exp').innerHTML =
        `<span class="stamp">EXPEDIENTE REAL DEL PROTOTIPO${e.simulacro ? ' · SIMULACRO' : ''}</span>` +
        `<div class="row"><span>Equipo</span><span>${esc(d.dispositivo)} · Nivel máximo N${e.nivel_max}</span></div>` +
        (e.linea_tiempo || []).map(p => `<div class="row"><span>${hora(p.ts)}</span><span><b>${esc(TIPOS[p.tipo] || p.tipo)}.</b> ${esc(p.detalle)}</span></div>`).join('') +
        `<div class="hash">Firma ${e.firma_valida ? 'verificada ✓' : 'NO válida ✗'} · SHA-256 ${esc(e.hash.slice(0, 4))}…${esc(e.hash.slice(-4))} (cualquier cambio posterior invalida la firma)</div>`;
    }
  }

  async function consultar() {
    try {
      const r = await fetch(`${window.NERVIK_API}/api/v1/demo`, { cache: 'no-store' });
      pintar(await r.json());
    } catch {
      $('v-estado').textContent = 'No hay conexión con el servidor del prototipo';
      $('vivo').className = 'vivo apagado';
    }
  }
  consultar();
  setInterval(consultar, 3000);
})();
