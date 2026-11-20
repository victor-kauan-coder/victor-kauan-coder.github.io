import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { useGLTF } from '@react-three/drei';

// Texturas KTX2 (Basis Universal) ficam comprimidas também na memória da GPU; malhas em meshopt.
export const ktx2 = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}basis/`);
export const initLoaders = (gl) => ktx2.detectSupport(gl);
const extend = (loader) => loader.setKTX2Loader(ktx2);

export const url = (name) => `${import.meta.env.BASE_URL}m/${name}.glb`;
export const useModel = (name) => useGLTF(url(name), false, true, extend);
useModel.preload = (name) => useGLTF.preload(url(name), false, true, extend);
