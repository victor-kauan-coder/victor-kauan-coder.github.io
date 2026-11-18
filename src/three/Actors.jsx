import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { useModel } from './loaders.js';
import { MODEL, Model } from './World.jsx';

// Personagem animado (Kenney Mini Characters / Blocky Characters). Clona o esqueleto para cada cópia.
export function Character({ name, anim = 'idle', scale = 1, ...props }) {
  const { scene, animations } = useModel(MODEL(name));
  const clone = useMemo(() => {
    const c = cloneSkinned(scene);
    c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return c;
  }, [scene]);
  const group = useRef();
  const { actions } = useAnimations(animations, group);
  useEffect(() => {
    const a = actions[anim] || actions.idle;
    a?.reset().fadeIn(0.3).play();
    return () => a?.fadeOut(0.3);
  }, [actions, anim]);
  return <group ref={group} scale={scale} {...props}><primitive object={clone} /></group>;
}

// Aplica uma imagem (captura real ou textura desenhada ao vivo) na face frontal de um modelo baixado.
// `rect` é a área da tela em frações da caixa envolvente do modelo: [x0, y0, x1, y1] na face +z.
export function ScreenOn({ name, src, map, rect = [0.1, 0.1, 0.9, 0.9], z = 1, scale = 1, ...props }) {
  const { scene } = useModel(MODEL(name));
  const box = useMemo(() => new THREE.Box3().setFromObject(scene), [scene]);
  const [x0, y0, x1, y1] = rect;
  const w = (box.max.x - box.min.x) * (x1 - x0), h = (box.max.y - box.min.y) * (y1 - y0);
  const cx = box.min.x + (box.max.x - box.min.x) * (x0 + x1) / 2, cy = box.min.y + (box.max.y - box.min.y) * (y0 + y1) / 2;
  const zf = box.min.z + (box.max.z - box.min.z) * z + 0.004;
  return (
    <group scale={scale} {...props}>
      <Model name={name} />
      <mesh position={[cx, cy, zf]}>
        <planeGeometry args={[w, h]} />
        {map ? <meshBasicMaterial map={map} toneMapped={false} /> : <ShotMat src={src} aspect={w / h} />}
      </mesh>
    </group>
  );
}

// Material com uma captura que troca sozinha (lista) ou fixa (string). Baixa uma imagem por vez.
export function ShotMat({ src, aspect }) {
  const mat = useRef();
  const list = Array.isArray(src) ? src : [src];
  const st = useRef({ i: -1, t: 0, cur: null, busy: false });
  // decodifica a imagem fora da thread principal (ImageBitmap): trocar a tela não trava o jogo
  const loader = useMemo(() => new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY' }), []);
  const load = (i) => {
    const s = st.current; if (s.busy || !list[i]) return; s.busy = true;
    loader.load(list[i], (bmp) => {
      const t = new THREE.Texture(bmp); t.flipY = false; t.needsUpdate = true;
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      const ia = t.image.width / t.image.height;
      if (ia > aspect) { t.repeat.set(aspect / ia, 1); t.offset.set((1 - aspect / ia) / 2, 0); } else { t.repeat.set(1, ia / aspect); t.offset.set(0, 1 - ia / aspect); }
      if (mat.current) { mat.current.map = t; mat.current.color.set('#fff'); mat.current.needsUpdate = true; }
      s.cur?.image?.close?.(); s.cur?.dispose(); s.cur = t; s.i = i; s.busy = false;
    }, undefined, () => { s.busy = false; });
  };
  useEffect(() => { load(0); return () => st.current.cur?.dispose(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => { const s = st.current; s.t += dt; if (list.length > 1 && s.t > 5) { s.t = 0; load((s.i + 1) % list.length); } });
  return <meshBasicMaterial ref={mat} color="#0b0d12" toneMapped={false} />;
}

// Objeto com física: o carro empurra, ele cai, rola e volta para o lugar se sair do mapa.
export function Prop({ name, position, rotation = [0, 0, 0], scale = 1, mass = 1 }) {
  const body = useRef();
  const start = useMemo(() => new THREE.Vector3(...position), [position]);
  useFrame(() => {
    const b = body.current; if (!b) return;
    if (b.translation().y < start.y - 15) { b.setTranslation(start, true); b.setLinvel({ x: 0, y: 0, z: 0 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true); }
  });
  return (
    <RigidBody ref={body} colliders="cuboid" position={position} rotation={rotation} mass={mass} linearDamping={0.4} angularDamping={0.6} canSleep>
      <Model name={name} scale={scale} />
    </RigidBody>
  );
}
