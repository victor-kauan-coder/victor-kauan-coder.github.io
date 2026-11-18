import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { useGLTF } from '@react-three/drei';

// Texturas KTX2 (Basis Universal) ficam comprimidas também na memória da GPU:
// o aparelho transcodifica para o formato que entende (ASTC, ETC2, BC7...).
export const ktx2 = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}basis/`);
export const initLoaders = (gl) => ktx2.detectSupport(gl);
const extend = (loader) => loader.setKTX2Loader(ktx2);

// Os kits de natureza da Kenney vêm com materiais 100% metálicos: sem reflexo de ambiente eles ficam pretos.
// Corrige uma vez por modelo carregado.
function fix(gltf) {
  if (gltf.scene.userData.fixed) return gltf;
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m && 'metalness' in m) { m.metalness = 0; m.roughness = Math.max(m.roughness, 0.7); } });
  });
  gltf.scene.userData.fixed = true;
  return gltf;
}

// useGLTF com meshopt + KTX2
export const useModel = (url) => fix(useGLTF(url, false, true, extend));
useModel.preload = (url) => useGLTF.preload(url, false, true, extend);
