import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SIZE, height, roadPoints, stops, rng, isFree, road, addObstacle } from './world.js';
import { tex } from '../data/projects.js';
import { ui } from '../store.js';
import { useModel } from './loaders.js';
import { Terrain, Grass } from './Ground.jsx';

// Modelos low-poly da Kenney (kenney.nl, CC0). Cada um tem poucas centenas de triângulos.
export const MODEL = (n) => tex(`k/${n}.glb`);

export function Model({ name, shadow = true, ...props }) {
  const { scene } = useModel(MODEL(name));
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => { if (o.isMesh) { o.castShadow = shadow; o.receiveShadow = true; } });
    return c;
  }, [scene, shadow]);
  return <primitive object={obj} {...props} />;
}

// Instancia as malhas de um modelo em N posições (uma chamada de desenho por malha).
// O mundo é dividido em regiões de 120 m: cada região é um InstancedMesh com esfera envolvente própria,
// então o frustum culling descarta as regiões fora da tela.
const CELL = 120;
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
    <instancedMesh key={k} ref={(r) => (refs.current[k] = r)} args={[p.geo, p.mat, items.length]} castShadow={shadow} receiveShadow />
  ));
}
export function Scatter({ name, items, shadow = false }) {
  const parts = useParts(name);
  const chunks = useMemo(() => {
    const map = new Map();
    items.forEach((it) => { const k = `${Math.floor(it.x / CELL)},${Math.floor(it.z / CELL)}`; if (!map.has(k)) map.set(k, []); map.get(k).push(it); });
    return [...map.values()];
  }, [items]);
  if (!items.length) return null;
  return chunks.map((list, i) => <Chunk key={i} parts={parts} items={list} shadow={shadow} />);
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
    return { road: strip(-3.8, 3.8, 0.12, false), l: strip(-3.6, -3.35, 0.14, false), r: strip(3.35, 3.6, 0.14, false), mid: strip(-0.1, 0.1, 0.14, true) };
  }, []);
  return (
    <group>
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

export function Nature() {
  const low = ui.get().lowPower;
  const trees = useScatter(11, low ? 260 : 620, 4, 7, 7, 16, 50);
  const bushes = useScatter(23, low ? 150 : 380, 3, 5, 4, 12);
  const flowers = useScatter(61, low ? 400 : 1300, 3, 5, 2, 30, 26);
  const rocks = useScatter(37, 90, 2.5, 6, 6);
  const props = useScatter(53, 60, 2.5, 4, 6, 6);
  const tN = ['tree_default', 'tree_oak', 'tree_fat', 'tree_pineRoundA', 'tree_pineTallA', 'tree_palm', 'tree_palmTall', 'tree_detailed', 'tree_blocks_fall'];
  const fN = ['flower_redA', 'flower_yellowA', 'flower_purpleA', 'flower_redB', 'flower_yellowB'];
  const bN = ['plant_bushLarge', 'plant_bush', 'plant_bushDetailed'];
  const rN = ['rock_largeA', 'rock_largeC', 'rock_tallA', 'rock_smallA'];
  const pN = ['mushroom_red', 'stump_round', 'log', 'crop_pumpkin'];
  useMemo(() => { trees.forEach((t) => addObstacle(t.x, t.z, 0.25 * t.s)); rocks.forEach((t) => addObstacle(t.x, t.z, 0.35 * t.s)); }, [trees, rocks]);
  const T = split(trees, tN.length), F = split(flowers, fN.length), B = split(bushes, bN.length), R = split(rocks, rN.length), P = split(props, pN.length);
  return (
    <group>
      {tN.map((n, i) => <Scatter key={n} name={n} items={T[i]} shadow={!low} />)}
      {fN.map((n, i) => <Scatter key={n} name={n} items={F[i]} />)}
      {bN.map((n, i) => <Scatter key={n} name={n} items={B[i]} />)}
      {rN.map((n, i) => <Scatter key={n} name={n} items={R[i]} />)}
      {pN.map((n, i) => <Scatter key={n} name={n} items={P[i]} />)}
      <Houses />
    </group>
  );
}

// ---------- Trânsito: carrinhos indo e vindo pela estrada ----------
function Car({ name, speed, offset, lane }) {
  const ref = useRef();
  const p = useMemo(() => new THREE.Vector3(), []), a = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    let t = (offset + clock.elapsedTime * speed) % 1; if (lane < 0) t = 1 - t;
    road.getPointAt(t, p); road.getPointAt(Math.min(0.9999, Math.max(0.0001, t + (lane < 0 ? -0.002 : 0.002))), a);
    const dir = a.clone().sub(p).setY(0).normalize();
    const n = new THREE.Vector3(-dir.z, 0, dir.x);
    p.addScaledVector(n, -1.8);
    p.y = height(p.x, p.z) + 0.12;
    ref.current.position.copy(p);
    ref.current.rotation.y = Math.atan2(dir.x, dir.z);
  });
  return <group ref={ref}><Model name={name} /></group>;
}
export function Traffic() {
  const cars = [['taxi', 0.006, 0.1, 1], ['sedan', 0.005, 0.45, -1], ['delivery', 0.004, 0.7, 1], ['police', 0.0065, 0.25, -1], ['van', 0.0045, 0.9, -1], ['tractor', 0.003, 0.55, 1]];
  return cars.map(([n, s, o, l]) => <Car key={n} name={n} speed={s} offset={o} lane={l} />);
}

// ---------- Céu em degradê, sol e nuvens fofas ----------
function SkyDome() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#2f8fff') }, mid: { value: new THREE.Color('#8fd3ff') }, bottom: { value: new THREE.Color('#fff1c9') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.7, h)) : mix(bottom, mid, smoothstep(-0.05, 0.12, h)); gl_FragColor = vec4(c, 1.0); }',
  }), []);
  const ref = useRef();
  useFrame(({ camera }) => ref.current.position.copy(camera.position));
  return <mesh ref={ref} material={mat} renderOrder={-1}><sphereGeometry args={[1500, 32, 16]} /></mesh>;
}
// Nuvens: modelo "cloud" do kit oficial da Kenney (CC0), instanciado e flutuando devagar.
function Clouds() {
  const items = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 34 }, () => ({ x: (r() - 0.5) * 1100, z: (r() - 0.5) * 1100, y: 140 + r() * 60, s: 14 + r() * 16, r: r() * 6.28 }));
  }, []);
  const g = useRef();
  useFrame((_, dt) => { g.current.position.x = (g.current.position.x + dt * 2) % 300; });
  return <group ref={g}><Scatter name="cloud" items={items} /></group>;
}

// Luz: céu azul de cima, grama de baixo e um sol com sombra que acompanha o lugar em foco.
export function Atmosphere() {
  const sun = useRef();
  const { scene } = useThree();
  const low = ui.get().lowPower;
  const SUN = useMemo(() => new THREE.Vector3(-0.45, 0.7, 0.55).normalize(), []);
  useEffect(() => { scene.fog = new THREE.Fog('#bfe6ff', 160, 700); return () => { scene.fog = null; }; }, [scene]);
  useFrame(({ camera, scene: sc }) => {
    if (sc.fog) { const y = Math.max(0, camera.position.y); sc.fog.near = 140 + y * 1.5; sc.fog.far = 650 + y * 4; }
    const focus = ui.get().focusPoint || camera.position;
    sun.current.position.copy(focus).addScaledVector(SUN, 120);
    sun.current.target.position.copy(focus);
    sun.current.target.updateMatrixWorld();
  });
  return (
    <>
      <SkyDome />
      <Clouds />
      <mesh position={SUN.clone().multiplyScalar(1200)}><sphereGeometry args={[40, 24, 16]} /><meshBasicMaterial color="#fff3a8" fog={false} /></mesh>
      <hemisphereLight args={['#bfe3ff', '#7ccf5a', 1.1]} />
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
