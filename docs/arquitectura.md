# Arquitectura y siguientes pasos

## Piezas del repositorio

```
Dispositivo (ESP32-S3, firmware en C)
      │  HTTPS · sobres firmados ECDSA P-256
      ▼
API (Node.js + Express)  ──►  Base de datos (SQLite en desarrollo → PostgreSQL/Supabase en piloto)
      │  REST + Server-Sent Events
      ▼
App del centro de control (React PWA)        Página web B2B (HTML estático)
                                                   │ formulario → POST /api/v1/prospectos
```

**API.** Recibe telemetría y expedientes, verifica firma, contador y cadena de hashes, y empuja cambios en tiempo real a la app. Tiene un vigilante que marca una unidad como **muda** cuando deja de reportar con el motor encendido: es la señal que la central sí puede ver mientras el inhibidor bloquea la red. También calcula las zonas de riesgo (modelo v0: frecuencia de expedientes por celda de ~5 km, ponderada por antigüedad).

**App.** Una sola pantalla principal que responde «¿alguna unidad está siendo atacada ahora?», con la misma estructura en estado normal y en alerta (como en los wireframes de la semana 6). Incluye detalle de unidad con la huella de señal, expedientes con verificación de firma en el navegador (WebCrypto), flujo de instalación con autoprueba y la lista de prospectos que llegan de la web. Es una PWA: se instala en el celular desde el navegador sin pasar por las tiendas.

**Web.** La landing de la semana 8, ahora con sección para aseguradoras, preguntas frecuentes y el formulario conectado a la API.

**Simulador.** Gemelo digital de la flota. Permite desarrollar y presentar la app sin hardware y sirve como implementación de referencia del protocolo para el firmware.

## Decisiones tomadas

- **PWA en lugar de app nativa.** El costo estimado en la semana 7 para Flutter/React Native era de $180,000 MXN. Una PWA cubre al centro de control (que trabaja en computadora) y a los supervisores en celular. Si después se necesita estar en Play Store, se envuelve la misma app con Capacitor.
- **ECDSA P-256 en lugar de Ed25519.** mbedTLS en el ESP32-S3 la soporta de forma nativa y WebCrypto la verifica en cualquier navegador.
- **Se firma el payload como bytes.** Evita problemas de serialización JSON entre C y JavaScript.
- **SQLite integrado en Node 22.** Cero instalación para el equipo; el esquema es SQL estándar para migrarlo a Supabase.
- **Leaflet + OpenStreetMap.** Sin costo de licencia para el MVP.

## Pendiente para el piloto

1. **Usuarios y permisos.** Hoy la central entra con una llave compartida (`CENTRAL_API_KEY`). Para el piloto: Supabase Auth con roles (central de la flota, aseguradora de solo lectura, administrador Nervik) y que cada flota vea solo sus unidades.
2. **Base de datos en la nube.** Migrar el esquema de `api/src/db.js` a Supabase (PostgreSQL); el plan gratuito alcanza para 10 unidades.
3. **Avisos push.** Hoy la alerta suena con la app abierta. Agregar Web Push para que llegue con el celular bloqueado.
4. **Recálculo de rutas.** Integrar OSRM o Valhalla y evitar los polígonos de las zonas de riesgo con mayor puntaje en el horario de salida.
5. **Modelo de riesgo v1.** Con los expedientes reales del piloto, entrenar un modelo que use tramo, hora, día y tipo de carga en lugar de solo frecuencia.
6. **Firmware.** Implementar `docs/protocolo.md` en el ESP32-S3 y probar contra esta misma API.
7. **Despliegue.** API en Railway, Render o Fly.io; app en Vercel o Netlify; web en GitHub Pages. Cambiar `web/config.js` a la URL pública de la API.
