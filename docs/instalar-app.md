# Cómo instalar la app de Nervik

La app del centro de control es una **app web instalable** (PWA): se instala desde el navegador, sin Play Store ni App Store, y queda con su ícono en el celular o en la computadora. Para que el navegador ofrezca instalarla, la app tiene que abrirse desde una dirección **https://** (o desde `localhost` en la propia computadora).

## 1. Tener la app en línea (una sola vez)

### Opción A — Render, dirección fija (recomendada)

1. Entren a [render.com](https://render.com) con su cuenta de GitHub.
2. **New → Blueprint** y elijan el repositorio `Andrik-09/Nervik`. Render lee `render.yaml` y crea el servicio solo.
3. Al terminar les da una dirección como `https://nervik-xxxx.onrender.com`:
   - Página web: `https://nervik-xxxx.onrender.com`
   - App: `https://nervik-xxxx.onrender.com/app`
4. La llave de la central está en Render → servicio → **Environment → CENTRAL_API_KEY**. Esa es la que se escribe al entrar a la app.
5. En el firmware, pongan esa dirección en `API_URL`.

En el plan gratuito el servicio se duerme tras 15 minutos sin uso (tarda cerca de un minuto en despertar) y los datos se borran cuando se vuelve a desplegar. Para la demostración basta; para el piloto hay que pasar la base de datos a Supabase.

### Opción B — Desde su computadora con un túnel (para una clase)

```bash
npm install
npm run prototipo     # deja la API, la web y la app en http://localhost:3000
npm run tunel         # en otra terminal: imprime una dirección https://….trycloudflare.com
```

Esa dirección https funciona mientras la computadora esté encendida y las dos terminales abiertas. Cambia cada vez que se corre el túnel.

## 2. Instalarla

### Android (Chrome)

1. Abran `https://…/app` en **Chrome**.
2. Entren con la llave de la central.
3. Toquen el menú **⋮ → Instalar app** (en algunos teléfonos dice **Agregar a la pantalla principal**).
4. Abran **Nervik** desde su ícono y toquen **Activar avisos** para recibir las alertas.

### iPhone (Safari)

1. Abran `https://…/app` en **Safari** (en iPhone solo Safari permite instalar).
2. Toquen **Compartir** (cuadro con flecha) → **Agregar a pantalla de inicio** → **Agregar**.
3. Abran **Nervik** desde el ícono y entren con la llave. Los avisos en iPhone requieren iOS 16.4 o posterior y que la app esté instalada.

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
