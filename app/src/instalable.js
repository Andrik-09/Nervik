// Instalación de la PWA: guarda el aviso del navegador para mostrar un botón propio de "Instalar app".
import { useEffect, useState } from 'react';

let aviso = null;
const oyentes = new Set();
const notificar = () => oyentes.forEach(f => f());

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); aviso = e; notificar(); });
window.addEventListener('appinstalled', () => { aviso = null; notificar(); });

export const instalada = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
export const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function useInstalar() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set(x => x + 1); oyentes.add(f); return () => oyentes.delete(f); }, []);
  return {
    disponible: !!aviso,
    instalada: instalada(),
    ios: esIOS(),
    instalar: async () => {
      if (!aviso) return false;
      aviso.prompt();
      const r = await aviso.userChoice.catch(() => ({}));
      aviso = null; notificar();
      return r.outcome === 'accepted';
    },
  };
}
