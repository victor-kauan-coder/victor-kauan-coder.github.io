import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { initLoaders, useModel } from './loaders.js';
import { termo, fmtC } from '../termo.js';
import { t as tr3 } from '../i18n.js';

// O único momento 3D do site: o nó do TermoLOG montado numa placa de verdade.
// Peças reais (biblioteca 3D do KiCad) sobre uma placa com trilhas de cobre ligando cada uma;
// o display mostra a leitura da simulação ao vivo, o ESP32 solta ondas de rádio a cada envio
// e o LED acende verde na faixa e brasa no alerta, iluminando a placa.

const PARTS = [
  { m: 'lcd1602', s: 7.2, p: [-1.2, -2.6], r: 0, lift: 9, lcd: true },
  { m: 'esp32', s: 3.6, p: [-0.6, 2.2], r: 0, lift: 7 },
  { m: 'resistor', s: 2, p: [3, 2.4], r: 1.57, lift: 6 },
  { m: 'crystal', s: 1.2, p: [3.1, 0.4], r: 0, lift: 5 },
  { m: 'led', s: 1.1, p: [4.4, -0.8], r: 0, lift: 8, led: true },
];
const BOARD = { w: 16, d: 12, x: 0.4, z: 0.2, t: 0.22 };
// trilhas (x, z) entre as peças, em ângulos de 45 graus como numa placa real
const TRACES = [
  [[-1.4, 0.4], [-1.4, -1.0]], [[-0.9, 0.4], [-0.9, -1.0]], [[-0.4, 0.4], [-0.4, -1.0]], [[0.1, 0.4], [0.1, -1.0]],
  [[0.9, 2.4], [2.0, 2.4]],
  [[3.9, 2.4], [4.4, 2.4], [4.4, 0.0]],
  [[0.9, 1.2], [1.6, 0.5], [2.5, 0.5]],
  [[3.7, 0.4], [4.0, 0.4], [4.4, 0.0]],
  [[-2.6, 0.9], [-3.6, 0.9], [-4.6, 1.9], [-6.2, 1.9]],
  [[2.6, -1.2], [3.4, -2.0], [6.6, -2.0]],
];
const PACKET_PATH = [[-0.6, 0.4], [-0.6, -1.0]]; // leitura subindo do ESP32 para o display

const ease = (x) => 1 - Math.pow(1 - x, 3);
const toCanvas = (x, z, W, H) => [((x - (BOARD.x - BOARD.w / 2)) / BOARD.w) * W, ((z - (BOARD.z - BOARD.d / 2)) / BOARD.d) * H];

// textura da placa: máscara de solda verde, trilhas e ilhas de cobre, furos e serigrafia
function useBoardTextures() {
  return useMemo(() => {
    const W = 1536, H = 1152;
    const color = document.createElement('canvas'); color.width = W; color.height = H;
    const metal = document.createElement('canvas'); metal.width = W; metal.height = H;
    const c = color.getContext('2d'), m = metal.getContext('2d');
    c.fillStyle = '#0c3b2b'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.035})`; c.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    m.fillStyle = '#000'; m.fillRect(0, 0, W, H);
    const stroke = (ctx, style, w) => { ctx.strokeStyle = style; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; };
    TRACES.forEach((tr) => {
      [[c, '#b9763a', 14], [m, '#fff', 14]].forEach(([ctx, st, w]) => {
        stroke(ctx, st, w); ctx.beginPath();
        tr.forEach(([x, z], i) => { const [px, py] = toCanvas(x, z, W, H); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
        ctx.stroke();
      });
      tr.forEach(([x, z], i) => { if (i && i < tr.length - 1) return; const [px, py] = toCanvas(x, z, W, H); [[c, '#d79a55'], [m, '#fff']].forEach(([ctx, st]) => { ctx.fillStyle = st; ctx.beginPath(); ctx.arc(px, py, 17, 0, 7); ctx.fill(); }); c.fillStyle = '#071a13'; c.beginPath(); c.arc(px, py, 6, 0, 7); c.fill(); });
    });
    // furos de fixação e serigrafia
    [[-7.2, -5.4], [8, -5.4], [-7.2, 5.8], [8, 5.8]].forEach(([x, z]) => { const [px, py] = toCanvas(x, z, W, H); c.fillStyle = '#c99a5b'; c.beginPath(); c.arc(px, py, 28, 0, 7); c.fill(); c.fillStyle = '#05100c'; c.beginPath(); c.arc(px, py, 18, 0, 7); c.fill(); });
    c.fillStyle = 'rgba(235, 240, 230, 0.85)'; c.font = '600 30px ui-monospace, monospace';
    [['U1  ESP32-WROOM-32', -2.4, 4.6], ['LCD1  16x2', -4.6, -4.6], ['R1', 2.6, 3.5], ['Y1', 3.6, 1.2], ['D1', 4.9, -1.6], [tr3('TermoLOG  no de borda  rev 2'), -6.9, 5.4]].forEach(([t, x, z]) => { const [px, py] = toCanvas(x, z, W, H); c.fillText(t, px, py); });
    c.strokeStyle = 'rgba(235, 240, 230, 0.6)'; c.lineWidth = 4; c.strokeRect(...toCanvas(-7.6, -5.8, W, H), (15.9 / BOARD.w) * W, (11.8 / BOARD.d) * H);
    const map = new THREE.CanvasTexture(color); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    const metalnessMap = new THREE.CanvasTexture(metal);
    return { map, metalnessMap };
  }, []);
}

// display do LCD com a leitura ao vivo
function useLcdTexture() {
  const tex = useMemo(() => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.userData.cv = cv; return t;
  }, []);
  useEffect(() => {
    const draw = () => {
      const s = termo.get(), cv = tex.userData.cv, c = cv.getContext('2d');
      c.fillStyle = s.alert ? '#f08a3c' : '#9fd14a'; c.fillRect(0, 0, 512, 128);
      c.fillStyle = 'rgba(0,0,0,0.08)'; for (let x = 0; x < 512; x += 32) c.fillRect(x, 0, 2, 128);
      c.fillStyle = '#16210b'; c.font = '700 44px ui-monospace, monospace';
      c.fillText(`${tr3('SALA')} 204 ${s.alert ? tr3('ALERTA') : 'OK'}`, 18, 54);
      c.fillText(`${fmtC(s.temp)}C  ${Math.round(s.hum)}%UR`, 18, 106);
      tex.needsUpdate = true;
    };
    draw();
    return termo.subscribe(draw);
  }, [tex]);
  return tex;
}

function Part({ m, s, led, ledMat }) {
  const gltf = useModel(m);
  const obj = useMemo(() => {
    const rot = new THREE.Group(); rot.add(gltf.scene.clone(true));
    rot.rotation.x = -Math.PI / 2; // modelos do KiCad vêm com Z para cima
    rot.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(rot), d = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const k = s / Math.max(d.x, d.y, d.z);
    const g = new THREE.Group(); g.add(rot); g.scale.setScalar(k); g.position.set(-c.x * k, -b.min.y * k, -c.z * k);
    g.userData.h = d.y * k;
    g.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      if (led && o.material.metalness < 0.5) o.material = ledMat;
    });
    return g;
  }, [gltf, m, s, led, ledMat]);
  return <primitive object={obj} />;
}

function Rig({ progress }) {
  const { camera } = useThree();
  const look = useMemo(() => new THREE.Vector3(0.8, 0.2, 0.2), []), to = useMemo(() => new THREE.Vector3(), []);
  useFrame((st, dt) => {
    const p = progress.current, t = st.clock.elapsedTime;
    const a = -0.85 + p * 1.4 + Math.sin(t * 0.25) * 0.04, h = 12.5 - p * 4.5, r = 16 - p * 3;
    const k = 1 - Math.exp(-dt * 4);
    camera.position.lerp(to.set(Math.sin(a) * r, h, Math.cos(a) * r), k);
    camera.lookAt(look);
  });
  return null;
}

function Board({ progress }) {
  const refs = useRef([]), waves = useRef([]), packet = useRef(), light = useRef();
  const { map, metalnessMap } = useBoardTextures();
  const lcd = useLcdTexture();
  const ledMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3fbf7f', emissive: '#3fbf7f', emissiveIntensity: 0, roughness: 0.25, toneMapped: false }), []);
  const green = useMemo(() => new THREE.Color('#3fbf7f'), []), ember = useMemo(() => new THREE.Color('#ff6a3d'), []), tmp = useMemo(() => new THREE.Color(), []);
  const seq = useRef(-1), sentAt = useRef(-10);
  useFrame((st) => {
    const p = progress.current, t = st.clock.elapsedTime;
    PARTS.forEach((part, i) => {
      const o = refs.current[i]; if (!o) return;
      const k = ease(Math.min(1, Math.max(0, (p - i * 0.07) / 0.3))), u = 1 - k;
      o.position.set(part.p[0], BOARD.t + part.lift * u, part.p[1]);
      o.rotation.set(0, part.r + u * 0.9, 0);
    });
    const s = termo.get(), alert = s.alert || p > 0.78;
    tmp.copy(alert ? ember : green);
    ledMat.color.lerp(tmp, 0.1); ledMat.emissive.lerp(tmp, 0.1);
    const on = Math.min(1, Math.max(0, (p - 0.3) / 0.1));
    ledMat.emissiveIntensity = on * (alert ? 3 + Math.sin(t * 9) * 1.6 : 2.2);
    light.current.color.copy(ledMat.color); light.current.intensity = on * (alert ? 26 + Math.sin(t * 9) * 12 : 14);
    // cada leitura nova: ondas de rádio saem da antena e um pacote sobe a trilha até o display
    if (s.seq !== seq.current) { seq.current = s.seq; sentAt.current = t; }
    const e = t - sentAt.current, live = p > 0.22 ? 1 : 0;
    waves.current.forEach((w, i) => {
      if (!w) return;
      const q = Math.min(1, Math.max(0, (e - i * 0.18) / 1.1));
      w.scale.setScalar(0.4 + q * 3.2); w.material.opacity = live * (q > 0 && q < 1 ? (1 - q) * 0.85 : 0);
    });
    const q = Math.min(1, e / 0.7);
    packet.current.position.set(PACKET_PATH[0][0], BOARD.t + 0.06, PACKET_PATH[0][1] + (PACKET_PATH[1][1] - PACKET_PATH[0][1]) * q);
    packet.current.material.opacity = live * (q < 1 ? 1 : 0);
  });
  return (
    <>
      <mesh position={[BOARD.x, BOARD.t / 2, BOARD.z]} receiveShadow castShadow>
        <boxGeometry args={[BOARD.w, BOARD.t, BOARD.d]} />
        <meshStandardMaterial attach="material-0" color="#0a2a1f" roughness={0.6} />
        <meshStandardMaterial attach="material-1" color="#0a2a1f" roughness={0.6} />
        <meshStandardMaterial attach="material-2" map={map} metalnessMap={metalnessMap} metalness={1} roughness={0.42} />
        <meshStandardMaterial attach="material-3" color="#0a2a1f" roughness={0.6} />
        <meshStandardMaterial attach="material-4" color="#0d3627" roughness={0.6} />
        <meshStandardMaterial attach="material-5" color="#0d3627" roughness={0.6} />
      </mesh>
      {PARTS.map((part, i) => (
        <group key={i} ref={(o) => (refs.current[i] = o)}>
          <Suspense fallback={null}><Part {...part} ledMat={ledMat} /></Suspense>
          {part.lcd && (
            <mesh position={[0.05, 1.62, 0.05]} rotation-x={-Math.PI / 2} renderOrder={2}>
              <planeGeometry args={[4.6, 1.15]} />
              <meshBasicMaterial map={lcd} toneMapped={false} polygonOffset polygonOffsetFactor={-4} />
            </mesh>
          )}
        </group>
      ))}
      <pointLight ref={light} position={[4.4, 1.6, -0.8]} distance={9} decay={1.6} intensity={0} />
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(o) => (waves.current[i] = o)} position={[-0.6, BOARD.t + 0.9, 3.7]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.92, 1, 64]} />
          <meshBasicMaterial color="#7fd3ff" transparent opacity={0} toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={packet}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshBasicMaterial color="#ffd27f" transparent opacity={0} toneMapped={false} />
      </mesh>
    </>
  );
}

export default function Termo3D({ progress, active }) {
  return (
    <Canvas className="moment-canvas" dpr={[1, 1.25]} shadows frameloop={active ? 'always' : 'never'}
      camera={{ fov: 32, position: [-10, 13, 11] }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => { initLoaders(gl); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1; }}>
      <Rig progress={progress} />
      {/* luz quente na frente, contorno azul atrás: dá volume e cor às peças */}
      <directionalLight position={[-6, 14, 8]} intensity={2.2} color="#ffd9b8" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005}
        shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} />
      <directionalLight position={[7, 6, -9]} intensity={1.5} color="#4aa3ff" />
      <hemisphereLight args={['#bcd4ff', '#3a2412', 1.1]} />
      <Board progress={progress} />
    </Canvas>
  );
}
