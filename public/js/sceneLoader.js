import { Enemy } from "./enemy.js";
import { Prop as PropClass } from "./prop.js";
import { ENEMY_DEFS } from "./scenes.js";

export class SceneLoader {
  constructor(scene, camera, player) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.enemies = {};
    this.props = {};
    this.enemyMeshes = [];
    this.propMeshes = [];
    this.sceneDef = null;

    // NEW: frame counter for duplicate hit prevention
    this.frameCount = 0;
  }

  loadScene(sceneDef) {
    this.unloadScene();
    this.sceneDef = sceneDef;
    console.log(`[SceneLoader] loading scene: ${sceneDef.name}`);

    const staticObjs = sceneDef.environment?.staticObjects ?? [];
    staticObjs.forEach((pdef, idx) => {
      if (!pdef.id) pdef.id = `prop_${idx}`;
      const p = new PropClass(pdef);
      this.props[pdef.id] = p;
      this.scene.add(p.mesh);
      this.propMeshes.push(p.mesh);
    });

    const enemyDefs = sceneDef.enemies ?? [];
    enemyDefs.forEach((edef) => {
      if (!edef.type) {
        console.warn("Skipping enemy without type:", edef);
        return;
      }

      const def = ENEMY_DEFS[edef.type];
      if (!def) {
        console.warn("No ENEMY_DEFS entry for type", edef.type);
        return;
      }

      const e = new Enemy(this.scene, def, edef);

      // Make sure enemy has lastHitFrame
      e.lastHitFrame = -1;

      this.enemies[e.id] = e;
      if (e.mesh) this.enemyMeshes.push(e.mesh);
    });

    this.objective = sceneDef.objective ?? null;
    this._notifyLoaded();
  }

  _notifyLoaded() {
    window.dispatchEvent(new CustomEvent("sceneLoaded", { detail: { scene: this.sceneDef } }));
  }

  unloadScene() {
    Object.values(this.enemies).forEach((en) => { try { en.dispose(); } catch(e){} });
    this.enemies = {};
    Object.values(this.props).forEach((pr) => { try { pr.dispose(); } catch(e){} });
    this.props = {};
    this.enemyMeshes = [];
    this.propMeshes = [];
  }

  update(deltaMs, nowMs) {
    // NEW: advance frame counter
    this.frameCount++;

    Object.values(this.enemies).forEach((en) => {
      try { en.update(deltaMs, nowMs, this.player); }
      catch(e){}
    });
  }

  // UPDATED: duplicate-hit-protected version
  applyDamageToMesh(mesh, damage = 1) {
    if (!mesh) return false;

    console.log("[SceneLoader] applyDamageToMesh hit:", mesh, mesh.userData);

    let obj = mesh;

    // climb parent chain to find object with enemyId or propId
    while (obj && obj.userData && !obj.userData.enemyId && !obj.userData.propId) {
      obj = obj.parent;
    }

    if (!obj || !obj.userData) {
      console.warn("[SceneLoader] Hit object has no enemyId or propId");
      return false;
    }

    // Enemy
    if (obj.userData.enemyId) {
      const id = obj.userData.enemyId;
      const en = this.enemies[id];
      if (!en) return false;

      // NEW: prevent multiple hits in same frame → fixes 3HP lost at once
      if (en.lastHitFrame === this.frameCount) {
        // already hit this frame — ignore duplicate mesh hits
        return true;
      }
      en.lastHitFrame = this.frameCount;

      en.takeDamage(damage);
      this._checkObjectiveAfterHit();
      return true;
    }

    // Prop
    if (obj.userData.propId) {
      const id = obj.userData.propId;
      const pr = this.props[id];
      if (pr) {
        const died = pr.takeDamage(damage);
        if (died) delete this.props[id];
      }
      return true;
    }

    return false;
  }

  _checkObjectiveAfterHit() {
    if (!this.objective) return;
    if (this.objective.type === "eliminateAllEnemies") {
      const remaining = Object.values(this.enemies).filter(e => !e._isDead);
      if (remaining.length === 0) {
        if (typeof window.onSceneComplete === "function") {
          window.onSceneComplete(this.sceneDef);
        } else {
          window.dispatchEvent(new CustomEvent("sceneComplete", { detail: { scene: this.sceneDef } }));
        }
      }
    }
  }

  getIntersectableMeshes() {
    return [...this.enemyMeshes, ...this.propMeshes];
  }
}
