import { createStore, unlock } from './store.js';

// Uma batida sintetizada na hora (Web Audio): nada de arquivo de música, nada de direito autoral.
export const audio = createStore({ playing: false });
let ctx, analyser, master, timer, step = 0, nextTime = 0;
export const levels = new Uint8Array(64);

const BPM = 104;
const chords = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]]; // Am F G Em
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

function env(g, t, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function kick(t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  env(g, t, 0.003, 0.3, 0.9);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.35);
}
let noiseBuf;
function hat(t, v) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 7000;
  env(g, t, 0.002, 0.05, v);
  s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + 0.1);
}
function tone(t, m, dur, type, v) {
  const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = type; o.frequency.value = hz(m); f.type = 'lowpass'; f.frequency.value = 1800;
  env(g, t, 0.01, dur, v);
  o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function schedule() {
  const spb = 60 / BPM / 4; // semicolcheia
  while (nextTime < ctx.currentTime + 0.12) {
    const s = step % 16, bar = Math.floor(step / 16) % 4, c = chords[bar];
    if (s % 4 === 0) kick(nextTime);
    if (s % 2 === 1) hat(nextTime, s % 4 === 3 ? 0.18 : 0.08);
    if (s === 0 || s === 10) tone(nextTime, c[0] - 24, 0.5, 'sawtooth', 0.22);
    if (s % 3 === 0) tone(nextTime, c[(s / 3) % 3] + 12, 0.22, 'triangle', 0.12);
    if (s === 0) c.forEach((m) => tone(nextTime, m, 1.6, 'sine', 0.06));
    nextTime += spb; step++;
  }
}
export function toggleAudio() {
  if (audio.get().playing) {
    clearInterval(timer); master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    return audio.set({ playing: false });
  }
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = ctx.createAnalyser(); analyser.fftSize = 128; analyser.smoothingTimeConstant = 0.75;
    master = ctx.createGain(); master.connect(analyser).connect(ctx.destination);
  }
  ctx.resume(); master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.05);
  nextTime = ctx.currentTime + 0.05; timer = setInterval(schedule, 25);
  audio.set({ playing: true }); unlock('musica');
}
export function readLevels() {
  if (analyser && audio.get().playing) analyser.getByteFrequencyData(levels);
  else levels.fill(0);
  return levels;
}
