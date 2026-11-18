import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { Model, SolidCtx } from './World.jsx';
import { Character, ScreenOn, ShotMat, Prop } from './Actors.jsx';
import { useTermoDashboard, useLedSign } from './live.js';
import { stations } from '../data/projects.js';
import { termo } from '../termo.js';
import { readLevels } from '../audio.js';
import { sling, unlock } from '../store.js';

// Cada lugar fica num platô ao lado da estrada. Referencial local: +z aponta para a estrada (a ~13 m),
// medidas em metros, chão em y = 0. TODOS os objetos são modelos baixados (Kenney, CC0; Poly Haven, CC0).
const S = Object.fromEntries(stations.map((s) => [s.id, s]));
const F = 2.2; // escala dos móveis da Kenney
// telas no 3D usam a versão de 1024 px (o lightbox continua com a grande)
const big = (id) => S[id].shots.filter((x) => !x.tall).map((x) => x.src.replace(/\.webp$/, '-m.webp'));
// área da tela de cada modelo baixado, em frações da caixa envolvente (calibrado olhando os modelos)
const R = {
  computerScreen: [0.08, 0.3, 0.92, 0.94],
  televisionModern: [0.05, 0.12, 0.95, 0.94],
  billboard: [0.02, 0.36, 0.98, 0.98],
  signpost: [0.08, 0.5, 0.92, 0.95],
};

// Placa com o nome do lugar desenhado num canvas, aplicado sobre a placa de madeira baixada.
function useLabel(text, sub, color) {
  return useMemo(() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 320;
    const g = c.getContext('2d');
    g.fillStyle = '#fff8ea'; g.fillRect(0, 0, 512, 320); g.fillStyle = color; g.fillRect(0, 0, 512, 22);
    g.fillStyle = '#1b1f2e'; g.font = '800 64px Unbounded, Manrope, sans-serif';
    const words = text.split(' '); let line = '', y = 120;
    words.forEach((w) => { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > 470) { g.fillText(line, 22, y); y += 70; line = w; } else line = t; });
    g.fillText(line, 22, y);
    g.fillStyle = '#4b5470'; g.font = '700 34px Manrope, sans-serif'; g.fillText(sub, 24, 292);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }, [text, sub, color]);
}

// Moldura comum: outdoor com as telas reais, placa, torres de bandeira com cordão de luzes e objetos para derrubar.
function Common({ id, sub, board = [3.8, 0, -5.6], boardRot = -0.3, props = true }) {
  const s = S[id];
  const label = useLabel(s.name, sub || s.place, s.color);
  const lights = useMemo(() => Array.from({ length: 15 }, (_, i) => -7 + i), []);
  return (
    <>
      <Model name="rugRectangle" scale={[8, 1, 7]} position={[0, 0.06, -1.4]} shadow={false} solid={false} />
      {big(id).length > 0 && <ScreenOn name="billboard" src={big(id)} rect={R.billboard} scale={6} position={board} rotation-y={boardRot} />}
      <ScreenOn name="signpost" map={label} rect={R.signpost} scale={5} position={[6.4, 0, 2.6]} rotation-y={-0.8} />
      <Model name="bannerTowerRed" scale={3.4} position={[-7.6, 0, -6.6]} />
      <Model name="bannerTowerGreen" scale={3.4} position={[7.6, 0, -6.6]} />
      {lights.map((x) => <Model key={x} name="lights-colored" scale={[1, 1.6, 1.6]} position={[x, 3.6 + Math.cos((x / 7) * 1.4) * 0.5 - 0.4, -6.6]} shadow={false} />)}
      {props && <>
        <Prop name="present-a-cube" scale={1.6} position={[-4.5, 1, 4.2]} />
        <Prop name="present-b-round" scale={1.6} position={[-3.6, 1, 5]} rotation={[0, 0.5, 0]} />
        <Prop name="barrel" scale={3} position={[4.4, 1, 4.6]} />
        <Prop name="pylon" scale={5} position={[2, 0.8, 6.2]} mass={0.3} />
        <Prop name="pylon" scale={5} position={[0, 0.8, 6.6]} mass={0.3} />
        <Prop name="pylon" scale={5} position={[-2, 0.8, 6.2]} mass={0.3} />
      </>}
    </>
  );
}
// ---------- TermoLOG: laboratório com bancada, nó central (antena) e câmara fria ----------
function TermoPlace() {
  const dash = useTermoDashboard();
  const light = useRef();
  const cold = useMemo(() => new THREE.Color('#7fd3ff'), []), hot = useMemo(() => new THREE.Color('#ff4a2a'), []);
  useFrame((_, dt) => { light.current.color.lerp(termo.get().alert ? hot : cold, 1 - Math.exp(-dt * 3)); light.current.intensity = THREE.MathUtils.damp(light.current.intensity, termo.get().alert ? 30 : 10, 3, dt); });
  return (
    <group>
      <Common id="termolog" />
      <Model name="desk" scale={F} position={[0, 0, -1.2]} />
      <ScreenOn name="computerScreen" map={dash} rect={R.computerScreen} scale={F * 1.5} position={[0.1, 0.38 * F, -1.4]} />
      <Model name="circuit_board" scale={0.9} position={[-0.55, 0.38 * F + 0.01, -0.95]} rotation-y={0.4} />
      <Model name="chairDesk" scale={F} position={[0.1, 0, -0.1]} rotation-y={Math.PI + 0.2} />
      <Character name="mini-characters-character-worker" anim="interact-right" position={[0.7, 0, -0.3]} rotation-y={Math.PI + 0.4} />
      <Model name="radarEquipment" scale={2.6} position={[-2.8, 0, -1.8]} rotation-y={0.5} />
      <Model name="camera_exclusive" scale={4} position={[2.4, 0, -2.4]} rotation-y={-0.5} />
      <group position={[-4.2, 0, -4.2]} rotation-y={0.4}>
        <Model name="freezers-standing" scale={2.8} />
        <pointLight ref={light} position={[0, 2.2, 1.2]} distance={7} intensity={10} />
      </group>
      <Model name="animal-cat" scale={0.55} position={[1.8, 0, 1]} rotation-y={-0.6} />
    </group>
  );
}

// ---------- Vcall: duas pessoas em chamada, cada uma no seu computador, e o rádio no meio ----------
function VcallPlace() {
  const shots = big('vcall');
  return (
    <group>
      <Common id="vcall" />
      {[-2.8, 2.8].map((x, i) => (
        <group key={x} position={[x, 0, -1.2]} rotation-y={i ? -0.55 : 0.55}>
          <Model name="table" scale={F} />
          <ScreenOn name="computerScreen" src={i ? shots[1] : shots[0]} rect={R.computerScreen} scale={F * 1.4} position={[0, 0.33 * F, -0.1]} />
          <Model name="chair" scale={F} position={[0, 0, 0.8]} rotation-y={Math.PI} />
          <Character name={i ? 'mini-characters-character-male-c' : 'mini-characters-character-female-a'} anim="emote-yes" position={[0.6, 0, 0.9]} rotation-y={Math.PI} />
        </group>
      ))}
      <Model name="radio" scale={F * 2.6} position={[0, 0, 0.2]} rotation-y={0.2} />
      <Model name="animal-parrot" scale={0.55} position={[0.2, 1.75, 0.2]} rotation-y={0.6} />
    </group>
  );
}

// ---------- SongV: estúdio com máquina de dança, caixas de som que pulsam e a TV com o app ----------
function SongPlace() {
  const spk = useRef([]);
  useFrame(() => { const b = readLevels()[3] / 255; spk.current.forEach((s) => s && s.scale.setScalar(F * 1.8 * (1 + b * 0.15))); });
  return (
    <group>
      <Common id="songv" />
      <Model name="dance-machine" scale={2.6} position={[-2.4, 0, -2]} rotation-y={0.4} />
      {[-0.4, 2.8].map((x, i) => <group key={x} ref={(r) => (spk.current[i] = r)} position={[x, 0, -2.4]}><Model name="speaker" /></group>)}
      <Model name="cabinetTelevision" scale={F} position={[1.2, 0, -2.6]} />
      <ScreenOn name="televisionModern" src={big('songv')} rect={R.televisionModern} scale={F * 1.6} position={[1.2, 0.31 * F, -2.65]} />
      <Model name="loungeSofa" scale={F} position={[1.2, 0, 0]} rotation-y={Math.PI} />
      <Character name="mini-characters-character-female-c" anim="emote-yes" position={[-2.4, 0, -0.6]} rotation-y={0.3} />
    </group>
  );
}

// ---------- duckV: escritório com o computador, um gamer e um pato de borracha gigante ----------
function DuckPlace() {
  const duck = useRef();
  useFrame(({ clock }) => { duck.current.rotation.y = 0.6 + Math.sin(clock.elapsedTime * 0.6) * 0.35; duck.current.position.y = Math.abs(Math.sin(clock.elapsedTime * 1.6)) * 0.3; });
  return (
    <group>
      <Common id="duckv" />
      <Model name="desk" scale={F} position={[0.4, 0, -1.2]} />
      <ScreenOn name="computerScreen" src={big('duckv')} rect={R.computerScreen} scale={F * 1.5} position={[0.4, 0.38 * F, -1.4]} />
      <Model name="chairDesk" scale={F} position={[0.4, 0, -0.1]} rotation-y={Math.PI - 0.2} />
      <Character name="mini-arcade-character-gamer" anim="interact-left" position={[-0.2, 0, -0.2]} rotation-y={Math.PI - 0.3} />
      <group ref={duck} position={[-3.6, 0, -2.6]}><Model name="rubber_duck_toy" scale={11} /></group>
    </group>
  );
}

// ---------- Farmácia: prateleiras de mercadinho, freezer, caixa e o painel de vendas ----------
function PharmaPlace() {
  return (
    <group>
      <Common id="farmacia" sub="Pharmavision · OrçaLink" />
      <Model name="shelf-boxes" scale={2.4} position={[-3.2, 0, -3.6]} />
      <Model name="shelf-bags" scale={2.4} position={[-1.2, 0, -3.6]} />
      <Model name="freezers-standing" scale={2.6} position={[1.2, 0, -3.8]} />
      <Model name="cash-register" scale={1.8} position={[0.6, 0, -0.6]} rotation-y={Math.PI} />
      <Model name="table" scale={F} position={[-2.4, 0, -0.8]} />
      <ScreenOn name="computerScreen" src={big('farmacia')} rect={R.computerScreen} scale={F * 1.5} position={[-2.4, 0.33 * F, -0.95]} />
      <Character name="mini-arcade-character-employee" anim="idle" position={[0.6, 0, -1.6]} />
      <Prop name="shopping-cart" scale={2.6} position={[2.4, 1, 2.6]} rotation={[0, 0.6, 0]} mass={2} />
    </group>
  );
}

// ---------- Voto Aberto: seção eleitoral numa escola, fila de eleitores e a "urna" ----------
function VotoPlace() {
  return (
    <group>
      <Common id="voto" />
      {[-2.4, 0, 2.4].flatMap((x) => [-3, -1.8].map((z) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <Model name="table" scale={F * 0.7} />
          <Model name="chair" scale={F} position={[0, 0, 0.55]} rotation-y={Math.PI} />
        </group>
      )))}
      <Model name="table" scale={F} position={[1.6, 0, 0.4]} />
      <ScreenOn name="computerScreen" src={big('voto')} rect={R.computerScreen} scale={F * 1.4} position={[1.6, 0.33 * F, 0.25]} />
      {['a', 'c', 'e', 'h'].map((k, i) => <Character key={k} name={`blocky-characters-character-${k}`} anim="idle" scale={0.6} position={[-1.2 - i * 1.1, 0, 0.6 + i * 0.15]} rotation-y={Math.PI / 2} />)}
    </group>
  );
}

// ---------- Esmartigado: curral com cerca, vacas, cocho e plantação ----------
function FarmPlace() {
  const cow = useRef();
  useFrame(({ clock }) => { const t = clock.elapsedTime; cow.current.position.x = -1.5 + Math.sin(t * 0.25) * 1.6; cow.current.rotation.y = Math.cos(t * 0.25) > 0 ? Math.PI / 2 : -Math.PI / 2; });
  const fence = useMemo(() => {
    const out = [];
    for (let i = 0; i < 6; i++) out.push({ p: [-5 + i * 2, 0, -4.8], r: 0 });
    for (let i = 0; i < 4; i++) { out.push({ p: [-6, 0, -3.8 + i * 2], r: Math.PI / 2 }); out.push({ p: [6, 0, -3.8 + i * 2], r: Math.PI / 2 }); }
    return out;
  }, []);
  return (
    <group>
      <Common id="esmartigado" board={[3.6, 0, -6.4]} />
      {fence.map((f, i) => <Model key={i} name="fence" scale={4} position={f.p} rotation-y={f.r} />)}
      <group ref={cow} position={[-1.5, 0, -1.4]}><Model name="animal-cow" scale={1.1} /></group>
      <Model name="animal-cow" scale={1} position={[-3.8, 0, -3.2]} rotation-y={0.6} />
      <Model name="animal-pig" scale={0.6} position={[-0.6, 0, 0.6]} rotation-y={1.2} />
      <Model name="animal-chick" scale={0.35} position={[2.4, 0, -0.6]} rotation-y={-0.5} />
      <Model name="workbench" scale={4} position={[1.6, 0, -3]} />
      <Model name="bucket" scale={4} position={[0.4, 0, -3.2]} />
      <Model name="barrel" scale={3} position={[3.2, 0, -3.4]} />
      {[-4.6, -3.9, -3.2].map((x) => <Model key={x} name="crops_cornStageD" scale={1.6} position={[x, 0, 1]} />)}
      <Model name="crop_pumpkin" scale={2.4} position={[4.4, 0, -1.4]} />
    </group>
  );
}

// ---------- LED Clock: oficina com o letreiro de LED numa TV grande e um robô ----------
function ClockPlace() {
  const sign = useLedSign();
  return (
    <group>
      <Common id="clock" board={[5.2, 0, -2.6]} boardRot={-0.7} />
      {[-3, -1, 1, 3].map((x) => <Model key={x} name="wall" scale={2.6} position={[x - 1, 0, -4]} />)}
      <ScreenOn name="televisionModern" map={sign} rect={R.televisionModern} scale={[F * 3.4, F * 1.6, F * 2]} position={[0, 1.3, -3.6]} />
      <Model name="lantern" scale={2} position={[-3.6, 0, -2.6]} />
      <Model name="workbench" scale={4} position={[0, 0, -1.6]} />
      <Model name="alarm_clock_01" scale={4} position={[0.3, 1.2, -1.6]} rotation-y={-0.4} />
      <Character name="mini-characters-character-robot" anim="emote-yes" position={[-1.6, 0, -0.6]} rotation-y={0.4} />
      <Model name="animal-dog" scale={0.55} position={[1.8, 0, 0.6]} rotation-y={-0.8} />
    </group>
  );
}

// ---------- Angry Birds 3D: fliperama + torre de caixas para derrubar com o carro ----------
function Tower() {
  const bodies = useRef([]);
  const cells = useMemo(() => { const out = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 3 - (r % 2 ? 1 : 0); c++) out.push([-0.8 + c * 0.75 + (r % 2 ? 0.37 : 0), 0.32 + r * 0.62, 5.2]); return out; }, []);
  const starts = useMemo(() => cells.map((c) => new THREE.Vector3(...c)), [cells]);
  useFrame(() => {
    let k = 0;
    bodies.current.forEach((b, i) => { if (!b) return; const p = b.translation(); const st = starts[i]; if (Math.hypot(p.x - st.x, p.y - st.y, p.z - st.z) > 0.6) k++; });
    if (k !== sling.get().knocked) { sling.set({ knocked: k, total: cells.length }); if (k === cells.length) unlock('torre'); }
  });
  return cells.map((p, i) => (
    <RigidBody key={i} ref={(r) => (bodies.current[i] = r)} colliders={false} position={p} mass={0.6} canSleep>
      <CuboidCollider args={[0.36, 0.3, 0.36]} />
      <Model name="box" scale={2.6} position={[0, -0.3, 0]} solid={false} />
    </RigidBody>
  ));
}
function ArcadePlace() {
  return (
    <group>
      <Common id="angry" board={[5.4, 0, -2.8]} boardRot={-0.6} props={false} />
      {[-4.4, -3.2, -2].map((x, i) => <Model key={x} name="arcade-machine" scale={2.6} position={[x, 0, -3.8]} rotation-y={i === 1 ? 0 : (x < -3 ? 0.2 : -0.2)} />)}
      <Model name="pinball" scale={2.4} position={[0, 0, -3.6]} />
      <Model name="claw-machine" scale={2.4} position={[1.8, 0, -3.8]} />
      <Model name="air-hockey" scale={2.4} position={[-1.6, 0, -1.2]} />
      <Model name="prize-wheel" scale={2.6} position={[3.6, 0, -1.8]} rotation-y={-0.6} />
      <Character name="mini-arcade-character-gamer" anim="emote-yes" position={[-3.2, 0, -2.4]} />
      <Tower />
    </group>
  );
}

export function SolidPlace({ children }) { return <SolidCtx.Provider value>{children}</SolidCtx.Provider>; }

export const PLACES = { termolog: TermoPlace, vcall: VcallPlace, songv: SongPlace, duckv: DuckPlace, farmacia: PharmaPlace, voto: VotoPlace, esmartigado: FarmPlace, clock: ClockPlace, angry: ArcadePlace };
