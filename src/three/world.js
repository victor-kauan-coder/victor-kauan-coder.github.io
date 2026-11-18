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
function nearestRoad(x, z) {
  let best = 1e9, bi = 0;
  for (let i = 0; i < samples.length; i += 2) { const d = (samples[i].p.x - x) ** 2 + (samples[i].p.z - z) ** 2; if (d < best) { best = d; bi = i; } }
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
  const { d, i } = nearestRoad(x, z);
  const rh = smoothH[i] - 0.5;
  const k = THREE.MathUtils.smoothstep(d, ROAD_W * 0.6, ROAD_W * 2.6);
  h = THREE.MathUtils.lerp(rh, h, k);
  for (const s of stops) {
    const dd = Math.hypot(x - s.c.x, z - s.c.z);
    if (dd < 26) h = THREE.MathUtils.lerp(s.h, h, THREE.MathUtils.smoothstep(dd, 14, 26));
  }
  return h;
}
// altura de cada platô = altura da estrada ali
stops.forEach((s) => { const { i } = nearestRoad(s.road.x, s.road.z); s.h = smoothH[i] - 0.1; s.c.y = s.h; s.road.y = s.h; });
samples.forEach((s, i) => { s.p.y = smoothH[i]; });
export const roadPoints = samples.map((s) => s.p);
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

// Obstáculos estáticos para o carro (casas, árvores, pedras, móveis dos lugares): círculos numa grade espacial.
const OB_CELL = 24;
const grid = new Map();
export function addObstacle(x, z, r) {
  const k = `${Math.floor(x / OB_CELL)},${Math.floor(z / OB_CELL)}`;
  if (!grid.has(k)) grid.set(k, []);
  grid.get(k).push({ x, z, r });
}
export function nearObstacles(x, z) {
  const cx = Math.floor(x / OB_CELL), cz = Math.floor(z / OB_CELL), out = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const l = grid.get(`${cx + i},${cz + j}`); if (l) out.push(...l); }
  return out;
}
// a área de móveis de cada lugar (atrás, longe da estrada) é sólida; a frente fica livre para os objetos com física
stops.forEach((s) => {
  const back = s.c.clone().addScaledVector(s.n, 3);
  addObstacle(back.x, back.z, 5.2);
});
