import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, /api se redirige a la API local (puerto 3000).
export default defineConfig({
  // Rutas relativas: la misma compilación sirve en GitHub Pages (/Nervik/app/), en Render (/app/) o en local.
  base: './',
  // Se compila dentro de la página web, para publicarse junto con ella
  build: { outDir: '../web/app', emptyOutDir: true },
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // permite abrir la app desde el celular en la misma red Wi-Fi
    proxy: { '/api': { target: process.env.NERVIK_API || 'http://localhost:3000', changeOrigin: true } },
  },
});
