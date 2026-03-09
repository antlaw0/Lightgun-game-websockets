import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { buildPrefab } from '../prefabLibrary.js';
import { Door } from './door.js';
import { Enemy } from '../enemy.js';
import { Prop as PropClass } from '../prop.js';
import { ENEMY_DEFS } from '../listOfEnemies.js';
import { PROP_DEFS } from '../listOfprops.js';
import { cloneDef, toRadiansIfNeeded } from './utils.js';

export function loadSceneDataEntities(self, sceneDef, isPending) {
  if (!isPending) {
    self.sceneDef = sceneDef;
    console.log(`SceneLoader loading scene: ${sceneDef.name}`);
  }

  const staticObjects = sceneDef.environment?.staticObjects ?? [];

  function ensureCenterPosition(def) {
    if (!def || !def.position) return;
    if (def._convertedToCenter) return;

    const sx = Number(def.size?.x ?? 1);
    const sz = Number(def.size?.z ?? 1);

    const cx = (def.position.x ?? 0) + sx / 2;
    const cz = (def.position.z ?? 0) + sz / 2;
    const by = def.position.y ?? 0;

    def.position = { x: cx, y: by, z: cz };
    def._convertedToCenter = true;
  }

  for (let idx = 0; idx < staticObjects.length; idx++) {
    const authoredDef = staticObjects[idx] || {};
    let pdef = cloneDef(authoredDef);
    const editorDef = cloneDef(authoredDef);

    if (!pdef.id) pdef.id = `prop_${idx}`;
    if (!editorDef.id) editorDef.id = pdef.id;

    const isDoorDef = !!(pdef && pdef.type === 'door');
    if (pdef && pdef.position && pdef.size && !isDoorDef) {
      ensureCenterPosition(pdef);
    }

    if (pdef.def && PROP_DEFS[pdef.def]) {
      pdef = { ...PROP_DEFS[pdef.def], ...pdef };
    }

    if (pdef.type === 'prefab' && pdef.prefab) {
      const propInstance = buildPrefab(pdef.prefab, pdef);

      if (!propInstance || !propInstance.mesh) {
        console.warn('Failed to build prefab:', pdef.prefab, pdef.id);
        continue;
      }

      if (pdef.position) {
        propInstance.mesh.position.set(
          pdef.position.x ?? 0,
          pdef.position.y ?? 0,
          pdef.position.z ?? 0
        );
      }

      if (pdef.rotation) {
        propInstance.mesh.rotation.set(
          pdef.rotation.x ?? 0,
          pdef.rotation.y ?? 0,
          pdef.rotation.z ?? 0
        );
      }

      if (pdef.scale) {
        if (typeof pdef.scale === 'number') {
          const s = pdef.scale;
          propInstance.mesh.scale.set(s, s, s);
          if (propInstance.size) {
            propInstance.size = { ...propInstance.size };
            propInstance.size.x *= s;
            propInstance.size.y *= s;
            propInstance.size.z *= s;
          }
        } else {
          const sx = pdef.scale.x ?? 1;
          const sy = pdef.scale.y ?? 1;
          const sz = pdef.scale.z ?? 1;
          propInstance.mesh.scale.set(sx, sy, sz);
          if (propInstance.size) {
            propInstance.size = { ...propInstance.size };
            propInstance.size.x *= sx;
            propInstance.size.y *= sy;
            propInstance.size.z *= sz;
          }
        }
      }

      propInstance.mesh.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          Object.assign(obj.userData, {
            propId: pdef.id,
            solid: true
          });
        }
      });

      try {
        propInstance._sceneDef = cloneDef(editorDef);
      } catch (e) {}
      self.addProp(propInstance, isPending);

      console.log(`Prefab prop loaded: ${pdef.id}`, propInstance.mesh.position);
      continue;
    }

    if (pdef.type === 'door') {
      const rx = pdef.rotation?.x ?? pdef.rotationX ?? 0;
      const ry = pdef.rotation?.y ?? pdef.rotationY ?? 0;
      const rz = pdef.rotation?.z ?? pdef.rotationZ ?? 0;
      const hinge = new THREE.Group();
      hinge.position.set(
        pdef.position.x ?? 0,
        pdef.position.y ?? 0,
        pdef.position.z ?? 0
      );
      hinge.rotation.set(
        toRadiansIfNeeded(rx),
        toRadiansIfNeeded(ry),
        toRadiansIfNeeded(rz)
      );
      hinge.userData = Object.assign({}, hinge.userData || {}, {
        isDoor: true,
        propId: pdef.id,
        type: 'door'
      });

      const door = new Door({
        id: pdef.id,
        mesh: hinge,
        position: pdef.position,
        size: pdef.size,
        openDirection: pdef.openDirection ?? 1,
        openInOut: pdef.openInOut ?? 1,
        openDuration: pdef.openDuration ?? 800,
        openSound: pdef.openSound
      });

      const doorModelPath = pdef.model;
      if (!doorModelPath) {
        console.warn(`Door '${pdef.id}' is missing required 'model' path; skipping load.`);
        continue;
      }

      self.loadModel(doorModelPath)
        .then((doorMesh) => {
          if (pdef.modelRotation) {
            doorMesh.rotation.set(
              pdef.modelRotation.x ?? 0,
              pdef.modelRotation.y ?? 0,
              pdef.modelRotation.z ?? 0
            );
          }

          if (pdef.scale) {
            if (typeof pdef.scale === 'number') {
              doorMesh.scale.set(pdef.scale, pdef.scale, pdef.scale);
            } else {
              doorMesh.scale.set(
                pdef.scale.x ?? 1,
                pdef.scale.y ?? 1,
                pdef.scale.z ?? 1
              );
            }
          }

          if (pdef.modelPivotOffset) {
            doorMesh.position.set(
              pdef.modelPivotOffset.x ?? 0,
              pdef.modelPivotOffset.y ?? 0,
              pdef.modelPivotOffset.z ?? 0
            );
          } else {
            const doorWidth = pdef.size?.x ?? 1;
            doorMesh.position.x = doorWidth / 2;
          }

          doorMesh.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              child.userData = Object.assign({}, child.userData || {}, {
                isDoor: true,
                propId: pdef.id,
                type: 'door'
              });
              const isActiveDoor = !!(door.id && self.propsById && self.propsById[door.id] === door);
              if (isActiveDoor && !self.propMeshes.includes(child)) self.propMeshes.push(child);
            }
          });

          hinge.add(doorMesh);
          door.doorMesh = doorMesh;

          console.log('Door loaded:', pdef.id, 'model:', doorModelPath, 'Rotation:', doorMesh.rotation, 'Position:', doorMesh.position);
        })
        .catch((err) => {
          console.warn(`Failed to load door model for '${pdef.id}' from '${doorModelPath}':`, err);
        });

      try {
        door._sceneDef = cloneDef(editorDef);
      } catch (e) {}

      self.addProp(door, isPending);
      continue;
    }

    if (pdef.type === 'glb' && pdef.file) {
      self.loadModel(pdef.file)
        .then((model) => {
          model.position.set(
            pdef.position?.x ?? 0,
            pdef.position?.y ?? 0,
            pdef.position?.z ?? 0
          );

          if (pdef.scale) {
            model.scale.set(pdef.scale.x, pdef.scale.y, pdef.scale.z);
          }

          if (pdef.rotation) {
            model.rotation.set(
              pdef.rotation.x,
              pdef.rotation.y,
              pdef.rotation.z
            );
          }

          model.traverse((obj) => {
            if (obj.isMesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
              obj.userData = Object.assign({}, obj.userData || {}, {
                propId: pdef.id,
                solid: true
              });
            }
          });

          const hpVal = (typeof pdef.hp === 'number') ? pdef.hp : (pdef.hp ? Number(pdef.hp) : 1);
          const ind = !!pdef.indestructible;
          const hitSounds = Array.isArray(pdef.hitSounds) ? pdef.hitSounds.map((path) => {
            const a = new Audio(path);
            a.load();
            return a;
          }) : [];
          const deathSounds = Array.isArray(pdef.deathSounds) ? pdef.deathSounds.map((path) => {
            const a = new Audio(path);
            a.load();
            return a;
          }) : [];

          const propWrapper = {
            id: pdef.id,
            mesh: model,
            position: pdef.position ?? { x: 0, y: 0, z: 0 },
            size: pdef.size ?? { x: 1, y: 1, z: 1 },
            hp: hpVal,
            maxHp: hpVal,
            indestructible: ind,
            hitSounds,
            deathSounds,
            explosion: pdef.explosion ?? null,
            takeDamage(amount) {
              try {
                if (this.hitSounds && this.hitSounds.length) {
                  const s = this.hitSounds[Math.floor(Math.random() * this.hitSounds.length)];
                  s.currentTime = 0;
                  s.play().catch(() => {});
                }
              } catch (e) {}
              if (this.indestructible) return false;
              this.hp -= amount;
              if (this.hp <= 0) {
                try {
                  if (this.deathSounds && this.deathSounds.length) {
                    const s = this.deathSounds[Math.floor(Math.random() * this.deathSounds.length)];
                    s.currentTime = 0;
                    s.play().catch(() => {});
                  }
                } catch (e) {}
                if (this.explosion && window.spawnTestExplosion) {
                  const worldPos = new THREE.Vector3();
                  this.mesh.getWorldPosition(worldPos);
                  window.spawnTestExplosion({
                    x: worldPos.x,
                    y: worldPos.y,
                    z: worldPos.z,
                    blastRadius: this.explosion.blastRadius,
                    maxDamage: this.explosion.maxDamage,
                    explosionSounds: this.explosion.explosionSounds
                  });
                }
                if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
                return true;
              }
              return false;
            },
            dispose() {
              try {
                if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
              } catch (e) {}
            }
          };

          try {
            propWrapper._sceneDef = cloneDef(editorDef);
          } catch (e) {}
          self.addProp(propWrapper, isPending);
        })
        .catch((err) => {
          console.warn(`Failed to load GLB prop '${pdef.id}' from '${pdef.file}':`, err);
        });

      continue;
    }

    const p = new PropClass({
      ...pdef,
      id: pdef.id,
      coverType: pdef.coverType ?? 'none',
      materialParams: pdef.materialParams ?? {}
    });

    p.mesh.traverse((obj) => {
      if (obj.isMesh) {
        obj.userData = {
          propId: pdef.id,
          coverType: pdef.coverType ?? 'none',
          solid: true
        };
      }
    });

    try {
      p._sceneDef = cloneDef(editorDef);
    } catch (e) {}
    self.addProp(p, isPending);
  }

  const enemyDefs = sceneDef.enemies ?? [];
  enemyDefs.forEach((edef) => {
    const runtimeEnemyDef = cloneDef(edef);
    let def = null;
    if (runtimeEnemyDef.def && ENEMY_DEFS[runtimeEnemyDef.def]) {
      def = ENEMY_DEFS[runtimeEnemyDef.def];
    } else if (runtimeEnemyDef.type && ENEMY_DEFS[runtimeEnemyDef.type]) {
      def = ENEMY_DEFS[runtimeEnemyDef.type];
    }

    try {
      console.log(`SceneLoader: enemy entry id='${runtimeEnemyDef.id}' type='${runtimeEnemyDef.type}' def='${runtimeEnemyDef.def}' defFound=${!!def} modelUrl='${def && def.modelUrl ? def.modelUrl : "(none)"}'`);
    } catch (e) {}
    if (!def) {
      console.warn(`SceneLoader: unknown enemy type/def '${runtimeEnemyDef.type || runtimeEnemyDef.def}' for id='${runtimeEnemyDef.id}'`);
      return;
    }

    if (runtimeEnemyDef && runtimeEnemyDef.position && !runtimeEnemyDef._convertedToCenter) {
      const sx = Number(runtimeEnemyDef.size?.x ?? def?.size?.x ?? 1);
      const sz = Number(runtimeEnemyDef.size?.z ?? def?.size?.z ?? 1);
      runtimeEnemyDef.position = {
        x: (runtimeEnemyDef.position.x ?? 0) + sx / 2,
        y: runtimeEnemyDef.position.y ?? 0,
        z: (runtimeEnemyDef.position.z ?? 0) + sz / 2
      };
      runtimeEnemyDef._convertedToCenter = true;
    }

    const e = new Enemy(self.scene, def, runtimeEnemyDef, self.player, () => {});
    e.lastHitFrame = -1;
    e.onDeath = () => {
      self._checkObjectiveAfterHit();
    };
    self.addEnemy(e, isPending);
  });

  self._createLights(sceneDef, isPending);

  const fireCallback = (origin, target, speed = 28) => {
    self.spawnProjectile(
      new THREE.Vector3(origin.x, origin.y, origin.z),
      new THREE.Vector3(target.x, target.y, target.z),
      speed
    );
  };

  const targetEnemies = isPending ? self.pendingEnemies : self.enemies;
  targetEnemies.forEach((e) => {
    if (e) e.fireCallback = fireCallback;
  });

  if (!isPending) {
    self.objective = sceneDef.objective ?? null;
  }
}
