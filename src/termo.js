import { createStore } from './store.js';

// Simulação do TermoLOG: o ESP32 lê a sala a cada 1,2 s, a API grava, o painel decide o alerta.
// Mesma regra do projeto: alerta quando a leitura sai da faixa por 3 leituras seguidas.
const N = 48;
export const termo = createStore({
  ambient: 24, // o que o visitante controla (sol / ar-condicionado)
  min: 18,
  max: 28,
  temp: 23.6,
  hum: 52,
  history: Array.from({ length: N }, (_, i) => 23.4 + Math.sin(i / 5) * 0.3),
  outCount: 0,
  alert: false,
  log: [],
  seq: 0, // número da leitura, usado pela cena para disparar o pacote
  running: false,
});

let timer = null;
const fmt = (n) => n.toFixed(1).replace('.', ',');
const clock = () => new Date().toLocaleTimeString('pt-BR', { hour12: false });

function step() {
  const s = termo.get();
  const temp = s.temp + (s.ambient - s.temp) * 0.22 + (Math.random() - 0.5) * 0.25;
  const hum = Math.max(30, Math.min(80, s.hum + (Math.random() - 0.5) * 1.2 - (temp - s.temp) * 0.8));
  const out = temp > s.max || temp < s.min;
  const outCount = out ? s.outCount + 1 : 0;
  const alert = outCount >= 3 ? true : out ? s.alert : false;
  const lines = [`${clock()}  ESP32 sala-204  POST /leituras  ${fmt(temp)} °C  ${Math.round(hum)}%`, `${clock()}  API  201 Created  leitura #${s.seq + 1} gravada`];
  if (alert && !s.alert) { lines.push(`${clock()}  ALERTA  sala-204 fora da faixa (${fmt(temp)} °C > ${s.max} °C)`); }
  if (!alert && s.alert) lines.push(`${clock()}  OK  sala-204 voltou para a faixa`);
  termo.set({ temp, hum, outCount, alert, history: [...s.history.slice(1), temp], log: [...lines.reverse(), ...s.log].slice(0, 14), seq: s.seq + 1 });
}

export function startTermo() {
  if (timer) return;
  timer = setInterval(step, 1200);
  termo.set({ running: true });
}
export function stopTermo() {
  clearInterval(timer);
  timer = null;
  termo.set({ running: false });
}
export const fmtC = fmt;
