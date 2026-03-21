import { isReferenceNodeObject } from './utils.js';

export function loadSceneLifecycle(self, sceneDef) {
  self.unloadScene();
  self._loadSceneData(sceneDef, false);
  self._buildMergedStaticShell?.();
  self._applyHdriForScene(sceneDef);
  self._applyCameraSettings(sceneDef);
  self._notifyLoaded();
}

export function preloadSceneLifecycle(self, sceneDef) {
  console.log(`SceneLoader preloading scene: ${sceneDef.name}`);
  self._clearPending();
  self.pendingSceneDef = sceneDef;
  self._loadSceneData(sceneDef, true);
  self._preloadHdri(sceneDef);
}

export function hasPendingSceneLifecycle(self) {
  return !!self.pendingSceneDef;
}

export function commitPendingSceneLifecycle(self) {
  if (!self.pendingSceneDef) return;

  console.log(`SceneLoader committing pending scene: ${self.pendingSceneDef.name}`);

  self.unloadScene();

  self.sceneDef = self.pendingSceneDef;
  self.props = self.pendingProps;
  self.propsById = self.pendingPropsById;
  self.enemies = self.pendingEnemies;
  self.enemiesById = self.pendingEnemiesById;
  self.sceneLights = self.pendingSceneLights;
  self.staticObjects = self.pendingStaticObjects;

  self.props.forEach((p) => {
    if (p.mesh) {
      p.mesh.visible = true;
      p.mesh.traverse((o) => {
        if (o.isMesh) {
          if (isReferenceNodeObject(o)) {
            o.visible = false;
            return;
          }
          o.visible = true;
          self.propMeshes.push(o);
        }
      });
    }
  });

  self.enemies.forEach((e) => {
    e.setActive(true);
  });

  self.sceneLights.forEach((l) => {
    l.visible = true;
  });

  self._buildMergedStaticShell?.();

  self._applyHdriForScene(self.sceneDef);
  self._applyCameraSettings(self.sceneDef);

  self.pendingSceneDef = null;
  self.pendingProps = [];
  self.pendingPropsById = {};
  self.pendingEnemies = [];
  self.pendingEnemiesById = {};
  self.pendingSceneLights = [];
  self.pendingStaticObjects = [];

  self._notifyLoaded();
}

export function clearPendingLifecycle(self) {
  self.pendingProps.forEach((p) => {
    if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
    try {
      p.dispose?.();
    } catch (e) {}
  });
  self.pendingEnemies.forEach((e) => {
    if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
    try {
      e.dispose?.();
    } catch (e2) {}
  });
  self.pendingSceneLights.forEach((l) => {
    if (l.parent) l.parent.remove(l);
  });

  self.pendingProps = [];
  self.pendingPropsById = {};
  self.pendingEnemies = [];
  self.pendingEnemiesById = {};
  self.pendingSceneLights = [];
  self.pendingStaticObjects = [];
  self.pendingSceneDef = null;
}

export function unloadSceneLifecycle(self) {
  self.roomMeshes.forEach((m) => {
    self.scene.remove(m);
    if (m.geometry) m.geometry.dispose();
    if (m.material) m.material.dispose();
  });
  self.roomMeshes = [];

  self.sceneLights.forEach((light) => self.scene.remove(light));
  self.sceneLights = [];

  Object.values(self.projectiles).forEach((p) => {
    try {
      p.dispose();
    } catch {}
  });
  self.projectiles = {};
  self.projectileMeshes = [];

  self.enemies.forEach((en) => {
    try {
      en.dispose();
    } catch {}
  });
  self.enemies = [];
  self.enemiesById = {};
  self.enemyMeshes = [];

  self.props.forEach((pr) => {
    try {
      if (pr.mesh && pr.mesh.parent) pr.mesh.parent.remove(pr.mesh);
    } catch (e) {}
    try {
      if (typeof pr.dispose === 'function') pr.dispose();
    } catch (e2) {}
  });
  self.props = [];
  self.propsById = {};
  self.propMeshes = [];
  self.staticObjects = [];

  self.explosions.forEach((ex) => {
    try {
      if (typeof ex.destroy === 'function') ex.destroy();
      if (typeof ex.dispose === 'function') ex.dispose();
    } catch {}
  });
  self.explosions = [];

  self._activeHdriRequestId++;
  self.scene.environment = null;
  self.scene.environmentIntensity = 1;
  if (self._isHdriBackgroundActive) {
    self.scene.background = null;
    self._isHdriBackgroundActive = false;
  }
  self._activeHdriPath = null;
}
