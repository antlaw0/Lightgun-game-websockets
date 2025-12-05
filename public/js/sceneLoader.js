import { Enemy } from "./enemy.js";
import { Prop as PropClass } from "./prop.js";
import { ENEMY_DEFS } from "./scenes.js";
import { Projectile } from "./projectile.js";

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
    this.roomMeshes = [];

    this.frameCount = 0;

    this.roomWidth = 10;
    this.roomHeight = 5;
    this.roomDepth = 12;

    this.padding = 2;

    this.sceneLights = [];
  }

  // -------------------------------------------------------------
  // Lights
  // -------------------------------------------------------------
  _createLights() {
    // nothing to do if no lights array
    if (!this.sceneDef || !Array.isArray(this.sceneDef.lights) || this.sceneDef.lights.length === 0) {
      // ensure any previous lights are removed
      this.sceneLights.forEach(light => this.scene.remove(light));
      this.sceneLights = [];
      return;
    }

    // Clear old lights
    this.sceneLights.forEach(light => this.scene.remove(light));
    this.sceneLights = [];

    // Create new lights from definition
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
  
  // -------------------------------------------------------------
  // Load Scene
  // -------------------------------------------------------------
  loadScene(sceneDef) {
    this.unloadScene();
    this.sceneDef = sceneDef;

    console.log(`SceneLoader loading scene: ${sceneDef.name}`);

    // Props (including full-cover walls)
const staticObjs = sceneDef.environment?.staticObjects ?? [];
staticObjs.forEach((pdef, idx) => {
  // Ensure ID
if (!pdef.id) pdef.id = `prop_${idx}`;
  
  // Create PropClass with full wall support
  // Pass the full definition to PropClass
const p = new PropClass({
    ...pdef,
    id: pdef.id,
    coverType: pdef.coverType ?? "none"
});

  this.props[pdef.id] = p;

  // Let enemies / raycast know what this object is
  p.mesh.userData = {
    propId: pdef.id,
    coverType: pdef.coverType ?? "none",
    size: pdef.size
  };

  this.scene.add(p.mesh);
  this.propMeshes.push(p.mesh);
});

// Enemies
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

    // Construct room around enemies/props
    this._calculateRoomBounds();
    this._createRoom();

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

    enemyDefs.forEach((edef) => {
      const e = this.enemies[edef.id];
      if (e) e.fireCallback = fireCallback;
    });

    this.objective = sceneDef.objective ?? null;

    this._notifyLoaded();
  }

  // -------------------------------------------------------------
  // Calculate Room Bounds
  // -------------------------------------------------------------
  _calculateRoomBounds() {
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    // Props
    Object.values(this.props).forEach(p => {
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

    // Enemies
    Object.values(this.enemies).forEach(e => {
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
    Object.values(this.props).forEach(p => {
        p.mesh.position.sub(this.roomCenterOffset);
    });
    Object.values(this.enemies).forEach(e => {
        if (e.mesh) e.mesh.position.sub(this.roomCenterOffset);
    });
}

  // -------------------------------------------------------------
  // Create Room
  // -------------------------------------------------------------
  _createRoom() {
    const w = this.roomWidth;
    const h = this.roomHeight;
    const d = this.roomDepth;

    const texLoader = new THREE.TextureLoader();
    const roomTex = this.sceneDef.roomTextures || {};

    // Materials
    const floorMat = roomTex.floor
      ? new THREE.MeshBasicMaterial({ map: texLoader.load(roomTex.floor) })
      : new THREE.MeshBasicMaterial({ color: 0x444444 });

    const ceilingMat = roomTex.ceiling
      ? new THREE.MeshBasicMaterial({ map: texLoader.load(roomTex.ceiling) })
      : new THREE.MeshBasicMaterial({ color: 0x666666 });

    const wallMat = roomTex.wall
      ? new THREE.MeshBasicMaterial({ map: texLoader.load(roomTex.wall), side: THREE.DoubleSide })
      : new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide });

    // Floor
    const floorGeo = new THREE.PlaneGeometry(w, d);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0);
    floor.position.sub(this.roomCenterOffset); // <-- align with shifted props
    this.scene.add(floor);
    this.roomMeshes.push(floor);

    // Ceiling
    const ceilingGeo = new THREE.PlaneGeometry(w, d);
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, h, 0);
    ceiling.position.sub(this.roomCenterOffset);
    this.scene.add(ceiling);
    this.roomMeshes.push(ceiling);

    // Back wall
    const backWallGeo = new THREE.PlaneGeometry(w, h);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, h / 2, -d / 2);
    backWall.position.sub(this.roomCenterOffset);
    this.scene.add(backWall);
    this.roomMeshes.push(backWall);

    // Left wall
    const sideWallGeo = new THREE.PlaneGeometry(d, h);
    const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-w / 2, h / 2, -d / 2);
    leftWall.position.sub(this.roomCenterOffset);
    this.scene.add(leftWall);
    this.roomMeshes.push(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(w / 2, h / 2, -d / 2);
    rightWall.position.sub(this.roomCenterOffset);
    this.scene.add(rightWall);
    this.roomMeshes.push(rightWall);
}

  // -------------------------------------------------------------
  // Projectiles
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // Unload Scene
  // -------------------------------------------------------------
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
    Object.values(this.enemies).forEach((en) => { try { en.dispose(); } catch {} });
    this.enemies = {};
    this.enemyMeshes = [];

    // Props
    Object.values(this.props).forEach((pr) => { try { pr.dispose(); } catch {} });
    this.props = {};
    this.propMeshes = [];
  }

  // -------------------------------------------------------------
  // Update
  // -------------------------------------------------------------
  update(deltaMs, nowMs) {
    this.frameCount++;

    Object.values(this.enemies).forEach((en) => {
      try { en.update(deltaMs, nowMs, this.player); } catch {}
    });

    Object.entries(this.projectiles).forEach(([id, proj]) => {
      proj.update(deltaMs);
      if (proj.isExpired(nowMs)) {
        proj.dispose();
        delete this.projectiles[id];
      }
    });
  }

  // -------------------------------------------------------------
  // Damage Handling
  // -------------------------------------------------------------
  applyDamageToMesh(mesh, damage = 1) {
    if (!mesh) return false;

    let obj = mesh;
    while (obj && obj.userData && !obj.userData.enemyId && !obj.userData.propId) {
      obj = obj.parent;
    }

    if (!obj || !obj.userData) return false;

    // Enemy
    if (obj.userData.enemyId) {
      const en = this.enemies[obj.userData.enemyId];
      if (!en) return false;

      if (en.lastHitFrame === this.frameCount) return true; // prevent multi-hit
      en.lastHitFrame = this.frameCount;

      en.takeDamage(damage);
      this._checkObjectiveAfterHit();
      return true;
    }

    // Prop
    if (obj.userData.propId) {
      const pr = this.props[obj.userData.propId];
      if (pr) {
        const died = pr.takeDamage(damage);
        if (died) delete this.props[obj.userData.propId];
      }
      return true;
    }

    return false;
  }

  // -------------------------------------------------------------
  // Objective Check
  // -------------------------------------------------------------
  _checkObjectiveAfterHit() {
    if (!this.objective) return;

    if (this.objective.type === "eliminateAllEnemies") {
      const remaining = Object.values(this.enemies).filter(e => !e._isDead);
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

  // -------------------------------------------------------------
  // Raycasting Mesh List
  // -------------------------------------------------------------
  getIntersectableMeshes() {
    return [...this.enemyMeshes, ...this.propMeshes];
  }

  // -------------------------------------------------------------
  _notifyLoaded() {
    if (typeof window.onSceneLoaded === "function") {
      window.onSceneLoaded(this.sceneDef);
    }
  }
}