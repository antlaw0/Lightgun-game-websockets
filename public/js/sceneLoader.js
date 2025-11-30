import { Enemy } from "./enemy.js";
import { Prop as PropClass } from "./prop.js";
import { ENEMY_DEFS } from "./scenes.js";
import { Projectile } from "./projectile.js";
//import * as THREE from "three"; // make sure THREE is available

export class SceneLoader {
  constructor(scene, camera, player) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;

    this.enemies = {};
    this.props = {};
    this.enemyMeshes = [];
    this.propMeshes = [];

    this.projectiles = {};
    this.projectileMeshes = [];
    this.nextProjectileId = 1;

    this.sceneDef = null;
    this.bgMesh = null; // store background plane

    // Used to avoid multi-hit bug
    this.frameCount = 0;
  }

  loadScene(sceneDef) {
    this.unloadScene();
    this.sceneDef = sceneDef;

    console.log(`[SceneLoader] loading scene: ${sceneDef.name}`);

    // Add background image if defined
    if (sceneDef.background?.texture) {
      const texLoader = new THREE.TextureLoader();
      const tex = texLoader.load(sceneDef.background.texture);
      const width = sceneDef.background.width ?? 20;
      const height = sceneDef.background.height ?? 10;

      const geo = new THREE.PlaneGeometry(width, height);
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      const mesh = new THREE.Mesh(geo, mat);

      mesh.position.set(0, height / 2, -10); // push back a bit
      this.scene.add(mesh);
      this.bgMesh = mesh;
    }

    // Load static objects
    const staticObjs = sceneDef.environment?.staticObjects ?? [];
    staticObjs.forEach((pdef, idx) => {
      if (!pdef.id) pdef.id = `prop_${idx}`;
      const p = new PropClass(pdef);
      this.props[pdef.id] = p;
      this.scene.add(p.mesh);
      this.propMeshes.push(p.mesh);
    });

    // Enemy firing callback
    const fireCallback = (origin, target, speed = 28) => {
      this.spawnProjectile(
        new THREE.Vector3(origin.x, origin.y, origin.z),
        new THREE.Vector3(target.x, target.y, target.z),
        speed
      );
    };

    // Load enemies
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

      const e = new Enemy(this.scene, def, edef, this.player, fireCallback);

      // Initialize frame-based hit protection
      e.lastHitFrame = -1;

      this.enemies[e.id] = e;
      if (e.mesh) this.enemyMeshes.push(e.mesh);
    });

    this.objective = sceneDef.objective ?? null;
    this._notifyLoaded();
  }

  _notifyLoaded() {
    window.dispatchEvent(
      new CustomEvent("sceneLoaded", {
        detail: { scene: this.sceneDef }
      })
    );
  }

  spawnProjectile(startPos, targetPos, speed = 1) {
    const id = "proj_" + (this.nextProjectileId++);
    const dir = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
    const p = new Projectile({
      id,
      scene: this.scene,
      startPos: startPos.clone(),
      direction: dir,
      speed
    });

    this.projectiles[id] = p;
    this.projectileMeshes.push(p.mesh);
    return p;
  }

  unloadScene() {
    // Remove background
    if (this.bgMesh) {
      this.scene.remove(this.bgMesh);
      this.bgMesh.geometry.dispose();
      this.bgMesh.material.dispose();
      this.bgMesh = null;
    }

    // Remove projectiles
    Object.values(this.projectiles).forEach((p) => {
      try { p.dispose(); } catch (e) {}
    });
    this.projectiles = {};
    this.projectileMeshes = [];

    // Remove enemies
    Object.values(this.enemies).forEach((en) => {
      try { en.dispose(); } catch (e) {}
    });
    this.enemies = {};
    this.enemyMeshes = [];

    // Remove props
    Object.values(this.props).forEach((pr) => {
      try { pr.dispose(); } catch (e) {}
    });
    this.props = {};
    this.propMeshes = [];
  }

  update(deltaMs, nowMs) {
    this.frameCount++;

    Object.values(this.enemies).forEach((en) => {
      try { en.update(deltaMs, nowMs, this.player); } catch (e) {}
    });

    // Update projectiles
    Object.entries(this.projectiles).forEach(([id, proj]) => {
      proj.update(deltaMs);
      if (proj.isExpired(nowMs)) {
        proj.dispose();
        delete this.projectiles[id];
      }
    });
  }

  applyDamageToMesh(mesh, damage = 1) {
    if (!mesh) return false;
    let obj = mesh;

    while (obj && obj.userData && !obj.userData.enemyId && !obj.userData.propId) {
      obj = obj.parent;
    }

    if (!obj || !obj.userData) {
      console.warn("[SceneLoader] Hit object has no enemyId or propId");
      return false;
    }

    // Enemy hit
    if (obj.userData.enemyId) {
      const id = obj.userData.enemyId;
      const en = this.enemies[id];
      if (!en) return false;
      if (en.lastHitFrame === this.frameCount) return true;
      en.lastHitFrame = this.frameCount;
      en.takeDamage(damage);
      this._checkObjectiveAfterHit();
      return true;
    }

    // Prop hit
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
