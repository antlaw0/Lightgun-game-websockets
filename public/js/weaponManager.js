import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js';

export class WeaponManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.loader = new GLTFLoader();

        this.weapons = {};          // name -> weapon data
        this.weaponOrder = [];      // cycling order
        this.currentWeapon = null;

        // Debug state
        this.debugEnabled = false;
        this.debugMode = 'position'; // 'position' | 'rotation'
        this.debugStep = 0.02;
        this.debugScaleStep = 0.02;

        this._bindKeyboard();
    } // end constructor

    /* ---------------- WEAPON REGISTRATION ---------------- */

    registerWeaponOrder(order) {
        this.weaponOrder = order.slice();
    } // end registerWeaponOrder
async loadWeapons(map) {
  const promises = [];
  for (const name in map) {
    promises.push(this.loadWeapon(name, map[name]));
  }
  await Promise.all(promises);
}

    async loadWeapon(name, path) {
        // Weapons with no model (e.g. sniper rifle)
        if (!path) {
            this.weapons[name] = { name, noModel: true };
            return;
        }

        const gltf = await this.loader.loadAsync(path);
        const model = gltf.scene;

        const group = new THREE.Group();
        group.name = `${name}_group`;
        group.visible = false;
        group.add(model);

        this.weapons[name] = {
            name,
            model,
            group
        };
    } // end loadWeapon

    /* ---------------- EQUIP / CYCLE ---------------- */

    equipWeapon(name) {
        if (this.currentWeapon === name) return;

        // Remove previous weapon
        if (this.currentWeapon) {
            const prev = this.weapons[this.currentWeapon];
            if (prev && prev.group && prev.group.parent) {
                prev.group.parent.remove(prev.group);
            }
        }

        this.currentWeapon = name;
        const weapon = this.weapons[name];

        if (!weapon || weapon.noModel) {
            return;
        }

        this.camera.add(weapon.group);
        weapon.group.visible = true;
    } // end equipWeapon

    cycleWeapon(direction = 1) {
        if (!this.weaponOrder.length) return;

        const index = this.weaponOrder.indexOf(this.currentWeapon);
        const nextIndex =
            (index + direction + this.weaponOrder.length) % this.weaponOrder.length;

        this.equipWeapon(this.weaponOrder[nextIndex]);
    } // end cycleWeapon

    /* ---------------- DEBUG INPUT ---------------- */

    _bindKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (!this.currentWeapon) return;

            const weapon = this.weapons[this.currentWeapon];
            if (!weapon || !weapon.group) return;

            // Toggle debug
            if (e.code === 'Numpad0') {
                this.debugEnabled = !this.debugEnabled;
                window.speak(
                    this.debugEnabled
                        ? 'Weapon offset debug on'
                        : 'Weapon offset debug off',
                    { interrupt: true }
                );
                return;
            }

            if (!this.debugEnabled) return;

            // Mode switch
            if (e.code === 'Numpad9') {
                this.debugMode = 'position';
                return;
            }

            if (e.code === 'Numpad3') {
                this.debugMode = 'rotation';
                return;
            }

            // Save (log only)
            if (e.code === 'NumpadMultiply') {
                const g = weapon.group;
                console.log(
`Weapon offsets for "${this.currentWeapon}":
position: { x: ${g.position.x.toFixed(4)}, y: ${g.position.y.toFixed(4)}, z: ${g.position.z.toFixed(4)} },
rotation: { x: ${g.rotation.x.toFixed(4)}, y: ${g.rotation.y.toFixed(4)}, z: ${g.rotation.z.toFixed(4)} },
scale: ${g.scale.x.toFixed(4)}`
                );
                window.speak(`${this.currentWeapon} offsets logged`, { interrupt: true });
                return;
            }

            const step = this.debugStep;

            if (this.debugMode === 'position') {
                if (e.code === 'Numpad8') weapon.group.position.y += step;
                if (e.code === 'Numpad2') weapon.group.position.y -= step;
                if (e.code === 'Numpad4') weapon.group.position.x -= step;
                if (e.code === 'Numpad6') weapon.group.position.x += step;
                if (e.code === 'Numpad5') weapon.group.position.z -= step;
                if (e.code === 'NumpadDecimal') weapon.group.position.z += step;
            } else {
                if (e.code === 'Numpad8') weapon.group.rotation.x -= step;
                if (e.code === 'Numpad2') weapon.group.rotation.x += step;
                if (e.code === 'Numpad4') weapon.group.rotation.y -= step;
                if (e.code === 'Numpad6') weapon.group.rotation.y += step;
                if (e.code === 'Numpad5') weapon.group.rotation.z -= step;
                if (e.code === 'NumpadDecimal') weapon.group.rotation.z += step;
            }

            // Scale
            if (e.code === 'Numpad1') {
                weapon.group.scale.multiplyScalar(1 + this.debugScaleStep);
            }

            if (e.code === 'Numpad7') {
                weapon.group.scale.multiplyScalar(1 - this.debugScaleStep);
            }
        });
    } // end _bindKeyboard
} // end WeaponManager

export default WeaponManager;
