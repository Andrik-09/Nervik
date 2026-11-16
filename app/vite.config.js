import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, /api se redirige a la API local (puerto 3000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // permite abrir la app desde el celular en la misma red Wi-Fi
    proxy: { '/api': { target: process.env.NERVIK_API || 'http://localhost:3000', changeOrigin: true } },
  },
});
