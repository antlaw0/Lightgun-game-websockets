import { Explosion } from './explosion.js';

import { Enemy } from "./enemy.js";
import { Prop as PropClass } from "./prop.js";
import { ENEMY_DEFS } from "./scenes.js";
import { Projectile } from "./projectile.js";

export class SceneLoader {
  constructor(scene, camera, player) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    // --- NOTE: changed from object maps to arrays for runtime lists ---
    // Arrays are authoritative for iteration; maps exist for O(1) lookup by id.
    this.enemies = [];         // array of Enemy instances
    this.enemiesById = {};     // map id -> Enemy

    this.props = [];           // array of Prop instances
    this.propsById = {};       // map id -> Prop

    // meshes lists used for raycasting / intersectables (kept in sync by helpers)
    this.enemyMeshes = [];
    this.propMeshes = [];

    // projectiles (kept as map like before)
    this.projectiles = {};
    this.projectileMeshes = [];
    this.nextProjectileId = 1;

    // explosions tracked by SceneLoader (Explosion instances pushed via addExplosion)
    this.explosions = [];      // array of explosion instances (any object with update/destroy/dispose)

    this.sceneDef = null;
    this.roomMeshes = [];

    this.frameCount = 0;

    this.roomWidth = 10;
    this.roomHeight = 5;
    this.roomDepth = 12;

    this.padding = 2;

    this.sceneLights = [];
  }

  // -------------------------
  // Registration helpers
  // -------------------------
  addProp(propInstance) {
    if (!propInstance || !propInstance.mesh) return;
    // push into array and map
    this.props.push(propInstance);
    if (propInstance.id) this.propsById[propInstance.id] = propInstance;

    // scene + mesh tracking
    this.scene.add(propInstance.mesh);
    this.propMeshes.push(propInstance.mesh);
  }

  addEnemy(enemyInstance) {
    if (!enemyInstance || !enemyInstance.mesh) return;
    this.enemies.push(enemyInstance);
    if (enemyInstance.id) this.enemiesById[enemyInstance.id] = enemyInstance;

    this.scene.add(enemyInstance.mesh);
    this.enemyMeshes.push(enemyInstance.mesh);
  }

  addExplosion(explosionInstance) {
    if (!explosionInstance) return;
    this.explosions.push(explosionInstance);
    // If the explosion has a mesh or points object, SceneLoader won't assume the property name.
    // Explosion author should add its mesh to scene themselves or expose `mesh` property for us to add.
    if (explosionInstance.mesh) this.scene.add(explosionInstance.mesh);
    // If explosion exposes `addToScene(scene)` use it (optional)
    if (typeof explosionInstance.addToScene === "function") explosionInstance.addToScene(this.scene);
  }

  // -----------------------------
  // Lights (unchanged)
  // -----------------------------
  _createLights() {
    if (!this.sceneDef || !Array.isArray(this.sceneDef.lights) || this.sceneDef.lights.length === 0) {
      this.sceneLights.forEach(light => this.scene.remove(light));
      this.sceneLights = [];
      return;
    }

    this.sceneLights.forEach(light => this.scene.remove(light));
    this.sceneLights = [];

    this.sceneDef.lights.forEach((lightDef) => {
      let light = null;

      switch (lightDef.type) {
        case "ambient":
          light = new THREE.AmbientLight(lightDef.color ?? 0xffffff, lightDef.intensity ?? 1);
          break;

        case "directional":
          light = new THREE.DirectionalLight(lightDef.color ?? 0xffffff, lightDef.intensity ?? 1);
          if (lightDef.position) {
            light.position.set(lightDef.position.x, lightDef.position.y, lightDef.position.z);
          }
          if (lightDef.target) {
            const target = new THREE.Object3D();
            target.position.set(lightDef.target.x, lightDef.target.y, lightDef.target.z);
            this.scene.add(target);
            light.target = target;
          }
          break;

        case "point":
          light = new THREE.PointLight(
            lightDef.color ?? 0xffffff,
            lightDef.intensity ?? 1,
            lightDef.distance ?? 0,
            lightDef.decay ?? 1
          );
          if (lightDef.position) {
            light.position.set(lightDef.position.x, lightDef.position.y, lightDef.position.z);
          }
          break;

        case "spot":
          light = new THREE.SpotLight(
            lightDef.color ?? 0xffffff,
            lightDef.intensity ?? 1,
            lightDef.distance ?? 0,
            lightDef.angle ?? Math.PI / 4,
            lightDef.penumbra ?? 0,
            lightDef.decay ?? 1
          );
          if (lightDef.position) {
            light.position.set(lightDef.position.x, lightDef.position.y, lightDef.position.z);
          }
          if (lightDef.target) {
            const target = new THREE.Object3D();
            target.position.set(lightDef.target.x, lightDef.target.y, lightDef.target.z);
            this.scene.add(target);
            light.target = target;
          }
          break;

        default:
          console.warn("Unknown light type:", lightDef.type);
          break;
      }

      if (light) {
        this.scene.add(light);
        this.sceneLights.push(light);
      }
    });
  }

  // -----------------------------
  // Load Scene (adjusted)
  // -----------------------------
  loadScene(sceneDef) {
    this.unloadScene();
    this.sceneDef = sceneDef;

    console.log(`SceneLoader loading scene: ${sceneDef.name}`);

    // Props (including full-cover walls)
    const staticObjs = sceneDef.environment?.staticObjects ?? [];
    staticObjs.forEach((pdef, idx) => {
      if (!pdef.id) pdef.id = `prop_${idx}`;

      const p = new PropClass({
        ...pdef,
        id: pdef.id,
        coverType: pdef.coverType ?? "none"
      });

      // ensure mesh userData has propId, keep compatibility
      p.mesh.userData = Object.assign(p.mesh.userData || {}, {
        propId: pdef.id,
        coverType: pdef.coverType ?? "none",
        size: pdef.size
      });

      // register via helper
      this.addProp(p);
    });

    // Enemies
    const enemyDefs = sceneDef.enemies ?? [];
    enemyDefs.forEach((edef) => {
      if (!edef.type) return;
      const def = ENEMY_DEFS[edef.type];
      if (!def) return;

      const e = new Enemy(this.scene, def, edef, this.player, () => {});
      e.lastHitFrame = -1;

      // register via helper
      this.addEnemy(e);
    });

    // Construct room around enemies/props
    this._calculateRoomBounds();
    //this._createRoom();

    // Lights must be created AFTER room and AFTER sceneDef exists
    this._createLights();

    // Enemy firing callback
    const fireCallback = (origin, target, speed = 28) => {
      this.spawnProjectile(
        new THREE.Vector3(origin.x, origin.y, origin.z),
        new THREE.Vector3(target.x, target.y, target.z),
        speed
      );
    };

    // assign callbacks to enemies we created
    enemyDefs.forEach((edef) => {
      const e = this.enemiesById[edef.id];
      if (e) e.fireCallback = fireCallback;
    });

    this.objective = sceneDef.objective ?? null;

    this._notifyLoaded();
  }

  // -----------------------------
  // Calculate Room Bounds (adjusted to arrays)
  // -----------------------------
  _calculateRoomBounds() {
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    // Props: iterate array
    this.props.forEach(p => {
      const sx = p.size.x / 2;
      const sy = p.size.y;
      const sz = p.size.z / 2;

      minX = Math.min(minX, p.position.x - sx);
      maxX = Math.max(maxX, p.position.x + sx);
      minY = Math.min(minY, p.position.y);
      maxY = Math.max(maxY, p.position.y + sy);
      minZ = Math.min(minZ, p.position.z - sz);
      maxZ = Math.max(maxZ, p.position.z + sz);
    });

    // Enemies: iterate array
    this.enemies.forEach(e => {
      const pos = e.mesh?.position ?? { x: 0, y: 0, z: 0 };
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y + 1);
      minZ = Math.min(minZ, pos.z);
      maxZ = Math.max(maxZ, pos.z);
    });

    // Padding
    minX -= this.padding;
    maxX += this.padding;
    minY -= this.padding;
    maxY += this.padding;
    minZ -= this.padding;
    maxZ += this.padding;

    // Room size
    this.roomWidth = maxX - minX;
    this.roomHeight = maxY - minY;
    this.roomDepth = maxZ - minZ;

    // Room center offset
    this.roomCenterOffset = new THREE.Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
    );

    // Shift props and enemies so room center is at origin
    this.props.forEach(p => {
      p.mesh.position.sub(this.roomCenterOffset);
      // keep prop logical position in sync too
      if (p.position && p.position.x !== undefined) {
        p.position.x -= this.roomCenterOffset.x;
        p.position.y -= this.roomCenterOffset.y;
        p.position.z -= this.roomCenterOffset.z;
      }
    });
    this.enemies.forEach(e => {
      if (e.mesh) e.mesh.position.sub(this.roomCenterOffset);
      if (e.basePosition) e.basePosition.sub(this.roomCenterOffset);
    });
  }

  // -----------------------------
  // Create Room (unchanged)
  // -----------------------------
  _createRoom() {
    const w = this.roomWidth;
    const h = this.roomHeight;
    const d = this.roomDepth;

    const texLoader = new THREE.TextureLoader();
    const roomTex = this.sceneDef.roomTextures || {};

    const floorMat = roomTex.floor
      ? new THREE.MeshBasicMaterial({ map: texLoader.load(roomTex.floor) })
      : new THREE.MeshBasicMaterial({ color: 0x444444 });

    const ceilingMat = roomTex.ceiling
      ? new THREE.MeshBasicMaterial({ map: texLoader.load(roomTex.ceiling) })
      : new THREE.MeshBasicMaterial({ color: 0x666666 });

    const wallMat = roomTex.wall
      ? new THREE.MeshBasicMaterial({ map: texLoader.load(roomTex.wall), side: THREE.DoubleSide })
      : new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide });

    const floorGeo = new THREE.PlaneGeometry(w, d);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0);
    floor.position.sub(this.roomCenterOffset);
    this.scene.add(floor);
    this.roomMeshes.push(floor);

    const ceilingGeo = new THREE.PlaneGeometry(w, d);
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, h, 0);
    ceiling.position.sub(this.roomCenterOffset);
    this.scene.add(ceiling);
    this.roomMeshes.push(ceiling);

    const backWallGeo = new THREE.PlaneGeometry(w, h);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, h / 2, -d / 2);
    backWall.position.sub(this.roomCenterOffset);
    this.scene.add(backWall);
    this.roomMeshes.push(backWall);

    const sideWallGeo = new THREE.PlaneGeometry(d, h);
    const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-w / 2, h / 2, -d / 2);
    leftWall.position.sub(this.roomCenterOffset);
    this.scene.add(leftWall);
    this.roomMeshes.push(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(w / 2, h / 2, -d / 2);
    rightWall.position.sub(this.roomCenterOffset);
    this.scene.add(rightWall);
    this.roomMeshes.push(rightWall);
  }

  // -----------------------------
  // Projectiles (unchanged)
  // -----------------------------
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

  // -----------------------------
  // Unload Scene (adjusted to arrays)
  // -----------------------------
  unloadScene() {
    // Clear room
    this.roomMeshes.forEach((m) => {
      this.scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    });
    this.roomMeshes = [];

    // Clear lights
    this.sceneLights.forEach(light => this.scene.remove(light));
    this.sceneLights = [];

    // Projectiles
    Object.values(this.projectiles).forEach((p) => { try { p.dispose(); } catch {} });
    this.projectiles = {};
    this.projectileMeshes = [];

    // Enemies
    this.enemies.forEach((en) => { try { en.dispose(); } catch {} });
    this.enemies = [];
    this.enemiesById = {};
    this.enemyMeshes = [];

    // Props
    this.props.forEach((pr) => { try { pr.dispose(); } catch {} });
    this.props = [];
    this.propsById = {};
    this.propMeshes = [];

    // Explosions
    this.explosions.forEach((ex) => { try { if (typeof ex.destroy === 'function') ex.destroy(); if (typeof ex.dispose === 'function') ex.dispose(); } catch {} });
    this.explosions = [];
  }

  // -----------------------------
  // Update (enemies, projectiles, explosions)
  // -----------------------------
  update(deltaMs, nowMs) {
    this.frameCount++;
// SceneLoader.update(deltaMs)
    // Enemies (iterate array)
    this.enemies.forEach((en) => {
      try { en.update(deltaMs, nowMs, this.player); } catch (e) { console.warn("Enemy update error", e); }
    });

    // Projectiles
    Object.entries(this.projectiles).forEach(([id, proj]) => {
      proj.update(deltaMs);
      if (proj.isExpired(nowMs)) {
        proj.dispose();
        delete this.projectiles[id];
      }
    });

    // Explosions: call update on each; remove and cleanup when finished.
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      try {
        if (typeof ex.update === "function") {
          ex.update(deltaMs / 1000);
        }
        // Remove if the explosion exposes an isExpired/isDone function
        let expired = false;
        if (typeof ex.isExpired === "function") expired = ex.isExpired();
        else if (typeof ex.isDone === "boolean") expired = ex.isDone;
        else if (typeof ex.age === "number" && typeof ex.lifespan === "number") {
          if (ex.age >= ex.lifespan) expired = true;
        }

        if (expired) {
          if (typeof ex.destroy === "function") ex.destroy();
          if (typeof ex.dispose === "function") ex.dispose();
          // remove from scene if it has a mesh/points
          if (ex.mesh && ex.mesh.parent) ex.mesh.parent.remove(ex.mesh);
          this.explosions.splice(i, 1);
        }
      } catch (e) {
        console.warn("Explosion update error", e);
        // best-effort remove if it throws repeatedly
        try {
          if (typeof ex.destroy === "function") ex.destroy();
          if (typeof ex.dispose === "function") ex.dispose();
          if (ex.mesh && ex.mesh.parent) ex.mesh.parent.remove(ex.mesh);
        } catch (e2) {}
        this.explosions.splice(i, 1);
      }
    }
  }

  // -----------------------------
  // Damage Handling (adapted to arrays/maps)
  // -----------------------------
  applyDamageToMesh(mesh, damage = 1) {
    if (!mesh) return false;

    let obj = mesh;
    while (obj && obj.userData && !obj.userData.enemyId && !obj.userData.propId) {
      obj = obj.parent;
    }

    if (!obj || !obj.userData) return false;

    // Enemy
    if (obj.userData.enemyId) {
      const en = this.enemiesById[obj.userData.enemyId];
      if (!en) return false;

      if (en.lastHitFrame === this.frameCount) return true; // prevent multi-hit
      en.lastHitFrame = this.frameCount;

      en.takeDamage(damage);
      this._checkObjectiveAfterHit();
      return true;
    }

    // Prop
    if (obj.userData.propId) {
      const pr = this.propsById[obj.userData.propId];
      if (pr) {
        const died = pr.takeDamage(damage);
        if (died) {
          // remove from arrays/maps
          // Note: Prop.takeDamage / _die should already remove mesh from scene; we still cleanup references
          const idx = this.props.indexOf(pr);
          if (idx >= 0) this.props.splice(idx, 1);
          delete this.propsById[obj.userData.propId];
          // remove mesh from propMeshes
          const pmIdx = this.propMeshes.findIndex(m => m.userData && m.userData.propId === obj.userData.propId);
          if (pmIdx >= 0) this.propMeshes.splice(pmIdx, 1);
        }
      }
      return true;
    }

    return false;
  }

  // -----------------------------
  // Objective Check
  // -----------------------------
  _checkObjectiveAfterHit() {
    if (!this.objective) return;

    if (this.objective.type === "eliminateAllEnemies") {
      const remaining = this.enemies.filter(e => !e._isDead);
      if (remaining.length === 0) {
        if (typeof window.onSceneComplete === "function") {
          window.onSceneComplete(this.sceneDef);
        } else {
          window.dispatchEvent(new CustomEvent("sceneComplete", {
            detail: { scene: this.sceneDef }
          }));
        }
      }
    }
  }

  // -----------------------------
  // Raycasting Mesh List
  // -----------------------------
  getIntersectableMeshes() {
    // Return a shallow copy of the arrays to avoid accidental mutation by callers
    return [...this.enemyMeshes, ...this.propMeshes];
  }

  // -----------------------------
  _notifyLoaded
  // -----------------------------
  _notifyLoaded() {
    if (typeof window.onSceneLoaded === "function") {
      window.onSceneLoaded(this.sceneDef);
    }
  }

  // -----------------------------
  // Scene / resource cleanup helper
  // -----------------------------
  clearScene() {
    // Remove props
    for (const p of this.props) {
      if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
      try { p.dispose?.(); } catch {}
    }
    this.props.length = 0;
    this.propsById = {};
    this.propMeshes = [];

    // Remove enemies
    for (const e of this.enemies) {
      if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
      try { e.dispose?.(); } catch {}
    }
    this.enemies.length = 0;
    this.enemiesById = {};
    this.enemyMeshes = [];

    // Explosions
    for (const ex of this.explosions) {
      try {
        if (typeof ex.destroy === "function") ex.destroy();
        if (typeof ex.dispose === "function") ex.dispose();
      } catch {}
      if (ex.mesh && ex.mesh.parent) ex.mesh.parent.remove(ex.mesh);
    }
    this.explosions.length = 0;
  }
}

window.spawnTestExplosion = function(
  x = 0,
  y = 1,
  z = 0,
  blastRadius = 4
) {
  if (!window.sceneLoader) {
    console.warn("sceneLoader not found!");
    return;
  }

  const pos = new THREE.Vector3(x, y, z);

  const explosion = new Explosion(
    window.sceneLoader.scene,
    pos,
    {
      blastRadius,
      floorY: y - 0.1 // catwalk-safe
    }
  );

  window.sceneLoader.addExplosion(explosion);

  console.log(`Spawned explosion at (${x}, ${y}, ${z})`);
};
