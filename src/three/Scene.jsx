import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, PerformanceMonitor, Preload } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { stations } from '../data/projects.js';
import { scroll, ui, useStore, unlock } from '../store.js';
import { World, Atmosphere, MODEL, Model } from './World.jsx';
import { stops, road, height, surface, nearObstacles, nearestRoad, roadPoints } from './world.js';
import { PLACES, SolidPlace } from './Places.jsx';
import { initLoaders, useModel } from './loaders.js';

const NONE = [];
const FAR = ['tree_default', 'tree_oak', 'tree_palm', 'flower_redA', 'grass_large', 'building-type-a', 'taxi', 'race'];

// ---------- Marcadores dos lugares (bandeiras quadriculadas girando no alto) ----------
function Beacon({ i, show }) {
  const s = stations[i], st = stops[i];
  const ref = useRef();
  const label = useRef();
  useFrame(({ clock, camera }) => {
    ref.current.position.y = st.h + 12 + Math.sin(clock.elapsedTime * 1.5 + i) * 0.5; ref.current.rotation.y += 0.01;
    // dirigindo: só mostra o nome dos lugares a uma distância útil (nem colado, nem do outro lado do mapa)
    if (label.current) { const d = Math.hypot(camera.position.x - st.c.x, camera.position.z - st.c.z); label.current.style.opacity = ui.get().mode === 'game' ? (d > 30 && d < 170 ? 1 : 0) : 1; }
  });
  const go = (e) => {
    e.stopPropagation();
    if (ui.get().mode === 'game') ui.set({ target: i });
    else document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' });
  };
  return (
    <group ref={ref} position={[st.c.x, st.h + 12, st.c.z]} visible={show}>
      <group onClick={go} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')} scale={3}>
        <Model name="flagCheckers" shadow={false} solid={false} />
      </group>
      {show && (
        <Html position={[0, 5, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <span ref={label} className="node-label" style={{ '--c': s.color }}>{s.name}</span>
        </Html>
      )}
    </group>
  );
}

// ---------- Modo leitura: a câmera segue o scroll de parada em parada ----------
const up = new THREE.Vector3(0, 1, 0);
function stopPose(st, narrow) {
  const fwd = st.n.clone().negate();
  const dist = narrow ? 15 : 11;
  const p = st.c.clone().addScaledVector(fwd, dist).addScaledVector(st.tan, narrow ? 0 : 1.5).add(new THREE.Vector3(0, narrow ? 6 : 4.4, 0));
  const t = st.c.clone().add(new THREE.Vector3(0, narrow ? 0.4 : 1.6, 0)).addScaledVector(fwd, -1.5);
  if (!narrow) { const dir = t.clone().sub(p).normalize(); const r = new THREE.Vector3().crossVectors(dir, up).normalize(); t.addScaledVector(r, -3.2); }
  return { p, t };
}
function poses(narrow) {
  const list = [{ p: new THREE.Vector3(-250, 95, 330), t: new THREE.Vector3(-150, 0, 120) }];
  stops.forEach((st) => list.push(stopPose(st, narrow)));
  list.push({ p: new THREE.Vector3(420, 160, -260), t: new THREE.Vector3(60, 0, 40) });
  list.push({ p: new THREE.Vector3(0, 320, 10), t: new THREE.Vector3(0, 0, 0) });
  return list;
}
function travelPose(t0, t1, e) {
  const t = THREE.MathUtils.lerp(t0, t1, e);
  const p = road.getPointAt(t), ahead = road.getPointAt(Math.min(1, t + 0.02));
  p.y = height(p.x, p.z) + 8; ahead.y = height(ahead.x, ahead.z) + 2;
  return { p, t: ahead };
}
function Rig() {
  const { camera, size } = useThree();
  const narrow = size.width / size.height < 0.95;
  const list = useMemo(() => poses(narrow), [narrow]);
  const look = useRef(new THREE.Vector3(-150, 0, 120));
  const p = useMemo(() => new THREE.Vector3(), []), t = useMemo(() => new THREE.Vector3(), []), focus = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const f = THREE.MathUtils.clamp(scroll.focus, 0, list.length - 1);
    const i = Math.floor(f), k = f - i, e = k * k * (3 - 2 * k);
    const a = list[i], b = list[Math.min(i + 1, list.length - 1)];
    p.lerpVectors(a.p, b.p, e); t.lerpVectors(a.t, b.t, e);
    if (i >= 1 && i < stops.length) { const w = Math.sin(e * Math.PI); const tr = travelPose(stops[i - 1].t, stops[i].t, e); p.lerp(tr.p, w * 0.85); t.lerp(tr.t, w * 0.85); }
    const lam = ui.get().reduced ? 40 : 4.5;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, p.x, lam, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, p.y, lam, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, p.z, lam, dt);
    look.current.x = THREE.MathUtils.damp(look.current.x, t.x, lam, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, t.y, lam, dt);
    look.current.z = THREE.MathUtils.damp(look.current.z, t.z, lam, dt);
    camera.lookAt(look.current);
    const near = stops[Math.round(f) - 1];
    focus.copy(near ? near.c : look.current);
    ui.get().focusPoint = focus;
  });
  return null;
}

// ---------- Modo dirigir: carrinho com física cinemática que empurra os objetos ----------
function Car() {
  const body = useRef(), vis = useRef();
  const { camera } = useThree();
  const st = useRef({ speed: 0, heading: 0, keys: {}, pos: new THREE.Vector3(), wheels: [] });
  const { scene } = useModel(MODEL('race'));
  useEffect(() => {
    const s = st.current; s.wheels = [];
    vis.current.traverse((o) => { if (/wheel/i.test(o.name)) s.wheels.push(o); });
  }, [scene]);
  useEffect(() => {
    const k = st.current.keys;
    const dn = (e) => { if (e.target.tagName === 'INPUT') return; k[e.key.toLowerCase()] = true; if (e.key === 'Shift') k.shift = true; if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); };
    const upk = (e) => { k[e.key.toLowerCase()] = false; if (e.key === 'Shift') k.shift = false; };
    window.addEventListener('keydown', dn); window.addEventListener('keyup', upk);
    const s0 = stops[0], s = st.current;
    const startT = Math.max(0, s0.t - 0.03);
    road.getPointAt(startT, s.pos); s.pos.y = surface(s.pos.x, s.pos.z);
    const tan = road.getTangentAt(startT); s.heading = Math.atan2(tan.x, tan.z);
    camera.position.copy(s.pos).add(new THREE.Vector3(-tan.x * 10, 5, -tan.z * 10));
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', upk); camera.fov = 45; camera.updateProjectionMatrix(); };
  }, [camera]);
  const fwd = useMemo(() => new THREE.Vector3(), []), want = useMemo(() => new THREE.Vector3(), []), q = useMemo(() => new THREE.Quaternion(), []), eul = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);
  const camPos = useMemo(() => new THREE.Vector3(), []), camLook = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    const s = st.current, k = s.keys;
    const touch = ui.get().stick || { x: 0, y: 0 };
    let steer = (k.a || k.arrowleft ? 1 : 0) - (k.d || k.arrowright ? 1 : 0) - touch.x;
    let throttle = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0) - touch.y;
    // teletransporte: coloca o carro na estrada, de frente para o lugar
    const tp = ui.get().teleport;
    if (tp != null) {
      const st = stops[tp]; ui.set({ teleport: null, target: null });
      s.pos.copy(st.road).addScaledVector(st.n, 3.5); s.speed = 0;
      s.heading = Math.atan2(st.n.x, st.n.z);
      camera.position.copy(s.pos).addScaledVector(st.n, -9).add(new THREE.Vector3(0, 4, 0));
    }
    const target = ui.get().target;
    if (target != null) {
      // piloto automático: segue a estrada até a frente do lugar e só então entra nele
      const st = stops[target], { i, d: off } = nearestRoad(s.pos.x, s.pos.z);
      const gap = st.ri - i, toC = Math.hypot(st.c.x - s.pos.x, st.c.z - s.pos.z);
      if (toC < 10) { ui.set({ target: null }); throttle = 0; }
      else {
        if (Math.abs(gap) > 6 || off > 9) { const k = THREE.MathUtils.clamp(i + Math.sign(gap || 1) * 8, 0, roadPoints.length - 1); want.copy(roadPoints[k]); }
        else want.copy(st.c);
        want.sub(s.pos).setY(0);
        let d = Math.atan2(want.x, want.z) - s.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
        steer = THREE.MathUtils.clamp(d * 2.2, -1, 1);
        throttle = Math.abs(d) > 1.2 ? 0.3 : 1;
        if (s.speed > (Math.abs(gap) > 30 ? 24 : 12)) throttle = 0;
      }
    }
    // aceleração, freio (espaço), ré e atrito; a direção depende da velocidade, como num carro
    s.speed += throttle * dt * (throttle * s.speed < 0 ? 40 : 18);
    s.speed *= Math.pow(throttle ? 0.75 : 0.4, dt);
    if (k[' ']) s.speed *= Math.pow(0.02, dt);
    const boost = k.shift && throttle > 0;
    if (boost) s.speed += dt * 14;
    s.speed = THREE.MathUtils.clamp(s.speed, -10, boost ? 40 : 26);
    // R: volta para o ponto mais próximo da estrada
    if (k.r) { k.r = false; let best = 1e9, bt = 0; for (let t = 0; t <= 1; t += 0.002) { road.getPointAt(t, want); const d = want.distanceToSquared(s.pos); if (d < best) { best = d; bt = t; } } road.getPointAt(bt, s.pos); const tg = road.getTangentAt(bt); s.heading = Math.atan2(tg.x, tg.z); s.speed = 0; }
    s.heading += steer * dt * 2.1 * THREE.MathUtils.clamp(s.speed / 8, -1, 1);
    fwd.set(Math.sin(s.heading), 0, Math.cos(s.heading));
    s.pos.addScaledVector(fwd, s.speed * dt);
    // colisão com o cenário: empurra o carro para fora e devolve parte da velocidade (batida)
    for (const o of nearObstacles(s.pos.x, s.pos.z)) {
      const dx = s.pos.x - o.x, dz = s.pos.z - o.z, d = Math.hypot(dx, dz), min = o.r + 1.0;
      if (d < min && d > 0.0001) {
        s.pos.x = o.x + (dx / d) * min; s.pos.z = o.z + (dz / d) * min;
        // perde a velocidade na direção da batida; bate forte = treme a câmera
        const hit = Math.abs((fwd.x * dx + fwd.z * dz) / d);
        if (hit > 0.5 && Math.abs(s.speed) > 6) s.shake = 0.3;
        s.speed *= 1 - hit * 0.9;
      }
    }
    const lim = 410; s.pos.x = THREE.MathUtils.clamp(s.pos.x, -lim, lim); s.pos.z = THREE.MathUtils.clamp(s.pos.z, -lim, lim);
    const g = surface(s.pos.x, s.pos.z), ahead = surface(s.pos.x + fwd.x * 1.5, s.pos.z + fwd.z * 1.5);
    s.pos.y = g;
    eul.set(-Math.atan2(ahead - g, 1.5), s.heading, -steer * 0.04 * THREE.MathUtils.clamp(s.speed / 10, -1, 1));
    q.setFromEuler(eul);
    if (body.current) { body.current.setNextKinematicTranslation(s.pos); body.current.setNextKinematicRotation(q); }
    s.wheels.forEach((w) => { w.rotation.x += s.speed * dt * 2.6; });
    // câmera de perseguição suave
    camPos.copy(s.pos).addScaledVector(fwd, -9 - Math.abs(s.speed) * 0.12).add(new THREE.Vector3(0, 4.2 + Math.abs(s.speed) * 0.04, 0));
    // a câmera não entra em casas, outdoors e árvores: se o caminho carro→câmera cruza um obstáculo, ela se aproxima
    for (let k = 1; k <= 8; k++) {
      const t = k / 8, x = s.pos.x + (camPos.x - s.pos.x) * t, z = s.pos.z + (camPos.z - s.pos.z) * t;
      let blocked = false;
      for (const o of nearObstacles(x, z)) { if (!o.moving && o.r > 0.6 && Math.hypot(x - o.x, z - o.z) < o.r + 0.4) { blocked = true; break; } }
      if (blocked) { const keep = Math.max(0.35, (k - 1) / 8); camPos.x = s.pos.x + (camPos.x - s.pos.x) * keep; camPos.z = s.pos.z + (camPos.z - s.pos.z) * keep; camPos.y += (1 - keep) * 2.5; break; }
    }
    const ch = height(camPos.x, camPos.z) + 2; if (camPos.y < ch) camPos.y = ch;
    camera.position.lerp(camPos, 1 - Math.pow(0.004, dt));
    camLook.copy(s.pos).addScaledVector(fwd, 5).add(new THREE.Vector3(0, 1.2, 0));
    if (s.shake > 0) { s.shake -= dt; camera.position.x += (Math.random() - 0.5) * s.shake; camera.position.y += (Math.random() - 0.5) * s.shake; }
    camera.lookAt(camLook);
    // campo de visão abre com a velocidade: sensação de velocidade sem custo
    const fov = 45 + Math.max(0, s.speed - 8) * 0.45;
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = THREE.MathUtils.damp(camera.fov, fov, 4, dt); camera.updateProjectionMatrix(); }
    ui.get().focusPoint = s.pos;
    ui.get().car = { x: s.pos.x, z: s.pos.z, heading: s.heading, speed: s.speed, boost };
    if (import.meta.env.DEV && !window.__inside) window.__inside = () => { const c = ui.get().car; const hit = nearObstacles(c.x, c.z).filter((o) => Math.hypot(c.x - o.x, c.z - o.z) < o.r + 0.6).map((o) => `r${o.r.toFixed(1)}@${Math.hypot(c.x - o.x, c.z - o.z).toFixed(2)}`); return hit.length ? `DENTRO ${hit.join(' ')}` : 'ok'; };
    // lugares por perto: monta o que está a menos de 70 m; mostra o cartão a menos de 18 m
    let near = null; const around = [];
    stops.forEach((p, i) => { const d = Math.hypot(p.c.x - s.pos.x, p.c.z - s.pos.z); if (d < 70) around.push(i); if (d < 18) near = i; });
    const cur = ui.get();
    if (near !== cur.near) { ui.set({ near }); if (near != null) unlock(`visit:${stations[near].id}`); }
    if (around.join() !== (cur.around || []).join()) ui.set({ around });
  });
  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false}>
      <CuboidCollider args={[0.75, 0.5, 1.45]} position={[0, 0.55, 0]} />
      <primitive ref={vis} object={scene} />
    </RigidBody>
  );
}

// ---------- Lugares: cada um monta (e baixa seus modelos) só quando está perto ----------
function Places() {
  const active = useStore(ui, (s) => s.active);
  const mode = useStore(ui, (s) => s.mode);
  return stations.map((s, i) => {
    const P = PLACES[s.id];
    const st = stops[i];
    const show = true; // todos montados de início: nada carrega no meio da corrida
    return (
      <group key={s.id}>
        <Beacon i={i} show={mode === 'game' || active === 0 || active > stations.length} />
        {show && (
          <group position={st.c} rotation-y={st.rotY}>
            <RigidBody type="fixed" colliders={false}><CuboidCollider args={[22, 0.2, 22]} position={[0, -0.2, 4]} /></RigidBody>
            <Suspense fallback={null}><SolidPlace><P /></SolidPlace></Suspense>
          </group>
        )}
      </group>
    );
  });
}

export default function Scene() {
  const lowPower = ui.get().lowPower;
  const mode = useStore(ui, (s) => s.mode);
  const [dpr, setDpr] = useState(lowPower ? 1 : 1.5);
  return (
    <Canvas
      className="stage"
      dpr={dpr}
      shadows={lowPower ? false : 'soft'}
      camera={{ fov: 45, near: 0.1, far: 2400, position: [-250, 95, 330] }}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      onCreated={({ gl }) => { initLoaders(gl); FAR.forEach((n) => useModel.preload(MODEL(n))); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => !lowPower && setDpr(1.5)} />
      <Suspense fallback={null}><Atmosphere /></Suspense>
      <Suspense fallback={null}><World /></Suspense>
      <Suspense fallback={null}>
        <Physics gravity={[0, -12, 0]} timeStep={1 / 60}>
          <Places />
          {mode === 'game' && <Suspense fallback={null}><Car /></Suspense>}
        </Physics>
        {/* compila todos os shaders e envia as texturas antes de mostrar: nada de travada na primeira vez que algo aparece */}
        <Preload all />
      </Suspense>
      {mode !== 'game' && <Rig />}
    </Canvas>
  );
}
