import { createContext, Suspense, useContext, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SIZE, height, surface, roadPoints, stops, rng, isFree, road, addObstacle, removeObstacle, movers, addFlat, sky } from './world.js';
import { Character } from './Actors.jsx';
import { tex } from '../data/projects.js';
import { ui } from '../store.js';
import { useModel } from './loaders.js';
import { Terrain, Grass } from './Ground.jsx';

// Modelos low-poly da Kenney (kenney.nl, CC0). Cada um tem poucas centenas de triângulos.
export const MODEL = (n) => tex(`k/${n}.glb`);

// Dentro de um lugar, todo modelo vira obstáculo sólido para o carro (pela caixa envolvente real).
export const SolidCtx = createContext(false);
const _box = new THREE.Box3(), _size = new THREE.Vector3(), _c = new THREE.Vector3();
export function useSolid(ref, on, shrink = 0.85) {
  const done = useRef(null);
  useFrame(() => {
    if (!on || done.current || !ref.current) return;
    ref.current.updateWorldMatrix(true, true);
    _box.setFromObject(ref.current);
    if (_box.isEmpty()) return;
    _box.getSize(_size); _box.getCenter(_c);
    // objetos no alto (cordão de luzes, bandeiras) e no chão (tapete) não bloqueiam o carro
    const ground = height(_c.x, _c.z);
    if (_box.min.y - ground > 1.2 || _size.y < 0.15) { done.current = true; return; }
    done.current = addObstacle(_c.x, _c.z, Math.max(0.35, Math.max(_size.x, _size.z) * 0.5 * shrink));
  });
  useEffect(() => () => { if (done.current && done.current !== true) removeObstacle(done.current); }, []);
}

export function Model({ name, shadow = true, solid, ...props }) {
  const { scene } = useModel(MODEL(name));
  const ctx = useContext(SolidCtx);
  const ref = useRef();
  useSolid(ref, solid ?? ctx);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if (o.isMesh) { o.castShadow = shadow; o.receiveShadow = true; }
      if (o !== c) { o.updateMatrix(); o.matrixAutoUpdate = false; } // peças internas não se mexem
    });
    return c;
  }, [scene, shadow]);
  return <primitive ref={ref} object={obj} {...props} />;
}

// Instancia as malhas de um modelo em N posições (uma chamada de desenho por malha).
// O mundo é dividido em regiões de 120 m: cada região é um InstancedMesh com esfera envolvente própria,
// então o frustum culling descarta as regiões fora da tela.
const CELL = 180;
function useParts(name) {
  const { scene } = useModel(MODEL(name));
  return useMemo(() => {
    const out = [];
    scene.updateMatrixWorld(true);
    scene.traverse((o) => { if (o.isMesh) out.push({ geo: o.geometry, mat: o.material, local: o.matrixWorld.clone() }); });
    return out;
  }, [scene]);
}
function Chunk({ parts, items, shadow }) {
  const refs = useRef([]);
  useEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    parts.forEach((p, k) => {
      const im = refs.current[k];
      if (!im) return;
      items.forEach((it, i) => {
        q.setFromEuler(e.set(0, it.r, 0));
        m.compose(v.set(it.x, it.y, it.z), q, sc.set(it.s, it.s, it.s)).multiply(p.local);
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    });
  }, [parts, items]);
  return parts.map((p, k) => (
    <instancedMesh key={k} ref={(r) => (refs.current[k] = r)} args={[p.geo, p.mat, items.length]} castShadow={shadow} receiveShadow matrixAutoUpdate={false} />
  ));
}
// Aquecimento: depois que a natureza carregou, compila todos os shaders e envia as texturas de uma vez
// (com tudo visível). Só depois disso o recorte por distância passa a valer: nada compila no meio da corrida.
export const warm = { done: false };
function Warmup() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let cancel = false;
    const run = async () => {
      const compile = () => (gl.compileAsync ? gl.compileAsync(scene, camera) : gl.compile(scene, camera));
      try {
        await compile();
        // compila também a versão com as luzes da noite (assim virar noite não trava)
        nightPrep.on = true; scene.traverse((o) => { if (o.isLight && o.type !== 'DirectionalLight' && o.type !== 'HemisphereLight') { let g = o.parent; while (g && !g.isScene) { g.visible = true; g = g.parent; } } });
        await compile();
      } catch { /* segue */ }
      nightPrep.on = false;
      scene.traverse((o) => { const m = o.material; if (!m) return; (Array.isArray(m) ? m : [m]).forEach((mm) => { for (const k of ['map', 'normalMap', 'emissiveMap']) if (mm[k]) gl.initTexture(mm[k]); }); });
      if (!cancel) setTimeout(() => { warm.done = true; }, 300);
    };
    run();
    return () => { cancel = true; };
  }, [gl, scene, camera]);
  return null;
}

export function Scatter({ name, items, shadow = false, far = 650 }) {
  const parts = useParts(name);
  const chunks = useMemo(() => {
    const map = new Map();
    items.forEach((it) => { const k = `${Math.floor(it.x / CELL)},${Math.floor(it.z / CELL)}`; if (!map.has(k)) map.set(k, []); map.get(k).push(it); });
    return [...map.values()].map((list) => ({ list, cx: list.reduce((a, b) => a + b.x, 0) / list.length, cz: list.reduce((a, b) => a + b.z, 0) / list.length }));
  }, [items]);
  // só desenha a região que está a menos de `far` metros da câmera: flor lá longe não vale uma chamada de desenho
  const groups = useRef([]);
  useFrame(({ camera }) => {
    if (!warm.done) return; // até compilar tudo, fica tudo visível
    const lim = far + CELL * 0.7;
    chunks.forEach((c, i) => { const g = groups.current[i]; if (g) g.visible = Math.hypot(camera.position.x - c.cx, camera.position.z - c.cz) < lim; });
  });
  if (!items.length) return null;
  return chunks.map((c, i) => <group key={i} ref={(r) => (groups.current[i] = r)}><Chunk parts={parts} items={c.list} shadow={shadow} /></group>);
}

// ---------- Estrada: faixa escura com bordas brancas e tracejado amarelo ----------
function Road() {
  const geos = useMemo(() => {
    const strip = (w0, w1, lift, dash) => {
      const pos = [], idx = [];
      let dist = 0;
      roadPoints.forEach((p, i) => {
        const nxt = roadPoints[Math.min(i + 1, roadPoints.length - 1)], prv = roadPoints[Math.max(i - 1, 0)];
        const t = new THREE.Vector3().subVectors(nxt, prv).setY(0).normalize();
        const n = new THREE.Vector3(-t.z, 0, t.x);
        if (i) dist += p.distanceTo(prv);
        const y = p.y + lift;
        pos.push(p.x + n.x * w0, y, p.z + n.z * w0, p.x + n.x * w1, y, p.z + n.z * w1);
        if (i < roadPoints.length - 1 && (!dash || Math.floor(dist / 3) % 2 === 0)) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    // saia lateral: fecha o vão entre a borda do asfalto e o chão (sem estrada "flutuando")
    const skirt = (w) => {
      const pos = [], idx = [];
      roadPoints.forEach((p, i) => {
        const nxt = roadPoints[Math.min(i + 1, roadPoints.length - 1)], prv = roadPoints[Math.max(i - 1, 0)];
        const t = new THREE.Vector3().subVectors(nxt, prv).setY(0).normalize();
        const x = p.x - t.z * w, z = p.z + t.x * w;
        pos.push(x, p.y + 0.12, z, x, p.y - 0.9, z);
        if (i < roadPoints.length - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
    };
    return { skirtL: skirt(-3.8), skirtR: skirt(3.8), road: strip(-3.8, 3.8, 0.12, false), l: strip(-3.6, -3.35, 0.14, false), r: strip(3.35, 3.6, 0.14, false), mid: strip(-0.1, 0.1, 0.14, true) };
  }, []);
  return (
    <group>
      <mesh geometry={geos.skirtL}><meshStandardMaterial color="#3a3d47" side={THREE.DoubleSide} /></mesh>
      <mesh geometry={geos.skirtR}><meshStandardMaterial color="#3a3d47" side={THREE.DoubleSide} /></mesh>
      <mesh geometry={geos.road} receiveShadow><meshStandardMaterial color="#4b4f5c" roughness={0.9} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} /></mesh>
      <mesh geometry={geos.l}><meshStandardMaterial color="#f4f4f4" side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} /></mesh>
      <mesh geometry={geos.r}><meshStandardMaterial color="#f4f4f4" side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} /></mesh>
      <mesh geometry={geos.mid}><meshStandardMaterial color="#ffd23f" side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} /></mesh>
    </group>
  );
}

// ---------- Vegetação, pedras, casas: posições fixas (semente), fora da estrada e dos lugares ----------
function useScatter(seed, n, minScale, maxScale, margin = 6, clusters = 0, spread = 45) {
  return useMemo(() => {
    const r = rng(seed), out = [];
    const centers = Array.from({ length: clusters }, () => [(r() - 0.5) * SIZE * 0.85, (r() - 0.5) * SIZE * 0.85]);
    let tries = 0;
    while (out.length < n && tries++ < n * 25) {
      let x = (r() - 0.5) * SIZE * 0.92, z = (r() - 0.5) * SIZE * 0.92;
      if (clusters && r() < 0.8) { const [cx, cz] = centers[Math.floor(r() * clusters)]; const a = r() * 6.28, d = Math.sqrt(r()) * spread; x = cx + Math.cos(a) * d; z = cz + Math.sin(a) * d; }
      if (!isFree(x, z, margin)) continue;
      out.push({ x, z, y: height(x, z) - 0.05, s: minScale + r() * (maxScale - minScale), r: r() * Math.PI * 2 });
    }
    return out;
  }, [seed, n, minScale, maxScale, margin, clusters, spread]);
}
// divide uma lista entre vários modelos (variedade sem custo extra)
const split = (list, k) => Array.from({ length: k }, (_, j) => list.filter((_, i) => i % k === j));

// Casinhas à beira da estrada, de frente para ela.
function Houses() {
  const items = useMemo(() => {
    const r = rng(91), out = [];
    for (let i = 20; i < roadPoints.length - 20; i += 11) {
      if (r() < 0.45) continue;
      const p = roadPoints[i], q = roadPoints[i + 1];
      const t = new THREE.Vector3().subVectors(q, p).setY(0).normalize();
      const side = r() < 0.5 ? 1 : -1;
      const n = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(side);
      const x = p.x + n.x * 17, z = p.z + n.z * 17;
      if (stops.some((s) => Math.hypot(x - s.c.x, z - s.c.z) < 30)) continue;
      out.push({ x, z, y: height(x, z) - 0.1, s: 7, r: Math.atan2(-n.x, -n.z) });
      addObstacle(x, z, 5);
    }
    return out;
  }, []);
  const names = ['building-type-a', 'building-type-c', 'building-type-e', 'building-type-g', 'building-type-j', 'building-type-m', 'building-type-o', 'building-type-q', 'building-type-s'];
  const groups = split(items, names.length);
  return names.map((n, i) => <Scatter key={n} name={n} items={groups[i]} shadow />);
}

// ---------- Áreas temáticas no caminho: vila, acampamento e fazenda (registradas como chão plano) ----------
const roadSpot = (t, off) => { const p = road.getPointAt(t), tg = road.getTangentAt(t); return { x: p.x - tg.z * off, z: p.z + tg.x * off, tan: tg }; };
export const AREAS = {
  vila: { ...roadSpot(0.335, 58), r: 46 },
  acampamento: { ...roadSpot(0.62, -48), r: 26 },
  fazenda: { ...roadSpot(0.2, -55), r: 40 },
};
Object.values(AREAS).forEach((a) => addFlat(a.x, a.z, a.r));

export function Nature() {
  const low = ui.get().lowPower;
  const trees = useScatter(11, low ? 450 : 1100, 4, 7.5, 7, 26, 60);
  const bushes = useScatter(23, low ? 300 : 800, 3, 5, 4, 20);
  const flowers = useScatter(61, low ? 800 : 2600, 3, 5, 2, 50, 28);
  const rocks = useScatter(37, 200, 2.5, 6.5, 6);
  const props = useScatter(53, 150, 2.5, 4, 6, 10);
  const tN = ['tree_default', 'tree_oak', 'tree_fat', 'tree_pineRoundA', 'tree_pineTallA', 'tree_palm', 'tree_palmTall', 'tree_detailed', 'tree_blocks_fall'];
  const fN = ['flower_redA', 'flower_yellowA', 'flower_purpleA', 'flower_redB', 'flower_yellowB'];
  const bN = ['plant_bushLarge', 'plant_bush', 'plant_bushDetailed'];
  const rN = ['rock_largeA', 'rock_largeC', 'rock_tallA', 'rock_smallA'];
  const pN = ['mushroom_red', 'stump_round', 'log', 'crop_pumpkin'];
  useMemo(() => { trees.forEach((t) => addObstacle(t.x, t.z, 0.25 * t.s)); rocks.forEach((t) => addObstacle(t.x, t.z, 0.35 * t.s)); }, [trees, rocks]);
  const T = split(trees, tN.length), F = split(flowers, fN.length), B = split(bushes, bN.length), R = split(rocks, rN.length), P = split(props, pN.length);
  return (
    <group>
      {tN.map((n, i) => <Scatter key={n} name={n} items={T[i]} far={520} />)}
      {fN.map((n, i) => <Scatter key={n} name={n} items={F[i]} far={160} />)}
      {bN.map((n, i) => <Scatter key={n} name={n} items={B[i]} far={280} />)}
      {rN.map((n, i) => <Scatter key={n} name={n} items={R[i]} far={350} />)}
      {pN.map((n, i) => <Scatter key={n} name={n} items={P[i]} far={200} />)}
      <Houses />
      <StreetLamps />
      <Town />
      <Camp />
      <Farm />
      <Warmup />
    </group>
  );
}

// Postes ao longo da estrada (modelo da Kenney). As posições ficam guardadas para as luzes da noite.
export const lampSpots = [];
function StreetLamps() {
  const items = useMemo(() => {
    const out = [];
    for (let i = 40; i < roadPoints.length - 40; i += 45) {
      const p = roadPoints[i], q = roadPoints[i + 1];
      const t = new THREE.Vector3().subVectors(q, p).setY(0).normalize();
      const side = (i / 45) % 2 ? 1 : -1, n = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(side);
      const x = p.x + n.x * 5.4, z = p.z + n.z * 5.4;
      if (stops.some((s) => Math.hypot(x - s.c.x, z - s.c.z) < 18)) continue;
      out.push({ x, z, y: height(x, z), s: 5, r: Math.atan2(-n.x, -n.z) });
      lampSpots.push(new THREE.Vector3(x - n.x * 1.2, height(x, z) + 3.8, z - n.z * 1.2));
      addObstacle(x, z, 0.4);
    }
    return out;
  }, []);
  return <Scatter name="lightPostModern" items={items} shadow far={300} />;
}

// Vila: prédios comerciais e arranha-céus em volta de uma praça, com guarda-sóis e gente andando.
function Town() {
  const a = AREAS.vila;
  const items = useMemo(() => {
    const out = [], r = rng(7);
    for (let gx = -2; gx <= 2; gx++) for (let gz = -2; gz <= 2; gz++) {
      if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1 && !(gx && gz)) continue; // praça em cruz no meio
      if (r() < 0.15) continue;
      const x = a.x + gx * 17 + (r() - 0.5) * 3, z = a.z + gz * 17 + (r() - 0.5) * 3;
      out.push({ x, z, y: height(x, z) - 0.05, s: 9, r: Math.round(r() * 4) * (Math.PI / 2) });
      addObstacle(x, z, 6.2);
    }
    return out;
  }, [a]);
  const names = ['building-a', 'building-c', 'building-e', 'building-g', 'building-h', 'building-k', 'building-m', 'building-skyscraper-a', 'building-skyscraper-c', 'building-skyscraper-e'];
  const G = split(items, names.length);
  const parasols = useMemo(() => [[-5, -4], [5, 4], [-5, 5], [6, -5]].map(([dx, dz]) => { addObstacle(a.x + dx, a.z + dz, 0.5); return { x: a.x + dx, z: a.z + dz, y: height(a.x + dx, a.z + dz), s: 5, r: 0 }; }), [a]);
  return (
    <group>
      {names.map((n, i) => <Scatter key={n} name={n} items={G[i]} shadow />)}
      <Scatter name="detail-parasol-a" items={parasols} shadow />
      <Walker name="mini-characters-character-female-a" from={[a.x - 12, a.z - 9]} to={[a.x + 12, a.z - 9]} speed={1.3} />
      <Walker name="mini-characters-character-male-a" from={[a.x + 9, a.z - 12]} to={[a.x + 9, a.z + 12]} speed={1.1} />
      <Walker name="blocky-characters-character-c" from={[a.x - 10, a.z + 9]} to={[a.x + 10, a.z + 9]} speed={1.5} scale={0.6} />
      <Walker name="mini-characters-character-female-c" from={[a.x - 9, a.z + 12]} to={[a.x - 9, a.z - 12]} speed={1.2} />
    </group>
  );
}

// Acampamento: barracas em volta da fogueira, gente sentada, lampião.
function Camp() {
  const a = AREAS.acampamento;
  const tents = useMemo(() => Array.from({ length: 5 }, (_, i) => { const ang = (i / 5) * Math.PI * 2; const x = a.x + Math.cos(ang) * 10, z = a.z + Math.sin(ang) * 10; addObstacle(x, z, 1.8); return { x, z, y: height(x, z), s: 6, r: -ang - Math.PI / 2 }; }), [a]);
  const y = height(a.x, a.z);
  useMemo(() => addObstacle(a.x, a.z, 4), [a]);
  return (
    <group>
      <Scatter name="tent-canvas" items={tents} shadow />
      <group position={[a.x, y, a.z]}>
        <Model name="campfire-pit" scale={5} solid={false} />
        <Model name="lantern" scale={2} position={[3.2, 0, -3.2]} solid={false} />
        {[0, 2.1, 4.2].map((ang, k) => (
          <Character key={k} name={['mini-characters-character-male-c', 'mini-characters-character-female-a', 'blocky-characters-character-h'][k]} anim="sit" scale={k === 2 ? 0.55 : 1} position={[Math.cos(ang) * 3, 0, Math.sin(ang) * 3]} rotation-y={-ang - Math.PI / 2} />
        ))}
      </group>
    </group>
  );
}

// Fazenda: fileiras de milho e abóbora, cerca e bichos soltos.
function Farm() {
  const a = AREAS.fazenda;
  const corn = useMemo(() => { const out = []; for (let i = -6; i <= 6; i++) for (let j = -3; j <= 3; j++) { const x = a.x + i * 2.4, z = a.z + j * 3 - 10; out.push({ x, z, y: height(x, z), s: 2.2, r: 0 }); } return out; }, [a]);
  const pumpkins = useMemo(() => { const r = rng(3), out = []; for (let k = 0; k < 24; k++) { const x = a.x + (r() - 0.5) * 30, z = a.z + 10 + r() * 14; out.push({ x, z, y: height(x, z), s: 2.4, r: r() * 6 }); } return out; }, [a]);
  const fence = useMemo(() => { const out = []; for (let i = -9; i <= 9; i++) { for (const dz of [-24, 26]) { const x = a.x + i * 2.6, z = a.z + dz; out.push({ x, z, y: height(x, z), s: 2.6, r: 0 }); addObstacle(x, z, 1.2); } } return out; }, [a]);
  return (
    <group>
      <Scatter name="crops_cornStageD" items={corn} />
      <Scatter name="crop_pumpkin" items={pumpkins} far={250} />
      <Scatter name="fence_simple" items={fence} />
      {['animal-cow', 'animal-cow', 'animal-pig', 'animal-chick', 'animal-chick', 'animal-bunny'].map((n, k) => (
        <Animal key={k} name={n} home={[a.x - 12 + k * 5, a.z + 18]} radius={8} scale={n === 'animal-chick' ? 0.35 : n === 'animal-cow' ? 1 : 0.6} seed={k + 1} />
      ))}
    </group>
  );
}

// Personagem que anda de um ponto a outro e volta (obstáculo que se move: o carro não o atravessa).
function Walker({ name, from, to, speed = 1.2, scale = 1 }) {
  const ref = useRef();
  const me = useMemo(() => ({ x: from[0], z: from[1], r: 0.6, moving: true }), [from]);
  useEffect(() => { movers.add(me); return () => movers.delete(me); }, [me]);
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  useFrame(({ clock }) => {
    const u = (clock.elapsedTime * speed) / len, k = u % 2, f = k < 1 ? k : 2 - k, dir = k < 1 ? 1 : -1;
    const x = from[0] + (to[0] - from[0]) * f, z = from[1] + (to[1] - from[1]) * f;
    ref.current.position.set(x, height(x, z), z);
    ref.current.rotation.y = Math.atan2((to[0] - from[0]) * dir, (to[1] - from[1]) * dir);
    me.x = x; me.z = z;
  });
  return <group ref={ref}><Character name={name} anim="walk" scale={scale} /></group>;
}

// Bicho solto: passeia em volta de casa e pula de leve.
function Animal({ name, home, radius, scale, seed }) {
  const ref = useRef();
  const me = useMemo(() => ({ x: home[0], z: home[1], r: 0.9, moving: true }), [home]);
  useEffect(() => { movers.add(me); return () => movers.delete(me); }, [me]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.15 + seed * 10;
    const x = home[0] + Math.sin(t * 1.3 + seed) * radius, z = home[1] + Math.cos(t * 0.9 + seed * 2) * radius * 0.6;
    const dx = Math.cos(t * 1.3 + seed) * 1.3, dz = -Math.sin(t * 0.9 + seed * 2) * 0.54;
    ref.current.position.set(x, height(x, z) + Math.abs(Math.sin(clock.elapsedTime * 6 + seed)) * 0.08, z);
    ref.current.rotation.y = Math.atan2(dx, dz);
    me.x = x; me.z = z;
  });
  return <group ref={ref}><Model name={name} scale={scale} solid={false} /></group>;
}

// ---------- Trânsito: carrinhos indo e vindo pela estrada ----------
function Car({ name, speed, offset, lane }) {
  const ref = useRef();
  const me = useMemo(() => ({ x: 0, z: 0, r: 1.7, moving: true }), []);
  useEffect(() => { movers.add(me); return () => movers.delete(me); }, [me]);
  const p = useMemo(() => new THREE.Vector3(), []), a = useMemo(() => new THREE.Vector3(), []), dir = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock, camera }) => {
    let t = (offset + clock.elapsedTime * speed) % 1; if (lane < 0) t = 1 - t;
    road.getPointAt(t, p); road.getPointAt(Math.min(0.9999, Math.max(0.0001, t + (lane < 0 ? -0.002 : 0.002))), a);
    dir.subVectors(a, p).setY(0).normalize();
    p.x += dir.z * 1.8; p.z -= dir.x * 1.8;
    p.y = surface(p.x, p.z);
    ref.current.position.copy(p);
    ref.current.rotation.y = Math.atan2(dir.x, dir.z);
    me.x = p.x; me.z = p.z;
    ref.current.visible = Math.hypot(camera.position.x - p.x, camera.position.z - p.z) < 320;
  });
  return <group ref={ref}><Model name={name} solid={false} /></group>;
}
export function Traffic() {
  const cars = [['taxi', 0.0035, 0.1, 1], ['sedan', 0.003, 0.45, -1], ['delivery', 0.0025, 0.7, 1], ['police', 0.004, 0.25, -1], ['van', 0.0028, 0.9, -1], ['tractor', 0.0018, 0.55, 1], ['suv', 0.0032, 0.33, 1], ['truck', 0.0024, 0.82, -1], ['hatchback-sports', 0.0042, 0.62, -1], ['taxi', 0.003, 0.05, -1]];
  return cars.map(([n, s, o, l], i) => <Car key={i} name={n} speed={s} offset={o} lane={l} />);
}

// ---------- Céu: dia e noite ----------
const DAY = { top: new THREE.Color('#2f8fff'), mid: new THREE.Color('#8fd3ff'), bottom: new THREE.Color('#fff1c9'), fog: new THREE.Color('#bfe6ff'), hemiSky: new THREE.Color('#bfe3ff'), hemiGround: new THREE.Color('#7ccf5a'), sun: new THREE.Color('#fff4dc') };
const NIGHT = { top: new THREE.Color('#050a1f'), mid: new THREE.Color('#13204a'), bottom: new THREE.Color('#2b2f5c'), fog: new THREE.Color('#141c3c'), hemiSky: new THREE.Color('#3a4f8f'), hemiGround: new THREE.Color('#1a2a20'), sun: new THREE.Color('#9fb6ff') };
function SkyDome() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: DAY.top.clone() }, mid: { value: DAY.mid.clone() }, bottom: { value: DAY.bottom.clone() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.7, h)) : mix(bottom, mid, smoothstep(-0.05, 0.12, h)); gl_FragColor = vec4(c, 1.0); }',
  }), []);
  const ref = useRef();
  useFrame(({ camera }) => {
    ref.current.position.copy(camera.position);
    for (const k of ['top', 'mid', 'bottom']) mat.uniforms[k].value.copy(DAY[k]).lerp(NIGHT[k], sky.k);
  });
  return <mesh ref={ref} material={mat} renderOrder={-1}><sphereGeometry args={[1300, 32, 16]} /></mesh>;
}
// Estrelas: um único Points que só aparece à noite.
function Stars() {
  const geo = useMemo(() => {
    const n = 1800, p = new Float32Array(n * 3), r = rng(17);
    for (let i = 0; i < n; i++) { const th = r() * Math.PI * 2, ph = Math.acos(0.15 + r() * 0.85); p.set([Math.sin(ph) * Math.cos(th) * 1200, Math.cos(ph) * 1200, Math.sin(ph) * Math.sin(th) * 1200], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return g;
  }, []);
  const ref = useRef(), mat = useRef();
  useFrame(({ camera }) => { ref.current.position.copy(camera.position); mat.current.opacity = sky.k; ref.current.visible = sky.k > 0.02; });
  return <points ref={ref} geometry={geo}><pointsMaterial ref={mat} size={2.2} sizeAttenuation={false} color="#ffffff" transparent fog={false} depthWrite={false} /></points>;
}
// Nuvens: modelo "cloud" do kit oficial da Kenney (CC0), instanciado e flutuando devagar.
function Clouds() {
  const items = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 50 }, () => ({ x: (r() - 0.5) * 1800, z: (r() - 0.5) * 1800, y: 160 + r() * 80, s: 16 + r() * 18, r: r() * 6.28 }));
  }, []);
  const g = useRef();
  useFrame((_, dt) => { g.current.position.x = (g.current.position.x + dt * 2) % 300; });
  return <group ref={g}><Scatter name="cloud" items={items} far={5000} /></group>;
}

// Luzes da noite: só 4 postes acesos (os mais próximos do foco) e a luz de 2 lugares.
// Número fixo de luzes: ligar e desligar não recompila shader (sem travada ao virar noite).
const _cand = [];
export const nightPrep = { on: false }; // usado pelo aquecimento para compilar a versão noturna
function NightLights() {
  const lamps = useRef([]), places = useRef([]), group = useRef();
  useFrame(({ camera }) => {
    // de dia as luzes saem da cena (cada luz custa em todo pixel); voltam ao anoitecer
    if (group.current) group.current.visible = sky.k > 0.02 || nightPrep.on;
    const f = ui.get().focusPoint || camera.position, k = sky.k;
    _cand.length = 0; for (const p of lampSpots) _cand.push([p, p.distanceToSquared(f)]); _cand.sort((a, b) => a[1] - b[1]);
    lamps.current.forEach((l, i) => { if (!l) return; const s = _cand[i]; if (s) l.position.copy(s[0]); l.intensity = k * 40; });
    const st = [...stops].sort((a, b) => a.c.distanceToSquared(f) - b.c.distanceToSquared(f));
    places.current.forEach((l, i) => { if (!l || !st[i]) return; l.position.set(st[i].c.x, st[i].h + 4.5, st[i].c.z); l.intensity = k * 70; });
  });
  return (
    <group ref={group} visible={false}>
      {[0, 1, 2, 3].map((i) => <pointLight key={`l${i}`} ref={(r) => (lamps.current[i] = r)} color="#ffd59a" intensity={0} distance={22} decay={1.6} />)}
      {[0, 1].map((i) => <pointLight key={`p${i}`} ref={(r) => (places.current[i] = r)} color="#ffc27a" intensity={0} distance={28} decay={1.5} />)}
    </group>
  );
}

// Luz: céu, grama de baixo e sol (ou lua) com sombra que acompanha o lugar em foco.
export function Atmosphere() {
  const sun = useRef(), hemi = useRef(), disc = useRef();
  const { scene } = useThree();
  const low = ui.get().lowPower;
  const SUN = useMemo(() => new THREE.Vector3(-0.45, 0.7, 0.55).normalize(), []);
  useEffect(() => { scene.fog = new THREE.Fog(DAY.fog.clone(), 200, 900); return () => { scene.fog = null; }; }, [scene]);
  useFrame(({ camera, scene: sc }, dt) => {
    sky.k = THREE.MathUtils.damp(sky.k, ui.get().night ? 1 : 0, 2.2, dt);
    const k = sky.k;
    if (sc.fog) { const y = Math.max(0, camera.position.y); sc.fog.near = (180 + y * 1.5) * (1 - k * 0.45); sc.fog.far = (900 + y * 4) * (1 - k * 0.35); sc.fog.color.copy(DAY.fog).lerp(NIGHT.fog, k); }
    hemi.current.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, k); hemi.current.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, k); hemi.current.intensity = 1.1 - k * 0.75;
    sun.current.color.copy(DAY.sun).lerp(NIGHT.sun, k); sun.current.intensity = 2.4 - k * 2.0;
    disc.current.material.color.set(k > 0.5 ? '#e8eeff' : '#fff3a8'); disc.current.scale.setScalar(1 - k * 0.45);
    const focus = ui.get().focusPoint || camera.position;
    sun.current.position.copy(focus).addScaledVector(SUN, 120);
    sun.current.target.position.copy(focus);
    sun.current.target.updateMatrixWorld();
    disc.current.position.copy(camera.position).addScaledVector(SUN, 1150);
  });
  return (
    <>
      <SkyDome />
      <Stars />
      <Clouds />
      <mesh ref={disc}><sphereGeometry args={[60, 24, 16]} /><meshBasicMaterial color="#fff3a8" fog={false} /></mesh>
      <hemisphereLight ref={hemi} args={['#bfe3ff', '#7ccf5a', 1.1]} />
      <directionalLight
        ref={sun}
        color="#fff4dc"
        intensity={2.4}
        castShadow={!low}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={10}
        shadow-camera-far={260}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
      <NightLights />
    </>
  );
}

export function World() {
  return (
    <group>
      <Terrain />
      <Road />
      <Grass />
      <Suspense fallback={null}><Nature /></Suspense>
      <Suspense fallback={null}><Traffic /></Suspense>
    </group>
  );
}

export { stops };
