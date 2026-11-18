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
const lowPower = typeof navigator !== 'undefined' && ((navigator.hardwareConcurrency || 8) <= 4 || matchMedia('(max-width: 720px)').matches);

export const ui = createStore({
  mode: 'film', // 'film' | 'game'
  active: 0, // seção ativa (0 = abertura)
  quick: false,
  lightbox: null,
  near: null, // estação próxima no modo jogo
  reduced,
  lowPower,
});

export const led = createStore({ msg: '' });
export const sling = createStore({ knocked: 0, total: 0, shots: 0, round: 0 });

// Conquistas: guardadas só neste navegador.
const ACH_KEY = 'vk-conquistas';
let saved = [];
try { saved = JSON.parse(localStorage.getItem(ACH_KEY) || '[]'); } catch { saved = []; }
export const achievements = createStore({ got: saved, toast: null });

export const ACH = {
  'visit:termolog': 'Engenheiro de campo: visitou o TermoLOG',
  'visit:vcall': 'Ponto a ponto: visitou o Vcall',
  'visit:songv': 'Fone no ouvido: visitou o SongV',
  'visit:duckv': 'Patinho no bolso: visitou o duckV',
  'visit:farmacia': 'Balcão da farmácia: visitou Pharmavision e OrçaLink',
  'visit:voto': 'Eleitor consciente: visitou o Voto Aberto',
  'visit:esmartigado': 'Peão digital: visitou o Esmartigado',
  'visit:clock': 'Pontual: visitou o LED Clock',
  'visit:angry': 'Estilingue: visitou o Angry Birds 3D',
  alerta: 'Alarme falso? Não: disparou um alerta no TermoLOG',
  musica: 'DJ: tocou a batida do SongV',
  recado: 'Recado dado: escreveu na matriz de LED',
  torre: 'Demolidor: derrubou a torre inteira',
  piloto: 'Piloto: entrou no modo jogo',
};

export function unlock(id) {
  const s = achievements.get();
  if (s.got.includes(id) || !ACH[id]) return;
  const got = [...s.got, id];
  try { localStorage.setItem(ACH_KEY, JSON.stringify(got)); } catch { /* modo privado */ }
  achievements.set({ got, toast: { id, text: ACH[id], t: Date.now() } });
}

// só em desenvolvimento: acesso pelo console para testar
if (import.meta.env.DEV) window.__ui = ui;
