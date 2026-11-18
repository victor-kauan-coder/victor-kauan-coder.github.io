import * as THREE from 'three';
import { stations } from '../data/projects.js';

// Geografia do mundo: uma estrada longa que serpenteia por colinas, com uma parada por projeto
// e vilarejos, fazenda e acampamento no caminho. Tudo em metros, determinístico.
export const SIZE = 1500;
const EDGE = 600; // a partir daqui o terreno sobe em morros que fecham o mapa

const rawHeight = (x, z) =>
  Math.sin(x * 0.009) * 9 + Math.cos(z * 0.0075) * 8 + Math.sin((x + z) * 0.022) * 2.6 + Math.cos(x * 0.04 - z * 0.033) * 1.1 + Math.max(0, Math.hypot(x, z) - EDGE) * 0.45;

// Pontos de controle da estrada (planta baixa, em x/z).
const ctrl = [
  [-520, 380], [-450, 250], [-360, 120], [-300, -10], [-200, -110], [-60, -80], [60, -170], [200, -110], [290, 10], [360, 140], [460, 230], [540, 380],
].map(([x, z]) => new THREE.Vector3(x, 0, z));
export const road = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
const ROAD_W = 7;

// Amostras a cada ~1 m. A altura da estrada é uma média móvel larga (subidas suaves, sem degraus).
const N = 1800;
const samples = road.getSpacedPoints(N).map((p) => ({ p, h: rawHeight(p.x, p.z) }));
const smoothH = (() => {
  const W = 30, pre = [0];
  samples.forEach((s, i) => pre.push(pre[i] + s.h));
  return samples.map((_, i) => { const a = Math.max(0, i - W), b = Math.min(samples.length - 1, i + W); return (pre[b + 1] - pre[a]) / (b - a + 1); });
})();

// Grade espacial das amostras: achar o trecho de estrada mais próximo sem varrer as 1800 amostras.
const GC = 20, sgrid = new Map();
samples.forEach((s, i) => { const k = `${Math.floor(s.p.x / GC)},${Math.floor(s.p.z / GC)}`; if (!sgrid.has(k)) sgrid.set(k, []); sgrid.get(k).push(i); });
function segProject(j, x, z) {
  const a = samples[j].p, b = samples[Math.min(j + 1, samples.length - 1)].p;
  const vx = b.x - a.x, vz = b.z - a.z, L = vx * vx + vz * vz;
  const t = L > 0 ? Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / L)) : 0;
  return { d2: (a.x + vx * t - x) ** 2 + (a.z + vz * t - z) ** 2, t };
}
// Devolve a distância até a estrada, o índice do trecho (i) e a fração dentro dele (t).
export function nearestRoad(x, z) {
  const cx = Math.floor(x / GC), cz = Math.floor(z / GC);
  let best = 1e12, bi = -1;
  for (let r = 1; r <= 2 && bi < 0; r++) {
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      const l = sgrid.get(`${cx + i},${cz + j}`); if (!l) continue;
      for (const k of l) { const d = (samples[k].p.x - x) ** 2 + (samples[k].p.z - z) ** 2; if (d < best) { best = d; bi = k; } }
    }
  }
  if (bi < 0) { for (let k = 0; k < samples.length; k += 12) { const d = (samples[k].p.x - x) ** 2 + (samples[k].p.z - z) ** 2; if (d < best) { best = d; bi = k; } } return { d: Math.sqrt(best), i: bi, t: 0 }; }
  // refina no segmento anterior e no seguinte
  let seg = bi, pr = segProject(bi, x, z);
  if (bi > 0) { const q = segProject(bi - 1, x, z); if (q.d2 < pr.d2) { pr = q; seg = bi - 1; } }
  return { d: Math.sqrt(pr.d2), i: seg, t: pr.t };
}
const roadH = (i, t) => THREE.MathUtils.lerp(smoothH[i], smoothH[Math.min(i + 1, smoothH.length - 1)], t);

// Paradas: cada lugar fica num platô ao lado da estrada.
export const stops = stations.map((s, i) => {
  const t = 0.06 + (i / (stations.length - 1)) * 0.88;
  const p = road.getPointAt(t);
  const tan = road.getTangentAt(t);
  const side = i % 2 ? -1 : 1;
  const n = new THREE.Vector3(-tan.z, 0, tan.x).multiplyScalar(side); // da estrada para o lugar
  const c = p.clone().addScaledVector(n, 13);
  return { id: s.id, t, road: p, tan, n, c, rotY: Math.atan2(-n.x, -n.z), h: 0 };
});
stops.forEach((s) => { const r = nearestRoad(s.road.x, s.road.z); s.ri = r.i; s.h = roadH(r.i, r.t) - 0.1; s.c.y = s.h; s.road.y = s.h; });

// Áreas planas extras (vila, acampamento, fazenda), registradas por World.jsx.
export const flats = [];
export function addFlat(x, z, r, h) { flats.push({ x, z, r, h: h ?? rawHeight(x, z) }); }

export function height(x, z) {
  let h = rawHeight(x, z);
  for (const s of stops) { const dd = Math.hypot(x - s.c.x, z - s.c.z); if (dd < 26) h = THREE.MathUtils.lerp(s.h, h, THREE.MathUtils.smoothstep(dd, 14, 26)); }
  for (const f of flats) { const dd = Math.hypot(x - f.x, z - f.z); if (dd < f.r + 12) h = THREE.MathUtils.lerp(f.h, h, THREE.MathUtils.smoothstep(dd, f.r, f.r + 12)); }
  // a estrada vence sempre: o chão fica um pouco abaixo do asfalto numa faixa larga
  const { d, i, t } = nearestRoad(x, z);
  if (d > ROAD_W * 2.4) return h;
  return THREE.MathUtils.lerp(roadH(i, t) - 0.45, h, THREE.MathUtils.smoothstep(d, ROAD_W * 0.75, ROAD_W * 2.4));
}
samples.forEach((s, i) => { s.p.y = smoothH[i]; });
export const roadPoints = samples.map((s) => s.p);

// Altura da superfície onde algo apoia: em cima do asfalto (interpolado, liso) ou no chão.
export const ROAD_TOP = 0.12;
export function surface(x, z) {
  const r = nearestRoad(x, z);
  if (r.d < 3.9) return roadH(r.i, r.t) + ROAD_TOP;
  const g = height(x, z);
  if (r.d < 4.6) return Math.max(g, THREE.MathUtils.lerp(roadH(r.i, r.t) + ROAD_TOP, g, (r.d - 3.9) / 0.7));
  return g;
}

// Gerador pseudoaleatório com semente, para o mundo sair igual em toda visita.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
export function isFree(x, z, margin = 6) {
  if (nearestRoad(x, z).d < ROAD_W + margin) return false;
  if (stops.some((s) => Math.hypot(x - s.c.x, z - s.c.z) < 24)) return false;
  return !flats.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + 2);
}

// Obstáculos para o carro: círculos numa grade espacial + obstáculos que se movem (trânsito, gente, bichos).
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

// Dia (0) ou noite (1), animado pela Atmosphere e lido por quem precisa escurecer (grama, faróis).
export const sky = { k: 0 };
