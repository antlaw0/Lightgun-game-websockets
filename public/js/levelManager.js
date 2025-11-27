// js/levelManager.js
//import * as THREE from './lib/three.module.js';

import { LEVELS, ENEMY_DEFS } from "./scenes.js";
import { Enemy } from "./enemy.js";

export class LevelManager {
  constructor(scene, camera, playerRef) {
    // `scene` is your THREE.Scene root
    // `camera` optional if you need to orient sprites to camera
    // `playerRef` is an object with e.g. takeDamage(damage), position, etc.
    this.scene = scene;
    this.camera = camera;
    this.player = playerRef;

    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    // For static objects / environment
    this.staticGroup = new THREE.Group();
    this.rootGroup.add(this.staticGroup);

    // enemy group
    this.enemyGroup = new THREE.Group();
    this.rootGroup.add(this.enemyGroup);

    this.currentLevelKey = null;
    this.currentSceneIndex = -1;
    this.enemies = {}; // id -> Enemy instance
    this.pendingEnemyCount = 0;

    // Hook events
    window.addEventListener("enemyDied", (e) => {
      this.onEnemyDied(e.detail.id);
    });
    window.addEventListener("enemyFiredHitPlayer", (e) => {
      const dmg = e.detail.damage || 1;
      if (this.player && typeof this.player.takeDamage === "function") {
        this.player.takeDamage(dmg);
      } else {
        console.warn("[LevelManager] player.takeDamage not available.");
      }
    });
  }

  loadLevel(levelKey) {
    if (!LEVELS[levelKey]) {
      throw new Error("Unknown level: " + levelKey);
    }
    this.currentLevelKey = levelKey;
    this.currentSceneIndex = -1;
    console.log(`[LevelManager] Loaded level ${levelKey}`);
    this.nextScene();
  }

  clearScene() {
    // dispose enemies
    Object.values(this.enemies).forEach((en) => {
      try { en.dispose(); } catch (err) { console.warn(err); }
    });
    this.enemies = {};
    // clear groups
    while (this.staticGroup.children.length) this.staticGroup.remove(this.staticGroup.children[0]);
    while (this.enemyGroup.children.length) this.enemyGroup.remove(this.enemyGroup.children[0]);
  }

  nextScene() {
    const level = LEVELS[this.currentLevelKey];
    if (!level) return;
    const nextIndex = this.currentSceneIndex + 1;
    if (nextIndex >= level.scenes.length) {
      console.log(`[LevelManager] Level ${this.currentLevelKey} complete!`);
      // dispatch levelComplete
      window.dispatchEvent(new CustomEvent("levelComplete", { detail: { level: this.currentLevelKey } }));
      return;
    }
    this.loadScene(nextIndex);
  }

  loadScene(index) {
    this.clearScene();
    this.currentSceneIndex = index;
    const level = LEVELS[this.currentLevelKey];
    const sceneDef = level.scenes[index];
    console.log(`[LevelManager] Loading scene ${index}: ${sceneDef.name}`);

    // Create static objects
    sceneDef.environment?.staticObjects?.forEach((obj, idx) => {
      // For now we create simple boxes for crates and planes for catwalk - swap with real models later
      if (obj.type === "crate") {
        const g = new THREE.BoxGeometry(1, 1, 1);
        const m = new THREE.MeshBasicMaterial({ color: 0x8b5a2b });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(obj.position.x, obj.position.y + 0.5, obj.position.z);
        this.staticGroup.add(mesh);
      } else if (obj.type === "catwalk") {
        const g = new THREE.BoxGeometry(4, 0.2, 1);
        const m = new THREE.MeshBasicMaterial({ color: 0x666666 });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
        this.staticGroup.add(mesh);
      } else {
        // placeholder: simple sphere
        const g = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const m = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
        this.staticGroup.add(mesh);
      }
    });

    // Spawn enemies
    const enemies = sceneDef.enemies || [];
    this.pendingEnemyCount = enemies.length;

    enemies.forEach((inst) => {
      const def = ENEMY_DEFS[inst.type];
      if (!def) {
        console.warn("Unknown enemy type:", inst.type);
        return;
      }
      const enemy = new Enemy(this.enemyGroup, def, inst);
      this.enemies[enemy.id] = enemy;
    });

    console.log(`[LevelManager] Scene loaded: enemies=${Object.keys(this.enemies).length}`);
  }

  onEnemyDied(enemyId) {
    if (this.enemies[enemyId]) {
      delete this.enemies[enemyId];
    }
    this.pendingEnemyCount = Math.max(0, this.pendingEnemyCount - 1);
    console.log(`[LevelManager] Enemy died: ${enemyId} - remaining ${this.pendingEnemyCount}`);
    if (this.pendingEnemyCount <= 0) {
      console.log("[LevelManager] Scene objective complete!");
      // small delay before moving to next scene
      setTimeout(() => this.nextScene(), 850);
    }
  }

  update(deltaMs, nowMs) {
    // update enemies
    Object.values(this.enemies).forEach((en) => {
      en.update(deltaMs, nowMs, this.player);
    });
  }
}
