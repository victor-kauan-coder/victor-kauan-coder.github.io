import * as THREE from 'three';
import { stations } from '../data/projects.js';

// Geografia do mundo: uma estrada que serpenteia por colinas, com uma parada por projeto.
// Tudo em metros. A altura do terreno é uma soma de senos (determinística, sem ruído aleatório).
export const SIZE = 900;

const rawHeight = (x, z) =>
  Math.sin(x * 0.012) * 7 + Math.cos(z * 0.01) * 6 + Math.sin((x + z) * 0.03) * 2.2 + Math.cos(x * 0.05 - z * 0.04) * 0.9 + Math.max(0, Math.hypot(x, z) - 330) * 0.35;

// Pontos de controle da estrada (planta baixa, em x/z).
const ctrl = [
  [-300, 220], [-250, 140], [-190, 60], [-150, -20], [-80, -70], [0, -40], [70, -90], [140, -40], [190, 40], [240, 110], [300, 160], [340, 240],
].map(([x, z]) => new THREE.Vector3(x, 0, z));
export const road = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
const ROAD_W = 7;

// Amostra a estrada para achatar o terreno perto dela.
const samples = road.getSpacedPoints(600).map((p) => ({ p, h: rawHeight(p.x, p.z) }));
const smoothH = samples.map((s, i) => { let a = 0, n = 0; for (let k = -8; k <= 8; k++) { const o = samples[i + k]; if (o) { a += o.h; n++; } } return a / n; });
export function nearestRoad(x, z) {
  let best = 1e9, bi = 0;
  for (let i = 0; i < samples.length; i += 2) { const d = (samples[i].p.x - x) ** 2 + (samples[i].p.z - z) ** 2; if (d < best) { best = d; bi = i; } }
  // refina com os vizinhos e mede a distância até o segmento (não só até o ponto)
  for (const j of [bi - 1, bi + 1]) { const o = samples[j]; if (!o) continue; const d = (o.p.x - x) ** 2 + (o.p.z - z) ** 2; if (d < best) { best = d; bi = j; } }
  const a = samples[bi].p, b2 = samples[Math.min(bi + 1, samples.length - 1)].p;
  const vx = b2.x - a.x, vz = b2.z - a.z, L = vx * vx + vz * vz;
  if (L > 0) { const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / L)); best = Math.min(best, (a.x + vx * t - x) ** 2 + (a.z + vz * t - z) ** 2); }
  return { d: Math.sqrt(best), i: bi };
}
// Platôs das paradas: cada lugar fica num terreno plano.
export const stops = stations.map((s, i) => {
  const t = 0.07 + (i / (stations.length - 1)) * 0.86;
  const p = road.getPointAt(t);
  const tan = road.getTangentAt(t);
  const side = i % 2 ? -1 : 1;
  const n = new THREE.Vector3(-tan.z, 0, tan.x).multiplyScalar(side); // do lado da estrada para o lugar
  const c = p.clone().addScaledVector(n, 13);
  return { id: s.id, t, road: p, tan, n, c, rotY: Math.atan2(-n.x, -n.z), h: 0 };
});
export function height(x, z) {
  let h = rawHeight(x, z);
  // 1) platôs planos dos lugares
  for (const s of stops) {
    const dd = Math.hypot(x - s.c.x, z - s.c.z);
    if (dd < 26) h = THREE.MathUtils.lerp(s.h, h, THREE.MathUtils.smoothstep(dd, 14, 26));
  }
  // 2) a estrada vence sempre: o chão fica um pouco abaixo do asfalto numa faixa larga, sem morro por cima
  const { d, i } = nearestRoad(x, z);
  const rh = smoothH[i] - 0.45;
  return THREE.MathUtils.lerp(rh, h, THREE.MathUtils.smoothstep(d, ROAD_W * 0.75, ROAD_W * 2.4));
}
// índice da estrada em frente a cada lugar (para o piloto automático seguir a estrada)
// altura de cada platô = altura da estrada ali
stops.forEach((s) => { const { i } = nearestRoad(s.road.x, s.road.z); s.ri = i; s.h = smoothH[i] - 0.1; s.c.y = s.h; s.road.y = s.h; });
samples.forEach((s, i) => { s.p.y = smoothH[i]; });
export const roadPoints = samples.map((s) => s.p);

// Altura da superfície onde algo apoia: em cima do asfalto (que fica acima do chão) ou no chão.
export const ROAD_TOP = 0.12;
export function surface(x, z) {
  const { d, i } = nearestRoad(x, z);
  const g = height(x, z);
  if (d < 4.1) return Math.max(g, smoothH[i] + ROAD_TOP);
  return g;
}
export const roadHeights = smoothH;

// Gerador pseudoaleatório com semente, para o mundo sair igual em toda visita.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
export function isFree(x, z, margin = 6) {
  if (nearestRoad(x, z).d < ROAD_W + margin) return false;
  return !stops.some((s) => Math.hypot(x - s.c.x, z - s.c.z) < 24);
}

// Obstáculos para o carro: círculos numa grade espacial (casas, árvores, pedras e cada modelo dos lugares,
// registrados pela caixa envolvente real) + obstáculos que se movem (os carros do trânsito).
const OB_CELL = 24;
const grid = new Map();
const key = (x, z) => `${Math.floor(x / OB_CELL)},${Math.floor(z / OB_CELL)}`;
export function addObstacle(x, z, r) {
  const o = { x, z, r, k: key(x, z) };
  if (!grid.has(o.k)) grid.set(o.k, []);
  grid.get(o.k).push(o);
  return o;
}
export function removeObstacle(o) {
  const l = grid.get(o.k); if (!l) return;
  const i = l.indexOf(o); if (i >= 0) l.splice(i, 1);
}
export const movers = new Set();
const near = [];
export function nearObstacles(x, z) {
  near.length = 0;
  const cx = Math.floor(x / OB_CELL), cz = Math.floor(z / OB_CELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const l = grid.get(`${cx + i},${cz + j}`); if (l) for (const o of l) near.push(o); }
  for (const m of movers) if (Math.abs(m.x - x) < 30 && Math.abs(m.z - z) < 30) near.push(m);
  return near;
}
