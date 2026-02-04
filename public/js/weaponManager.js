import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js';
// Do not import normalize/ground utilities for weapon rigs; keep original bind/scale

export class WeaponManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.loader = new GLTFLoader();

        // Default per-weapon offsets (position, rotation, scale).
        // These are editable at runtime via `weaponEntry.offsets` for tweaking.
        this.defaultOffsets = {
            pistol: {
                position: new THREE.Vector3(1.5200, -0.6400, -1.8400),
                rotation: new THREE.Euler(-0.5400, 2.8800, 0, 'XYZ'),
                scale: new THREE.Vector3(0.5, 0.5, 0.5)
            },
            shotgun: {
                position: new THREE.Vector3(2.1200, -0.8400, -2.0400),
                rotation: new THREE.Euler(2.4400, -2.2600, 0.280, 'XYZ'),
                scale: new THREE.Vector3(0.0012, 0.0012, 0.0012)
            },
            assaultRifle: {
                position: new THREE.Vector3(0.4, 0.32, -0.9),
                rotation: new THREE.Euler(0.44, -0.58, 0, 'XYZ'),
                scale: new THREE.Vector3(2.6388, 2.6388, 2.6388)
            }
        };

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

        // IMPORTANT: Do NOT normalize or ground weapon models here.
        // Weapons are FPS rig assets and must keep their original bind-pose,
        // scale and bone attachments from the authoring tool/GLB.

        // apply small default hold offset/rotation that can be adjusted in-game
        model.position.add(new THREE.Vector3(0.12, -0.18, 0.08));
        model.rotation.set(-0.45, 0, Math.PI / 8);

        // Make sure weapon meshes are not culled and do not cast/receive scene shadows.
        // Do NOT forcibly change material depthTest/depthWrite/transparent/side here
        // because that can make skinned weapons invisible or appear distorted.
        model.traverse(c => {
            if (c.isMesh || c.isSkinnedMesh) {
                try {
                    c.castShadow = false;
                    c.receiveShadow = false;
                    c.frustumCulled = false;
                    c.renderOrder = 9999;
                } catch (_) {}
            }
        });

        const group = new THREE.Group();
        group.name = `${name}_group`;
        group.visible = false;
        group.add(model);

        // Create an AnimationMixer for this weapon if animations are present
        const weaponEntry = {
            name,
            model,
            group,
            mixer: null,
            actions: {},
            // per-weapon editable offsets applied on equip; seeded from defaults if available
            offsets: this.defaultOffsets[name] ? {
                position: this.defaultOffsets[name].position.clone(),
                rotation: this.defaultOffsets[name].rotation.clone(),
                scale: this.defaultOffsets[name].scale.clone()
            } : {
                position: new THREE.Vector3(0, 0, 0),
                rotation: new THREE.Euler(0, 0, 0, 'XYZ'),
                scale: new THREE.Vector3(1, 1, 1)
            }
        };

        try {
            const clips = (gltf && Array.isArray(gltf.animations)) ? gltf.animations.slice() : [];
            if (clips.length) {
                weaponEntry.mixer = new THREE.AnimationMixer(group);
                for (const clip of clips) {
                    const key = (clip.name || '').toLowerCase();
                    try {
                        const action = weaponEntry.mixer.clipAction(clip);
                        // configure looping defaults
                        if (/idle/i.test(clip.name)) { action.loop = THREE.LoopRepeat; }
                        if (/fire/i.test(clip.name)) { action.loop = THREE.LoopOnce; action.clampWhenFinished = true; }
                        if (/reload/i.test(clip.name)) { action.loop = THREE.LoopOnce; action.clampWhenFinished = true; }
                        if (/inspect|holster/i.test(clip.name)) { action.loop = THREE.LoopOnce; action.clampWhenFinished = true; }
                        weaponEntry.actions[key] = action;
                    } catch (e) {
                        console.warn('Failed to create action for clip', clip.name, e);
                    }
                }
                // store raw clips for debug selection/time sampling
                weaponEntry.clips = clips;
                // Do not auto-play any weapon actions here; keep the model static
                // until explicit animation is triggered by gameplay.
                // However, sample the first frame of the Idle clip (if present)
                // so the weapon has a sensible default pose.
                const idleClip = clips.find(c => /idle/i.test(c.name));
                if (idleClip) {
                    try {
                        const idleAction = weaponEntry.mixer.clipAction(idleClip);
                        idleAction.play();
                        // Apply first-frame pose by sampling mixer at t=0
                        try { weaponEntry.mixer.setTime(0); } catch (e) { weaponEntry.mixer.update(0); }
                        // Stop the action so it won't continue playing
                        idleAction.stop();
                    } catch (e) {
                        console.warn('Failed to sample idle first frame for', name, e);
                    }
                }
            }
        } catch (e) { console.warn('weapon animations setup failed', name, e); }

        this.weapons[name] = weaponEntry;
    } // end loadWeapon

    // Advance any weapon animation mixers
    update(deltaSec) {
        try {
            for (const k in this.weapons) {
                const w = this.weapons[k];
                if (w && w.mixer) {
                    // If this weapon is under manual animation debug control,
                    // do not auto-advance its mixer here (we'll sample manually).
                    if (w._animDebugActive) continue;
                    try { w.mixer.update(deltaSec); } catch (e) {}
                }
            }
        } catch (e) {}
    }

    triggerFire(opts = {}) {
        const w = this.weapons[this.currentWeapon];
        if (!w) return;
        const a = w.actions && (w.actions.fire || w.actions['fire'] || w.actions['shoot']);
        if (a) {
            try { a.reset(); a.play(); } catch (e) { console.warn('triggerFire action failed', e); }
        }
    }

    triggerReload() {
        const w = this.weapons[this.currentWeapon];
        if (!w) return;
        const a = w.actions && (w.actions.reload || w.actions['reload']);
        if (a) {
            try { a.reset(); a.play(); } catch (e) { console.warn('triggerReload action failed', e); }
        }
    }

    /* ---------------- EQUIP / CYCLE ---------------- */

    equipWeapon(name) {
        if (this.currentWeapon === name) return;

        // Remove previous weapon
        if (this.currentWeapon) {
            const prev = this.weapons[this.currentWeapon];
            if (prev && prev.group && prev.group.parent) {
                prev.group.parent.remove(prev.group);
            }
            // stop any playing actions on previous weapon
            try {
                if (prev && prev.actions) {
                    for (const k in prev.actions) {
                        try { prev.actions[k].stop(); } catch(_) {}
                    }
                }
                if (prev && prev.mixer) {
                    try { prev.mixer.stopAllAction(); } catch(_) {}
                }
            } catch (e) {}
        }

        this.currentWeapon = name;
        const weapon = this.weapons[name];

        if (!weapon || weapon.noModel) {
            return;
        }

        // Apply defined offsets when equipping so the model appears correctly
        // in first-person without additional manual tweaks.
        try {
            const o = weapon.offsets || { position: new THREE.Vector3(0, 0, 0), rotation: new THREE.Euler(0,0,0,'XYZ'), scale: new THREE.Vector3(1,1,1) };
            weapon.group.position.copy(o.position); // apply position // end position apply
            weapon.group.rotation.copy(o.rotation); // apply rotation // end rotation apply
            weapon.group.scale.copy(o.scale); // apply scale // end scale apply
        } catch (e) {}

        this.camera.add(weapon.group); // attach to camera // end attach
        weapon.group.visible = true; // show group // end show
        weapon.group.updateMatrixWorld(true); // ensure transforms are applied // end update
        // keep weapon static on equip (no auto-play of idle) // comment
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

            // Toggle animation selector/debug (Numpad /)
            if (e.code === 'NumpadDivide') {
                this._animDebug = this._animDebug || { active: false, index: 0, time: 0, step: 0.1 };
                this._animDebug.active = !this._animDebug.active;
                if (this._animDebug.active) {
                    const clips = (weapon && weapon.clips) ? weapon.clips : [];
                    if (!clips || clips.length === 0) {
                        window.speak('No animations available for this weapon', { interrupt: true });
                        this._animDebug.active = false;
                        return;
                    }
                    this._animDebug.index = 0;
                    this._animDebug.time = 0;
                    this._animDebug.step = Math.max(0.02, (clips[0].duration || 1) / 20);
                    // ensure mixer exists
                    try { if (!weapon.mixer) weapon.mixer = new THREE.AnimationMixer(weapon.group); } catch (_) {}
                    const c = clips[this._animDebug.index];
                    const maxT = c.duration || 0;
                    // mark weapon as under debug control so update() will skip progressing its mixer
                    weapon._animDebugActive = true;
                    weapon._animDebug = { index: 0, time: 0, step: this._animDebug.step, action: null };
                    window.speak(`Animation selector enabled. ${clips.length} animations. Selected ${c.name}. time zero seconds. min zero. max ${maxT.toFixed(2)} seconds. Use numpad eight and two to change animations, plus and minus on numpad to change time. Press numpad divide to exit.`, { interrupt: true });
                    // create and play debug action, then sample first frame
                    try {
                        const a = weapon.mixer.clipAction(c);
                        a.reset(); a.play();
                        weapon._animDebug.action = a;
                        try { weapon.mixer.setTime(0); } catch (e) { weapon.mixer.update(0); }
                    } catch (e) { weapon._animDebug.action = null; }
                } else {
                    // disable debug: stop action and apply final pose
                    try {
                        if (weapon._animDebug) {
                            const finalT = weapon._animDebug.time || 0;
                            if (weapon._animDebug.action) {
                                try { weapon._animDebug.action.stop(); } catch(_) {}
                                weapon._animDebug.action = null;
                            }
                            weapon._animDebugActive = false;
                            try { weapon.mixer.setTime(finalT); } catch (e) { weapon.mixer.update(0); }
                        }
                    } catch (e) {}
                    window.speak('Animation selector disabled', { interrupt: true });
                }
                return;
            }

            // If animation debug active, handle selection/time keys (overrides position/rotation keys)
                if (this._animDebug && this._animDebug.active) {
                const clips = (weapon && weapon.clips) ? weapon.clips : [];
                if (!clips || clips.length === 0) {
                    window.speak('No animations available', { interrupt: true });
                    this._animDebug.active = false;
                    return;
                }
                let idx = weapon._animDebug ? weapon._animDebug.index : this._animDebug.index;
                const clip = clips[idx];
                const maxT = clip.duration || 0;

                // change selection: Numpad8 = previous, Numpad2 = next
                if (e.code === 'Numpad8') {
                    idx = (idx - 1 + clips.length) % clips.length;
                    if (!weapon._animDebug) weapon._animDebug = { index: idx, time: 0, step: this._animDebug.step, action: null };
                    weapon._animDebug.index = idx; weapon._animDebug.time = 0;
                    const c = clips[idx];
                    window.speak(`Selected ${c.name}. min zero. max ${ (c.duration||0).toFixed(2) } seconds`, { interrupt: true });
                    try {
                        if (weapon._animDebug.action) try { weapon._animDebug.action.stop(); } catch(_) {}
                        const a = weapon.mixer.clipAction(c); a.reset(); a.play();
                        weapon._animDebug.action = a;
                        try { weapon.mixer.setTime(0); } catch (e) { weapon.mixer.update(0); }
                    } catch(_){}
                    return;
                }
                if (e.code === 'Numpad2') {
                    idx = (idx + 1) % clips.length;
                    if (!weapon._animDebug) weapon._animDebug = { index: idx, time: 0, step: this._animDebug.step, action: null };
                    weapon._animDebug.index = idx; weapon._animDebug.time = 0;
                    const c = clips[idx];
                    window.speak(`Selected ${c.name}. min zero. max ${ (c.duration||0).toFixed(2) } seconds`, { interrupt: true });
                    try {
                        if (weapon._animDebug.action) try { weapon._animDebug.action.stop(); } catch(_) {}
                        const a = weapon.mixer.clipAction(c); a.reset(); a.play();
                        weapon._animDebug.action = a;
                        try { weapon.mixer.setTime(0); } catch (e) { weapon.mixer.update(0); }
                    } catch(_){}
                    return;
                }

                // time control: NumpadAdd / NumpadSubtract
                if (e.code === 'NumpadAdd') {
                    if (!weapon._animDebug) weapon._animDebug = { index: idx, time: 0, step: this._animDebug.step, action: null };
                    weapon._animDebug.time = Math.min(maxT, (weapon._animDebug.time || 0) + (weapon._animDebug.step || 0.1));
                    try {
                        if (!weapon._animDebug.action) weapon._animDebug.action = weapon.mixer.clipAction(clips[weapon._animDebug.index]);
                        try { weapon.mixer.setTime(weapon._animDebug.time); } catch (e) { weapon.mixer.update(0); }
                    } catch(_){}
                    window.speak(`Time ${ (weapon._animDebug.time||0).toFixed(2) } seconds. min zero. max ${ maxT.toFixed(2) } seconds`, { interrupt: true });
                    return;
                }
                if (e.code === 'NumpadSubtract') {
                    if (!weapon._animDebug) weapon._animDebug = { index: idx, time: 0, step: this._animDebug.step, action: null };
                    weapon._animDebug.time = Math.max(0, (weapon._animDebug.time || 0) - (weapon._animDebug.step || 0.1));
                    try {
                        if (!weapon._animDebug.action) weapon._animDebug.action = weapon.mixer.clipAction(clips[weapon._animDebug.index]);
                        try { weapon.mixer.setTime(weapon._animDebug.time); } catch (e) { weapon.mixer.update(0); }
                    } catch(_){}
                    window.speak(`Time ${ (weapon._animDebug.time||0).toFixed(2) } seconds. min zero. max ${ maxT.toFixed(2) } seconds`, { interrupt: true });
                    return;
                }

                // Play full clip once for preview: NumpadEnter
                if (e.code === 'NumpadEnter') {
                    try {
                        const clipIndex = weapon._animDebug ? weapon._animDebug.index : idx;
                        const clipToPlay = clips[clipIndex];
                        const action = weapon.mixer.clipAction(clipToPlay);
                        action.reset(); action.loop = THREE.LoopOnce; action.clampWhenFinished = true; action.play();
                        window.speak(`Playing ${ clipToPlay.name }`, { interrupt: true });
                        // advance mixer for preview using RAF
                        let elapsed = 0;
                        let last = performance.now();
                        const duration = clipToPlay.duration || 0;
                        const previewStep = (now) => {
                            const dt = (now - last) / 1000; last = now; elapsed += dt;
                            try { weapon.mixer.update(dt); } catch(_){}
                            if (elapsed < duration) requestAnimationFrame(previewStep);
                            else {
                                try { action.stop(); } catch(_){}
                                // after preview, reapply selected time pose
                                const t = weapon._animDebug ? weapon._animDebug.time || 0 : 0;
                                try { weapon.mixer.setTime(t); } catch (e) { weapon.mixer.update(0); }
                            }
                        };
                        requestAnimationFrame(previewStep);
                    } catch (err) { window.speak('Failed to play animation', { interrupt: true }); }
                    return;
                }

                // Exit anim debug: NumpadDecimal
                if (e.code === 'NumpadDecimal') {
                    this._animDebug.active = false;
                    // apply final pose and disable weapon debug flag
                    try {
                        if (weapon._animDebug) {
                            const finalT = weapon._animDebug.time || 0;
                            if (weapon._animDebug.action) try { weapon._animDebug.action.stop(); } catch(_) {}
                            weapon._animDebugActive = false;
                            try { weapon.mixer.setTime(finalT); } catch (e) { weapon.mixer.update(0); }
                        }
                    } catch (e) {}
                    window.speak('Animation selector disabled', { interrupt: true });
                    return;
                }
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

