# Arquitectura y siguientes pasos

## Piezas del repositorio

```
Dispositivo (RP2040 · Raspberry Pi Pico W en el prototipo)
      │  HTTPS · sobres firmados ECDSA P-256
      ▼
API (Node.js + Express)  ──►  Base de datos (SQLite en desarrollo → PostgreSQL/Supabase en piloto)
      │  REST + Server-Sent Events
      ▼
App de monitoreo (/app, PWA)                 Página web de promoción y venta (/)
                                                   │ contacto → /api/v1/prospectos · carrito → /api/v1/pedidos
```

**API.** Recibe telemetría y expedientes, verifica firma, contador y cadena de hashes, y empuja cambios en tiempo real a la app. Tiene un vigilante que marca una unidad como **muda** cuando deja de reportar con el motor encendido: es la señal que la central sí puede ver mientras el inhibidor bloquea la red. También calcula las zonas de riesgo (modelo v0: frecuencia de expedientes por celda de ~5 km, ponderada por antigüedad).

**App.** Una sola pantalla principal que responde «¿alguna unidad está siendo atacada ahora?», con la misma estructura en estado normal y en alerta (como en los wireframes de la semana 6). Incluye detalle de unidad con la huella de señal, expedientes con verificación de firma en el navegador (WebCrypto), flujo de instalación en 3 pasos y la sección de pruebas, que manda órdenes de diagnóstico al equipo y muestra su respuesta firmada. Es una PWA: se instala en el celular desde el navegador sin pasar por las tiendas.

**Web.** Página de promoción y venta: qué es Nervik, cómo funciona, la app, planes, aseguradoras, preguntas, bitácora del proyecto, canales y formulario de contacto, y tienda con carrito. El servidor calcula precios e IVA de cada pedido (no confía en el navegador) y le asigna un folio; el cobro se hace después con liga de pago o transferencia. El equipo ve pedidos y mensajes en `/admin`.

**Firmware del prototipo.** Raspberry Pi Pico W (el RP2040 del PDS) con receptor GNSS, interfaz de 3 LED y 2 botones, y opcionalmente MCP2515, LSM6DSOX y SIM7080G. Mide el C/N0 de cada satélite, corre la máquina de estados N0–N3, firma los mensajes, los guarda si no hay red y los envía en orden. Incluye un simulacro para demostrar la cadena completa sin inhibidor. Ver `prototipo.md`.

**Simulador.** Gemelo digital de la flota. Permite desarrollar y presentar la app sin hardware y sirve como implementación de referencia del protocolo para el firmware.

## Decisiones tomadas

- **PWA en lugar de app nativa (se instala desde el navegador, ver `instalar-app.md`).** El costo estimado en la semana 7 para Flutter/React Native era de $180,000 MXN. Una PWA cubre al centro de control (que trabaja en computadora) y a los supervisores en celular. Si después se necesita estar en Play Store, se envuelve la misma app con Capacitor.
- **ECDSA P-256 en lugar del HMAC del PDS (P-04).** Con HMAC la aseguradora necesitaría la llave secreta para verificar; con firma le basta la llave pública. micro-ecc la calcula en el RP2040 y WebCrypto la verifica en cualquier navegador.
- **Se firma el payload como bytes.** Evita problemas de serialización JSON entre C y JavaScript.
- **SQLite integrado en Node 22.** Cero instalación para el equipo; el esquema es SQL estándar para migrarlo a Supabase.
- **Leaflet + OpenStreetMap.** Sin costo de licencia para el MVP.

## Pendiente para el piloto

1. **Usuarios y permisos.** Hoy la central entra con una llave compartida (`CENTRAL_API_KEY`). Para el piloto: Supabase Auth con roles (central de la flota, aseguradora de solo lectura, administrador Nervik) y que cada flota vea solo sus unidades.
2. **Base de datos en la nube.** Migrar el esquema de `api/src/db.js` a Supabase (PostgreSQL); el plan gratuito alcanza para 10 unidades.
3. **Avisos push.** Hoy la alerta suena con la app abierta. Agregar Web Push para que llegue con el celular bloqueado.
4. **Recálculo de rutas.** Integrar OSRM o Valhalla y evitar los polígonos de las zonas de riesgo con mayor puntaje en el horario de salida.
5. **Modelo de riesgo v1.** Con los expedientes reales del piloto, entrenar un modelo que use tramo, hora, día y tipo de carga en lugar de solo frecuencia.
6. **Firmware.** Probar el prototipo con el SIM7080G, un bus J1939 real y la IMU; reemplazar la regla v0 por el modelo TinyML entrenado con los CSV de manejo.
7. **Cobro en línea.** Conectar Mercado Pago (Checkout Pro) o Stripe al pedido para cobrar con tarjeta desde la página, y facturación electrónica.
8. **Despliegue.** API en Railway, Render o Fly.io; app en Vercel o Netlify; web en GitHub Pages. Cambiar `web/config.js` a la URL pública de la API.
