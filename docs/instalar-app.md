# Cómo instalar la app de Nervik

La app del centro de control es una **app web instalable** (PWA): se instala desde el navegador, sin Play Store ni App Store, y queda con su ícono en el celular o en la computadora. Para que el navegador ofrezca instalarla, la app tiene que abrirse desde una dirección **https://** (o desde `localhost` en la propia computadora).

## 1. Dónde está la app

### Ya publicada en GitHub Pages

- Página web: **https://andrik-09.github.io/Nervik/** (manda a `/Nervik/web/`)
- App: **https://andrik-09.github.io/Nervik/web/app/**

GitHub Pages solo publica archivos; no corre el servidor. Por eso, al entrar a la app desde GitHub hay dos opciones:

- **Entrar a la demostración:** flota simulada de 6 tractocamiones en el navegador (mapa, alertas, protocolo de respuesta, expedientes con firma real, pruebas y diagnóstico). El botón «Lanzar ataque de prueba» enciende un inhibidor simulado cuando quieras. No necesita nada más.
- **Entrar a mi central:** escriben la dirección del servidor (Render, cuando lo tengan) y la llave. Así la app de GitHub se conecta a los datos reales y al prototipo.

Cada vez que se sube un cambio a `main` con la app compilada (`npm run build`), GitHub actualiza la página en uno o dos minutos.

Cuando publiquen la API en Render, pongan su dirección en `web/config.js` (`NERVIK_API_PUBLICA`) para activar el carrito y el formulario de contacto de la página de GitHub.

### Opción A — Render, dirección fija con servidor

1. Entren a [render.com](https://render.com) con su cuenta de GitHub.
2. **New → Blueprint** y elijan el repositorio `Andrik-09/Nervik`. Render lee `render.yaml` y crea el servicio solo.
3. Al terminar les da una dirección como `https://nervik-xxxx.onrender.com`:
   - Página web: `https://nervik-xxxx.onrender.com`
   - App: `https://nervik-xxxx.onrender.com/app`
4. La llave de la central está en Render → servicio → **Environment → CENTRAL_API_KEY**. Esa es la que se escribe al entrar a la app.
5. En el firmware, pongan esa dirección en `API_URL`.

En el plan gratuito el servicio se duerme tras 15 minutos sin uso (tarda cerca de un minuto en despertar) y los datos se borran cuando se vuelve a desplegar. Para la demostración basta; para el piloto hay que pasar la base de datos a Supabase.

### Opción B — Desde su computadora con un túnel (para una clase con el prototipo)

```bash
npm install
npm run prototipo     # deja la API, la web y la app en http://localhost:3000
npm run tunel         # en otra terminal: imprime una dirección https://….trycloudflare.com
```

Esa dirección https funciona mientras la computadora esté encendida y las dos terminales abiertas. Cambia cada vez que se corre el túnel.

## 2. Instalarla

### Android (Chrome)

1. Abran **https://andrik-09.github.io/Nervik/web/app/** en **Chrome** (o la dirección `/app` de Render).
2. Toquen **Entrar a la demostración**, o entren a su central con la dirección del servidor y la llave.
3. Toquen el menú **⋮ → Instalar app** (en algunos teléfonos dice **Agregar a la pantalla principal**).
4. Abran **Nervik** desde su ícono y en **Ajustes** activen las notificaciones para recibir las alertas (ahí también está el botón «Instalar app»).

### iPhone (Safari)

1. Abran **https://andrik-09.github.io/Nervik/web/app/** en **Safari** (en iPhone solo Safari permite instalar).
2. Toquen **Compartir** (cuadro con flecha) → **Agregar a pantalla de inicio** → **Agregar**.
3. Abran **Nervik** desde el ícono y elijan **Entrar a la demostración** o entren a su central. Los avisos en iPhone requieren iOS 16.4 o posterior y que la app esté instalada.

### Computadora (Chrome o Edge)

1. Abran la dirección de la app.
2. En la barra de direcciones aparece el ícono de **Instalar** (una pantalla con flecha). También está en **⋮ → Transmitir, guardar y compartir → Instalar página como app**.
3. Queda como programa en el menú de inicio o en el Launchpad.

## 3. Primer uso

1. **Instalar** (paso 1 de 3): escaneen el QR que imprime el prototipo en el monitor serie, o peguen el código de alta.
2. **Paso 2**: conecten el equipo.
3. **Paso 3**: esperen la prueba automática.
4. En **Monitor** verán la unidad. Para la demostración, presionen 3 s el botón de prueba del prototipo.

## Problemas comunes

| Síntoma | Causa | Solución |
|---|---|---|
| No aparece «Instalar app» | La dirección empieza con `http://` y no es `localhost` | Usen la dirección https de Render o del túnel |
| «Llave de la central inválida» | La llave no coincide con la del servidor | En local es `dev-central`; en Render, la de **Environment** |
| La cámara no abre en el paso 1 | Falta https o permiso de cámara, o el navegador es Safari | Peguen el código de alta (Safari no lee QR desde la web) |
| El prototipo no aparece | La Pico no llega a la API | En el monitor serie escriban `estado`: revisen Wi-Fi, `API_URL` y que la computadora y la Pico estén en la misma red |
| El mapa sale gris | Sin internet en el navegador | El mapa usa OpenStreetMap; los datos siguen llegando |
