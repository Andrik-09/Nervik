// Carga ../.env (raíz del repositorio) si existe. Se importa antes que todo lo demás.
import { fileURLToPath } from 'node:url';
const ruta = fileURLToPath(new URL('../../.env', import.meta.url));
try { process.loadEnvFile(ruta); } catch { /* sin .env: se usan los valores por defecto */ }
