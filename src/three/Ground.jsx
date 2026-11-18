import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SIZE, height, isFree, sky } from './world.js';
import { ui } from '../store.js';

// Mapa de altura do terreno numa textura (para a grama na GPU saber onde está o chão) + máscara de onde pode ter grama.
const RES = 384;
let hm;
function heightMap() {
  if (hm) return hm;
  const data = new Float32Array(RES * RES * 4);
  for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
    const x = (i / (RES - 1) - 0.5) * SIZE, z = (j / (RES - 1) - 0.5) * SIZE, k = (j * RES + i) * 4;
    data[k] = height(x, z);
    data[k + 1] = isFree(x, z, -2.2) ? 1 : 0; // sem grama na estrada e nos lugares
  }
  const t = new THREE.DataTexture(data, RES, RES, THREE.RGBAFormat, THREE.FloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return (hm = t);
}

// Chão com cores "assadas" nos vértices no carregamento: a variação natural continua, mas a GPU não calcula
// ruído em cada pixel (era o maior custo por quadro numa GPU integrada).
const fract = (v) => v - Math.floor(v);
const h21 = (x, y) => { let a = fract(x * 123.34), b = fract(y * 456.21); const d = a * (a + 45.32) + b * (b + 45.32); a += d; b += d; return fract(a * b); };
const vnoise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = h21(ix, iy), b = h21(ix + 1, iy), c = h21(ix, iy + 1), d = h21(ix + 1, iy + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
const fbm = (x, y) => { let a = 0.5, s = 0; for (let i = 0; i < 4; i++) { s += a * vnoise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return s; };
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export function Terrain() {
  const geo = useMemo(() => {
    const seg = ui.get().lowPower ? 170 : 240;
    const g = new THREE.PlaneGeometry(SIZE, SIZE, seg, seg);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    const deep = new THREE.Color(0.13, 0.42, 0.10), lush = new THREE.Color(0.27, 0.62, 0.15), sun = new THREE.Color(0.55, 0.72, 0.18), dry = new THREE.Color(0.78, 0.62, 0.30), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = height(x, z);
      p.setY(i, y);
      const n = fbm(x * 0.018, z * 0.018), d = fbm(x * 0.11 + 7, z * 0.11 + 7);
      c.copy(deep).lerp(lush, smooth(0.25, 0.6, n)).lerp(sun, smooth(0.55, 0.85, n) * 0.8).lerp(dry, smooth(9, 16, y) * 0.6).multiplyScalar(0.9 + d * 0.2);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow matrixAutoUpdate={false}>
      <meshLambertMaterial vertexColors />
    </mesh>
  );
}

// Campo de grama: dezenas de milhares de lâminas numa única chamada de desenho. O campo acompanha a câmera,
// as lâminas leem a altura do chão da textura e balançam com o vento no shader de vértice.
export function Grass() {
  const low = ui.get().lowPower;
  const COUNT = low ? 14000 : 32000, R = low ? 32 : 40;
  const geo = useMemo(() => {
    const base = new THREE.BufferGeometry();
    // lâmina: 5 vértices afinando até a ponta
    base.setAttribute('position', new THREE.Float32BufferAttribute([-0.06, 0, 0, 0.06, 0, 0, -0.04, 0.45, 0, 0.04, 0.45, 0, 0, 0.9, 0], 3));
    base.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]);
    const g = new THREE.InstancedBufferGeometry().copy(base);
    g.instanceCount = COUNT;
    const off = new Float32Array(COUNT * 4);
    for (let i = 0; i < COUNT; i++) { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R; off.set([Math.cos(a) * d, Math.sin(a) * d, Math.random(), Math.random()], i * 4); }
    g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
    return g;
  }, [COUNT, R]);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    fog: true,
    uniforms: { ...THREE.UniformsLib.fog, uLight: { value: 1 }, uTime: { value: 0 }, uCenter: { value: new THREE.Vector2() }, uHM: { value: heightMap() }, uSize: { value: SIZE }, uR: { value: R } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute vec4 aOff; uniform float uTime, uSize, uR; uniform vec2 uCenter; uniform sampler2D uHM;
      varying float vT; varying float vShade;
      void main(){
        // grade fixa no mundo: a lâmina não "anda" quando a câmera anda
        vec2 cell = floor(uCenter / 2.0) * 2.0;
        vec2 wp = cell + aOff.xy;
        vec2 uv = wp / uSize + 0.5;
        vec4 h = texture2D(uHM, uv);
        float fade = 1.0 - smoothstep(uR * 0.7, uR, length(aOff.xy));
        float s = h.g * fade * (0.45 + aOff.z * 0.45);
        vec3 p = position * s;
        float ang = aOff.w * 6.2831;
        p.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xz;
        float wind = sin(uTime * 1.8 + wp.x * 0.15 + wp.y * 0.1) * 0.5 + sin(uTime * 3.1 + wp.x * 0.7) * 0.15;
        p.x += wind * position.y * position.y * 0.5 * s; p.z += wind * position.y * 0.25 * s;
        vec4 mvPosition = modelViewMatrix * vec4(vec3(wp.x, h.r, wp.y) + p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        vT = position.y / 0.9; vShade = aOff.z;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying float vT; varying float vShade; uniform float uLight;
      void main(){
        vec3 root = vec3(0.07, 0.30, 0.05), tip = mix(vec3(0.36, 0.70, 0.14), vec3(0.62, 0.80, 0.20), vShade);
        gl_FragColor = vec4(mix(root, tip, vT) * uLight, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  }), [R]);
  const ref = useRef();
  useFrame(({ clock, camera }) => {
    ref.current.visible = !window.__nograss;
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uLight.value = 1 - sky.k * 0.78;
    const f = ui.get().focusPoint || camera.position;
    mat.uniforms.uCenter.value.set(f.x, f.z);
  });
  return <mesh ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
}
