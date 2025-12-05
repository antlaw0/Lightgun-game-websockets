import { Enemy } from "./enemy.js";
import { Prop as PropClass } from "./prop.js";
import { ENEMY_DEFS } from "./scenes.js";
import { Projectile } from "./projectile.js";
//import * as THREE from "three"; // Make sure THREE is available

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
    this.roomMeshes = []; // store room walls/floor/ceiling

    // Used to avoid multi-hit bug
    this.frameCount = 0;

    // Room dimensions, will be auto-calculated
    this.roomWidth = 10;
    this.roomHeight = 5;
    this.roomDepth = 12;

    // Extra padding around objects
    this.padding = 2;
  }

  loadScene(sceneDef) {
    this.unloadScene();
    this.sceneDef = sceneDef;

    console.log(`[SceneLoader] loading scene: ${sceneDef.name}`);

    // Load static objects first to get positions
    const staticObjs = sceneDef.environment?.staticObjects ?? [];
    staticObjs.forEach((pdef, idx) => {
      if (!pdef.id) pdef.id = `prop_${idx}`;
      const p = new PropClass(pdef);
      this.props[pdef.id] = p;
      this.scene.add(p.mesh);
      this.propMeshes.push(p.mesh);
    });

    // Load enemies to get positions
    const enemyDefs = sceneDef.enemies ?? [];
    enemyDefs.forEach((edef) => {
      if (!edef.type) return;
      const def = ENEMY_DEFS[edef.type];
      if (!def) return;
      const e = new Enemy(this.scene, def, edef, this.player, () => {});
      e.lastHitFrame = -1;
      this.enemies[e.id] = e;
      if (e.mesh) this.enemyMeshes.push(e.mesh);
    });

    // ------------------ Auto-calculate room dimensions ------------------
    this._calculateRoomBounds();
    this._createRoom();

    // Enemy firing callback (after room creation)
    const fireCallback = (origin, target, speed = 28) => {
      this.spawnProjectile(
        new THREE.Vector3(origin.x, origin.y, origin.z),
        new THREE.Vector3(target.x, target.y, target.z),
        speed
      );
    };

    // Re-initialize enemies with real callback
    enemyDefs.forEach((edef) => {
      if (!edef.type) return;
      const e = this.enemies[edef.id];
      if (e) e.fireCallback = fireCallback;
    });

    this.objective = sceneDef.objective ?? null;
    this._notifyLoaded();
  }

  _calculateRoomBounds() {
    let minX = Infinity, maxX = -Infinity;
    let minY = 0, maxY = -Infinity; // floor = 0
    let minZ = Infinity, maxZ = -Infinity;

    // Include props
    Object.values(this.props).forEach((p) => {
      const sx = p.size.x / 2;
      const sy = p.size.y;
      const sz = p.size.z / 2;
      minX = Math.min(minX, p.position.x - sx);
      maxX = Math.max(maxX, p.position.x + sx);
      minY = Math.max(maxY, p.position.y + sy); // track highest object
      minZ = Math.min(minZ, p.position.z - sz);
      maxZ = Math.max(maxZ, p.position.z + sz);
    });

    // Include enemies (assume 1 unit tall if size unknown)
    Object.values(this.enemies).forEach((e) => {
      const pos = e.mesh?.position ?? { x: 0, y: 0, z: 0 };
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y + 1); // assume 1 unit height
      minZ = Math.min(minZ, pos.z);
      maxZ = Math.max(maxZ, pos.z);
    });

    // Apply padding
    minX -= this.padding;
    maxX += this.padding;
    maxY += this.padding;
    minZ -= this.padding;
    maxZ += this.padding;

    this.roomWidth = maxX - minX;
    this.roomHeight = maxY;
    this.roomDepth = maxZ - minZ;

    // Center offset
    this.roomCenterOffset = new THREE.Vector3(
      (minX + maxX) / 2,
      this.roomHeight / 2,
      (minZ + maxZ) / 2
    );

    // Move props and enemies relative to center
    Object.values(this.props).forEach((p) => {
      p.mesh.position.sub(this.roomCenterOffset);
    });
    Object.values(this.enemies).forEach((e) => {
      if (e.mesh) e.mesh.position.sub(this.roomCenterOffset);
    });
  }

  _createRoom() {
  const w = this.roomWidth;
  const h = this.roomHeight;
  const d = this.roomDepth;

  // Load textures from scene definition if available
  const texLoader = new THREE.TextureLoader();
  const roomTex = this.sceneDef.roomTextures || {};
  
  const floorMat = roomTex.floor
    ? new THREE.MeshStandardMaterial({ map: texLoader.load(roomTex.floor) })
    : new THREE.MeshStandardMaterial({ color: 0x444444 });

  const ceilingMat = roomTex.ceiling
    ? new THREE.MeshStandardMaterial({ map: texLoader.load(roomTex.ceiling) })
    : new THREE.MeshStandardMaterial({ color: 0x666666 });

  const wallMat = roomTex.wall
    ? new THREE.MeshStandardMaterial({ map: texLoader.load(roomTex.wall), side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ color: 0x888888, side: THREE.DoubleSide });

  // Floor
  const floorGeo = new THREE.PlaneGeometry(w, d);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  this.scene.add(floor);
  this.roomMeshes.push(floor);

  // Ceiling
  const ceilingGeo = new THREE.PlaneGeometry(w, d);
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, h, 0);
  this.scene.add(ceiling);
  this.roomMeshes.push(ceiling);

  // Back wall
  const backWallGeo = new THREE.PlaneGeometry(w, h);
  const backWall = new THREE.Mesh(backWallGeo, wallMat);
  backWall.position.set(0, h / 2, -d / 2);
  this.scene.add(backWall);
  this.roomMeshes.push(backWall);

  // Left wall
  const sideWallGeo = new THREE.PlaneGeometry(d, h);
  const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-w / 2, h / 2, -d / 2);
  this.scene.add(leftWall);
  this.roomMeshes.push(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(w / 2, h / 2, -d / 2);
  this.scene.add(rightWall);
  this.roomMeshes.push(rightWall);
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
    // Remove room meshes
    this.roomMeshes.forEach((m) => {
      this.scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    });
    this.roomMeshes = [];

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
