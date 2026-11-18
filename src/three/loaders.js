import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { useGLTF } from '@react-three/drei';

// Texturas KTX2 (Basis Universal) ficam comprimidas também na memória da GPU:
// o aparelho transcodifica para o formato que entende (ASTC, ETC2, BC7...).
export const ktx2 = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}basis/`);
export const initLoaders = (gl) => ktx2.detectSupport(gl);
const extend = (loader) => loader.setKTX2Loader(ktx2);

// useGLTF com meshopt + KTX2
export const useModel = (url) => useGLTF(url, false, true, extend);
useModel.preload = (url) => useGLTF.preload(url, false, true, extend);
