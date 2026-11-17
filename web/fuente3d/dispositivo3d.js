// Dispositivo Nervik en 3D para la portada (three.js, empaquetado con esbuild en web/js/dispositivo3d.js).
// Cuña de 9 × 6 cm en PETG negro mate, con cara inclinada, tres luces al frente y cable al conector de 9 pines.
// Se puede girar arrastrando. Uso:  const d = await montar(contenedor);  d.alerta(true)
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Shape, ExtrudeGeometry, MeshStandardMaterial, Mesh,
  CylinderGeometry, TorusGeometry, CatmullRomCurve3, TubeGeometry, Vector3, PlaneGeometry, CanvasTexture,
  MeshBasicMaterial, AmbientLight, DirectionalLight, PointLight, PMREMGenerator, ACESFilmicToneMapping, SRGBColorSpace, Color,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const AMBAR = 0xffb21a;

function texturaTexto(texto) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, c.width, c.height);
  g.font = '700 150px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  g.fillStyle = 'rgba(210,210,206,0.9)';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = '28px';
  g.fillText(texto, c.width / 2, c.height / 2 + 8);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function sombraSuave() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  r.addColorStop(0, 'rgba(0,0,0,0.75)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}

function construir() {
  const equipo = new Group();
  const petg = new MeshStandardMaterial({ color: 0x101010, roughness: 0.58, metalness: 0.04 });

  // Perfil lateral de la cuña (cm): atrás 2.5 de alto, adelante 1.5
  const perfil = new Shape();
  perfil.moveTo(-4.5, 0); perfil.lineTo(4.5, 0); perfil.lineTo(4.5, 1.5); perfil.lineTo(-3.4, 2.5); perfil.lineTo(-4.5, 2.5); perfil.closePath();
  const cuerpoGeo = new ExtrudeGeometry(perfil, { depth: 6, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.16, bevelSegments: 6, curveSegments: 12 });
  cuerpoGeo.translate(0, -1.25, -3);
  const cuerpo = new Mesh(cuerpoGeo, petg);
  equipo.add(cuerpo);

  // Marca sobre la cara inclinada
  const pendiente = Math.atan2(1.5 - 2.5, 4.5 - -3.4);
  const marca = new Mesh(new PlaneGeometry(4.6, 1.15), new MeshBasicMaterial({ map: texturaTexto('NERVIK'), transparent: true, depthWrite: false }));
  const soporteMarca = new Group();
  soporteMarca.position.set(0.55, (2.0 - 1.25) + 0.175, 0);
  soporteMarca.rotation.z = pendiente;
  marca.rotation.x = -Math.PI / 2;
  marca.rotation.z = Math.PI / 2;    // se lee de frente
  soporteMarca.add(marca);
  equipo.add(soporteMarca);

  // Tres luces en la cara frontal: energía, comunicación y alerta
  const luces = [];
  [-1.2, 0, 1.2].forEach((z, i) => {
    const color = i === 2 ? AMBAR : 0xffffff;
    const mat = new MeshStandardMaterial({ color: 0x222222, emissive: new Color(color), emissiveIntensity: i === 2 ? 0 : 1.6, roughness: 0.3 });
    const led = new Mesh(new CylinderGeometry(0.17, 0.17, 0.08, 32), mat);
    led.rotation.z = Math.PI / 2;
    led.position.set(4.5 + 0.17, -0.5, z);
    const aro = new Mesh(new TorusGeometry(0.24, 0.035, 12, 40), new MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.4, metalness: 0.3 }));
    aro.rotation.y = Math.PI / 2;
    aro.position.set(4.5 + 0.17, -0.5, z);
    equipo.add(led, aro);
    luces.push(mat);
  });

  // Cable y conector Deutsch de 9 pines
  const caucho = new MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.85 });
  const curva = new CatmullRomCurve3([new Vector3(-4.6, -0.3, 0.6), new Vector3(-5.6, -0.4, 1.0), new Vector3(-6.2, -0.9, 1.9), new Vector3(-6.3, -1.4, 2.9)]);
  equipo.add(new Mesh(new TubeGeometry(curva, 48, 0.13, 16, false), caucho));
  const conector = new Group();
  const cuerpoCon = new Mesh(new CylinderGeometry(0.5, 0.5, 1.1, 40), new MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.6 }));
  const anillo = new Mesh(new CylinderGeometry(0.56, 0.56, 0.32, 40), new MeshStandardMaterial({ color: 0x4b4b4b, roughness: 0.35, metalness: 0.5 }));
  anillo.position.y = -0.35;
  conector.add(cuerpoCon, anillo);
  conector.position.set(-6.3, -1.9, 3.2);
  conector.rotation.x = 0.5;
  equipo.add(conector);

  return { equipo, luces };
}

export async function montar(contenedor, { movimiento = true } = {}) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;
  contenedor.appendChild(renderer.domElement);

  const escena = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camara = new PerspectiveCamera(28, 1, 0.1, 100);
  camara.position.set(11.5, 7.2, 18.5);
  camara.lookAt(-0.6, 0.4, 0);

  const { equipo, luces } = construir();
  const pivote = new Group();
  pivote.add(equipo);
  pivote.rotation.y = -0.55;
  escena.add(pivote);

  const sombra = new Mesh(new PlaneGeometry(16, 11), new MeshBasicMaterial({ map: sombraSuave(), transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = -1.55;
  escena.add(sombra);

  escena.add(new AmbientLight(0xffffff, 0.25));
  const clave = new DirectionalLight(0xffffff, 2.4); clave.position.set(6, 9, 8); escena.add(clave);
  const contra = new DirectionalLight(0xffffff, 2.2); contra.position.set(-8, 4, -7); escena.add(contra);
  const brilloAlerta = new PointLight(AMBAR, 0, 9, 1.6); brilloAlerta.position.set(6, 0, 1.5); equipo.add(brilloAlerta);

  function ajustar() {
    const w = contenedor.clientWidth || 1, h = contenedor.clientHeight || 1;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  }
  ajustar();
  new ResizeObserver(ajustar).observe(contenedor);

  // Arrastrar para girar
  let arrastrando = false, x0 = 0, giroUsuario = 0, giroBase = 0;
  const el = renderer.domElement;
  el.style.touchAction = 'pan-y';
  el.addEventListener('pointerdown', e => { arrastrando = true; x0 = e.clientX; giroBase = giroUsuario; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (arrastrando) giroUsuario = giroBase + (e.clientX - x0) * 0.008; });
  el.addEventListener('pointerup', () => { arrastrando = false; });

  let alerta = false, visible = true, t0 = performance.now();
  new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(contenedor);

  function cuadro(t) {
    requestAnimationFrame(cuadro);
    if (!visible) return;
    const s = (t - t0) / 1000;
    const flotar = movimiento ? Math.sin(s * 0.9) * 0.12 : 0;
    pivote.position.y = flotar;
    pivote.rotation.y = -0.55 + giroUsuario + (movimiento && !arrastrando ? Math.sin(s * 0.35) * 0.22 : 0);
    sombra.material.opacity = 0.85 - flotar * 1.2;
    // luz de alerta: parpadeo rápido en ámbar
    const encendida = alerta && (movimiento ? Math.sin(s * 9) > -0.2 : true);
    luces[2].emissiveIntensity = encendida ? 3.2 : 0;
    brilloAlerta.intensity = encendida ? 9 : 0;
    renderer.render(escena, camara);
  }
  requestAnimationFrame(cuadro);

  return { alerta: v => { alerta = !!v; }, lienzo: el };
}
