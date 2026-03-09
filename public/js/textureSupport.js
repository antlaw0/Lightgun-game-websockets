import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { KTX2Loader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/KTX2Loader.js';

const textureLoader = new THREE.TextureLoader();
const ktx2Loader = new KTX2Loader();

let ktx2SupportDetected = false;

ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/libs/basis/');

function ensureKtx2Support(renderer = null) {
  if (ktx2SupportDetected) return true;

  let activeRenderer = renderer || window.engine?.renderer || null;
  let tempRenderer = null;

  // Some loaders run before the game renderer exists; detect support once with a temp renderer.
  if (!activeRenderer && typeof document !== 'undefined') {
    try {
      tempRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      activeRenderer = tempRenderer;
    } catch (e) {
      activeRenderer = null;
    }
  }

  if (!activeRenderer) return false;

  try {
    ktx2Loader.detectSupport(activeRenderer);
    ktx2SupportDetected = true;
  } finally {
    if (tempRenderer) {
      try { tempRenderer.dispose(); } catch (e) {}
      try { tempRenderer.forceContextLoss(); } catch (e) {}
      try { tempRenderer.domElement?.remove?.(); } catch (e) {}
    }
  }

  return true;
}

export function configureKtx2ForRenderer(renderer) {
  ensureKtx2Support(renderer);
}

export function configureGltfLoaderForKtx2(loader, renderer = null) {
  if (!loader || typeof loader.setKTX2Loader !== 'function') return loader;
  ensureKtx2Support(renderer);
  loader.setKTX2Loader(ktx2Loader);
  return loader;
}

export function resolveTexturePath(path) {
  if (!path || typeof path !== 'string') return path;

  // Prefer transcoded PBR maps when scene defs still reference legacy png files.
  if (/\/(basecolor|normal|orm)\.png$/i.test(path)) {
    return path.replace(/\.png$/i, '.ktx2');
  }

  return path;
}

export function loadTextureWithSupport(path, onLoad, onProgress, onError) {
  const resolvedPath = resolveTexturePath(path);
  const useKtx2 = /\.ktx2$/i.test(resolvedPath);

  if (useKtx2) {
    ensureKtx2Support();

    // KTX2Loader does not always return a usable texture synchronously in all builds.
    // Return a proxy texture immediately so existing synchronous material setup remains valid.
    const proxy = new THREE.CompressedTexture();
    proxy.name = resolvedPath;

    ktx2Loader.load(
      resolvedPath,
      (loadedTex) => {
        const wrapS = proxy.wrapS;
        const wrapT = proxy.wrapT;
        const repeatX = proxy.repeat.x;
        const repeatY = proxy.repeat.y;
        const colorSpace = proxy.colorSpace;

        proxy.copy(loadedTex);
        proxy.wrapS = wrapS;
        proxy.wrapT = wrapT;
        proxy.repeat.set(repeatX, repeatY);
        proxy.colorSpace = colorSpace;
        proxy.needsUpdate = true;

        if (onLoad) onLoad(proxy);
      },
      onProgress,
      onError
    );

    return proxy;
  }

  return textureLoader.load(resolvedPath, onLoad, onProgress, onError);
}
