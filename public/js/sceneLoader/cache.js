import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { DEFAULT_HDRI_FILE, HDRI_CACHE_MAX_ENTRIES } from './constants.js';
import { trackLoad } from '../game/loadingTracker.js';

export async function loadModelCache(self, path) {
  if (!path) {
    throw new Error('SceneLoader.loadModel requires a valid path.');
  }

  const cached = self.modelCache.get(path);
  if (cached?.scene) {
    return cached.scene.clone();
  }

  if (cached?.promise) {
    const scene = await cached.promise;
    return scene.clone();
  }

  const pendingPromise = self._gltfLoader.loadAsync(path)
    .then((gltf) => {
      const scene = gltf?.scene;
      if (!scene) {
        throw new Error(`GLTF at '${path}' did not contain a scene root.`);
      }
      self.modelCache.set(path, { scene });
      return scene;
    })
    .catch((err) => {
      self.modelCache.delete(path);
      throw err;
    });

  trackLoad(pendingPromise);
  self.modelCache.set(path, { scene: null, promise: pendingPromise });
  const loadedScene = await pendingPromise;
  return loadedScene.clone();
}

export function resolveHdriConfigCache(sceneDef) {
  const env = sceneDef?.environment;
  const hdriEntry = env?.hdri;

  if (hdriEntry === false) {
    return null;
  }

  if (typeof hdriEntry === 'string') {
    return {
      file: hdriEntry,
      background: false,
      environmentIntensity: 1,
      backgroundIntensity: 1,
      backgroundBlurriness: 0
    };
  }

  if (hdriEntry && typeof hdriEntry === 'object') {
    return {
      file: hdriEntry.file || DEFAULT_HDRI_FILE,
      background: !!hdriEntry.background,
      environmentIntensity: typeof hdriEntry.environmentIntensity === 'number' ? hdriEntry.environmentIntensity : 1,
      backgroundIntensity: typeof hdriEntry.backgroundIntensity === 'number' ? hdriEntry.backgroundIntensity : 1,
      backgroundBlurriness: typeof hdriEntry.backgroundBlurriness === 'number' ? hdriEntry.backgroundBlurriness : 0
    };
  }

  return {
    file: DEFAULT_HDRI_FILE,
    background: false,
    environmentIntensity: 1,
    backgroundIntensity: 1,
    backgroundBlurriness: 0
  };
}

export async function preloadHdriCache(self, sceneDef) {
  const hdri = resolveHdriConfigCache(sceneDef);
  if (!hdri?.file) return;
  try {
    await getPmremTextureForHdriCache(self, hdri.file);
  } catch (err) {
    console.warn('SceneLoader: failed to preload HDRI', hdri.file, err);
  }
}

export async function applyHdriForSceneCache(self, sceneDef) {
  const hdri = resolveHdriConfigCache(sceneDef);
  const requestId = ++self._activeHdriRequestId;

  if (!hdri?.file) {
    self.scene.environment = null;
    if (self._isHdriBackgroundActive) {
      self.scene.background = null;
      self._isHdriBackgroundActive = false;
    }
    self._activeHdriPath = null;
    return;
  }

  try {
    const envMap = await getPmremTextureForHdriCache(self, hdri.file);
    if (requestId !== self._activeHdriRequestId) return;

    self.scene.environment = envMap;
    if (typeof hdri.environmentIntensity === 'number') {
      self.scene.environmentIntensity = hdri.environmentIntensity;
    }

    if (hdri.background) {
      self.scene.background = envMap;
      if (typeof hdri.backgroundIntensity === 'number') {
        self.scene.backgroundIntensity = hdri.backgroundIntensity;
      }
      if (typeof hdri.backgroundBlurriness === 'number') {
        self.scene.backgroundBlurriness = hdri.backgroundBlurriness;
      }
      self._isHdriBackgroundActive = true;
    } else if (self._isHdriBackgroundActive) {
      self.scene.background = null;
      self._isHdriBackgroundActive = false;
    }

    self._activeHdriPath = hdri.file;
    console.log(`SceneLoader: HDRI applied (${hdri.file})`);
  } catch (err) {
    if (requestId !== self._activeHdriRequestId) return;
    console.warn('SceneLoader: failed to apply HDRI', hdri.file, err);
    self.scene.environment = null;
    if (self._isHdriBackgroundActive) {
      self.scene.background = null;
      self._isHdriBackgroundActive = false;
    }
    self._activeHdriPath = null;
  }
}

export function getPmremTextureForHdriCache(self, hdriPath) {
  const cached = self._hdriCache.get(hdriPath);
  if (cached?.pmremTexture) {
    self._hdriCache.delete(hdriPath);
    self._hdriCache.set(hdriPath, cached);
    return Promise.resolve(cached.pmremTexture);
  }
  if (cached?.promise) {
    return cached.promise;
  }

  if (!self._pmremGenerator) {
    return Promise.reject(new Error('PMREMGenerator is unavailable because renderer was not provided.'));
  }

  const promise = self._exrLoader.loadAsync(hdriPath)
    .then((exrTexture) => {
      exrTexture.mapping = THREE.EquirectangularReflectionMapping;
      const renderTarget = self._pmremGenerator.fromEquirectangular(exrTexture);
      exrTexture.dispose();

      const entry = {
        pmremTexture: renderTarget.texture,
        renderTarget,
        promise: null
      };
      self._hdriCache.set(hdriPath, entry);
      trimHdriCache(self, hdriPath);
      return entry.pmremTexture;
    })
    .catch((err) => {
      self._hdriCache.delete(hdriPath);
      throw err;
    });

  self._hdriCache.set(hdriPath, { promise, pmremTexture: null, renderTarget: null });
  return promise;
}

export function disposeHdriCacheEntry(self, path, entry) {
  if (!entry) return;
  try {
    if (path && self._activeHdriPath && path === self._activeHdriPath) return;
    if (self.scene?.environment && entry.pmremTexture && self.scene.environment === entry.pmremTexture) return;
    if (self.scene?.background && entry.pmremTexture && self.scene.background === entry.pmremTexture) return;

    if (entry.renderTarget?.dispose) {
      entry.renderTarget.dispose();
    } else if (entry.pmremTexture?.dispose) {
      entry.pmremTexture.dispose();
    }
  } catch (e) {
    console.warn('SceneLoader: failed disposing HDRI cache entry', path, e);
  }
}

export function trimHdriCache(self, preferredPath = null) {
  if (self._hdriCache.size <= HDRI_CACHE_MAX_ENTRIES) return;

  const keys = Array.from(self._hdriCache.keys());
  for (const key of keys) {
    if (self._hdriCache.size <= HDRI_CACHE_MAX_ENTRIES) break;
    if (key === preferredPath) continue;
    if (key === self._activeHdriPath) continue;

    const entry = self._hdriCache.get(key);
    if (entry?.promise && !entry?.pmremTexture) continue;

    disposeHdriCacheEntry(self, key, entry);
    self._hdriCache.delete(key);
  }
}

export function disposeAllHdriCacheEntries(self) {
  for (const [path, entry] of self._hdriCache.entries()) {
    disposeHdriCacheEntry(self, path, entry);
  }
  self._hdriCache.clear();
}

export function releaseModelCacheRefs(self) {
  self.modelCache.clear();
}

export function disposeCachesModule(self) {
  disposeAllHdriCacheEntries(self);
  releaseModelCacheRefs(self);
  try {
    self._pmremGenerator?.dispose?.();
  } catch (e) {}
  self._pmremGenerator = null;
}
