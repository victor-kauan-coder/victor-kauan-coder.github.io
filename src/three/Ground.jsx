import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SIZE, height, isFree } from './world.js';
import { ui } from '../store.js';

// Mapa de altura do terreno numa textura (para a grama na GPU saber onde está o chão) + máscara de onde pode ter grama.
const RES = 256;
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

// Variação de cor no chão por posição no mundo (ruído suave), em vez do mosaico de triângulos.
const NOISE = /* glsl */ `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

export function Terrain() {
  const geo = useMemo(() => {
    const seg = ui.get().lowPower ? 140 : 200;
    const g = new THREE.PlaneGeometry(SIZE, SIZE, seg, seg);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vW;\n${NOISE}`).replace('#include <color_fragment>', `#include <color_fragment>
        float n = fbm(vW.xz * 0.018), d = fbm(vW.xz * 0.11 + 7.0);
        vec3 deep = vec3(0.13, 0.42, 0.10), lush = vec3(0.27, 0.62, 0.15), sun = vec3(0.55, 0.72, 0.18), dry = vec3(0.78, 0.62, 0.30);
        vec3 c = mix(deep, lush, smoothstep(0.25, 0.6, n));
        c = mix(c, sun, smoothstep(0.55, 0.85, n) * 0.8);
        c = mix(c, dry, smoothstep(9.0, 16.0, vW.y) * 0.6);
        c *= 0.9 + d * 0.2;
        diffuseColor.rgb = c;`);
    };
    return m;
  }, []);
  return <mesh geometry={geo} material={mat} receiveShadow />;
}

// Campo de grama: dezenas de milhares de lâminas numa única chamada de desenho. O campo acompanha a câmera,
// as lâminas leem a altura do chão da textura e balançam com o vento no shader de vértice.
export function Grass() {
  const low = ui.get().lowPower;
  const COUNT = low ? 18000 : 60000, R = low ? 36 : 48;
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
    uniforms: { ...THREE.UniformsLib.fog, uTime: { value: 0 }, uCenter: { value: new THREE.Vector2() }, uHM: { value: heightMap() }, uSize: { value: SIZE }, uR: { value: R } },
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
        float s = h.g * fade * (0.8 + aOff.z * 0.9);
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
      varying float vT; varying float vShade;
      void main(){
        vec3 root = vec3(0.07, 0.30, 0.05), tip = mix(vec3(0.36, 0.70, 0.14), vec3(0.62, 0.80, 0.20), vShade);
        gl_FragColor = vec4(mix(root, tip, vT), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  }), [R]);
  const ref = useRef();
  useFrame(({ clock, camera }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    const f = ui.get().focusPoint || camera.position;
    mat.uniforms.uCenter.value.set(f.x, f.z);
  });
  return <mesh ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
}
