import { useSyncExternalStore } from 'react';

// Store mínima: estado compartilhado entre o HTML e a cena 3D sem dependência extra.
export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set: (patch) => {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      subs.forEach((f) => f());
    },
    subscribe: (f) => (subs.add(f), () => subs.delete(f)),
  };
}
export const useStore = (store, sel = (s) => s) =>
  useSyncExternalStore(store.subscribe, () => sel(store.get()));

// Posição do scroll em "índice de estação" contínuo, lida pela cena a cada quadro (não re-renderiza React).
export const scroll = { focus: 0, active: 0 };

const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const ui = createStore({
  lightbox: null,
  dossier: null,
  video: null, // id do projeto cujo vídeo deve tocar na sala de vídeos
  reduced,
});

if (import.meta.env.DEV || location.search.includes('teste')) window.__ui = ui; // ?teste: ganchos para os testes automáticos
