// Portada: monta el dispositivo en 3D y cuenta, una sola vez, lo que pasa durante un ataque.
// Sin WebGL, o con "reducir movimiento", se queda la imagen fija y las tres notas visibles.
const escenario = document.getElementById('escenario');
const lienzo = document.getElementById('lienzo-3d');
const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const chips = [...escenario.querySelectorAll('.chips li')];

// La cabecera es transparente sobre la portada y se vuelve sólida al bajar
const cabecera = document.querySelector('.cabecera.sobre-portada');
if (cabecera) {
  const revisar = () => cabecera.classList.toggle('solida', window.scrollY > 24);
  revisar();
  window.addEventListener('scroll', revisar, { passive: true });
}

function contar(dispositivo) {
  if (sinMovimiento) { chips.forEach(c => c.classList.add('visible')); dispositivo?.alerta(true); escenario.classList.add('atacado'); return; }
  setTimeout(() => { escenario.classList.add('atacado'); dispositivo?.alerta(true); }, 1600);
  chips.forEach((c, i) => setTimeout(() => c.classList.add('visible'), 2300 + i * 1300));
  // la alerta se apaga cuando llega el expediente: el ataque terminó y quedó registrado
  setTimeout(() => { dispositivo?.alerta(false); escenario.classList.add('registrado'); }, 2300 + chips.length * 1300 + 600);
}

function webglDisponible() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

(async () => {
  if (!webglDisponible()) { contar(null); return; }
  try {
    const { montar } = await import('./dispositivo3d.js');
    const d = await montar(lienzo, { movimiento: !sinMovimiento });
    lienzo.classList.add('con-3d');
    contar(d);
  } catch {
    contar(null);
  }
})();
