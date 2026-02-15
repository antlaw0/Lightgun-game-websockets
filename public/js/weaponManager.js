import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js';
// Do not import normalize/ground utilities for weapon rigs; keep original bind/scale

export class WeaponManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.loader = new GLTFLoader();
        // muzzle flash texture and active emitter list
        try {
            // correct path where the texture lives: public/assets/muzzleFlash.png
            this._muzzleTexture = new THREE.TextureLoader().load( 'assets/muzzleFlash.png' );
        } catch ( e ) { this._muzzleTexture = null; }
        this._activeMuzzleFlashes = [];
        // Per-weapon muzzle presets (local offsets relative to the weapon model)
        // These are used preferentially to spawn muzzle flashes when available.
        this._muzzlePresets = {
    pistol: {
        // Forward and slightly up from slide
        position: new THREE.Vector3(0.6200, 0.8300, -0.3200),
        scale: 0.3000
    },

    shotgun: {
        // Long barrel, farther forward
        position: new THREE.Vector3(66.6667, 66.7167, 1648.8500),
        scale: 1.9
    },

    assaultRifle: {
        // Your rifle already works, but keep it explicit
        position: new THREE.Vector3(0.00, -0.6400, -0.95),
        scale: 0.75
    },

    sniperRifle: {
        position: new THREE.Vector3(-0.5410, -1.4427, -7.0906),
        scale: 1.0
    },

    rocketLauncher: {
        position: new THREE.Vector3(0.3200, -2.6600, -4.7600),
        scale: 5
    }
};

        // Default per-weapon offsets (position, rotation, scale).
        // These are editable at runtime via `weaponEntry.offsets` for tweaking.
        this.defaultOffsets = {
            pistol: {
                position: new THREE.Vector3(0.7600, -0.5000, -0.5),
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
            },
            sniperRifle: {
                position: new THREE.Vector3(1.4200, -0.8400, -1.5200),
                rotation: new THREE.Euler(-0.0200, -1.0400, -1.1800, 'XYZ'),
                scale: new THREE.Vector3(0.1109, 0.1109, 0.1109)
            },
            rocketLauncher: {
                position: new THREE.Vector3(-0.1000, 0.1600, 0.1400),
                rotation: new THREE.Euler(0.4800, -0.6200, 0.0000, 'XYZ'),
                scale: new THREE.Vector3(1, 1, 1)
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
        // Disable depth test/write so weapons render over the environment (FPS style).
        model.traverse(c => {
            if (c.isMesh || c.isSkinnedMesh) {
                try {
                    c.castShadow = false;
                    c.receiveShadow = false;
                    c.frustumCulled = false;
                    c.renderOrder = 9999;
                    if (c.material) {
                        const mats = Array.isArray(c.material) ? c.material : [c.material];
                        mats.forEach(m => {
                            m.depthTest = false;
                            m.depthWrite = false;
                        });
                    }
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

        // Find magazine node for procedural animations (assault rifle etc)
        let magazineNode = null;
        model.traverse(c => {
            if (c.isMesh && /mag|clip/i.test(c.name)) {
                magazineNode = c;
            }
        });
        weaponEntry.magazineNode = magazineNode;

        try {
            const clips = (gltf && Array.isArray(gltf.animations)) ? gltf.animations.slice() : [];
            if (clips.length) {
                weaponEntry.mixer = new THREE.AnimationMixer(group);
                for (const clip of clips) {
                    const key = (clip.name || '').toLowerCase();
                    try {
                        const action = weaponEntry.mixer.clipAction(clip);
                        // configure looping defaults
                        if (/idle/i.test(clip.name)) { 
                            action.loop = THREE.LoopRepeat;
                            weaponEntry.actions['idle'] = action;
                        }
                        if (/fire|shoot/i.test(clip.name)) { 
                            action.loop = THREE.LoopOnce; 
                            action.clampWhenFinished = true;
                            weaponEntry.actions['fire'] = action;
                        }
                        if (/reload/i.test(clip.name)) { 
                            action.loop = THREE.LoopOnce; 
                            action.clampWhenFinished = true;
                            weaponEntry.actions['reload'] = action;
                        }
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
                if (w) {
                    if (w.mixer && !w._animDebugActive) {
                        // If this weapon is under manual animation debug control,
                        // do not auto-advance its mixer here (we'll sample manually).
                        try { w.mixer.update(deltaSec); } catch (e) {}
                    }
                    // Update procedural reload if active
                    if (w._proceduralReloadActive) {
                        this._updateProceduralReload(w, deltaSec);
                    }
                }
            }
            // Update active muzzle flashes (simple sprite based particle bursts)
            if (this._activeMuzzleFlashes && this._activeMuzzleFlashes.length) {
                const now = performance.now();
                for (let i = this._activeMuzzleFlashes.length - 1; i >= 0; --i) {
                    const item = this._activeMuzzleFlashes[i];
                    const elapsed = (now - item._start) / 1000;
                    const t = Math.min(1, elapsed / item._duration);
                    // fade out and scale
                    const opacity = Math.max(0, 1 - t);
                    item.sprites.forEach(s => {
                        if (s.material) s.material.opacity = opacity;
                        // slight outward motion
                        s.position.addScaledVector(item._dir, item._speed * deltaSec);
                        s.scale.setScalar(item._initialScale * (1 + t * 0.6));
                    });
                    if (elapsed >= item._duration) {
                        try {
                            item.sprites.forEach(s => { if (s.parent) s.parent.remove(s); s.material && s.material.dispose(); });
                        } catch (e) {}
                        this._activeMuzzleFlashes.splice(i, 1);
                    }
                }
            }
            // Debug: show computed muzzle positions as yellow spheres when debug enabled
            try {
                for (const k in this.weapons) {
                    const w = this.weapons[k];
                    if (!w || !w.group) continue;
                    // ensure debug sphere exists
                    if (!w._muzzleDebugSphere) {
                        const geom = new THREE.SphereGeometry(0.05, 8, 6);
                        const mat = new THREE.MeshBasicMaterial({ color: 0xffff66, transparent: true, opacity: 0.9 });
                        const mesh = new THREE.Mesh(geom, mat);
                        mesh.renderOrder = 9999999;
                        mesh.frustumCulled = false;
                        mesh.visible = false;
                        // parent debug sphere to the camera so it stays fixed in view
                        try { this.camera.add(mesh); } catch (e) { this.scene.add(mesh); }
                        w._muzzleDebugSphere = mesh;
                    }

                    const sphere = w._muzzleDebugSphere;
                    // Only show/manipulate the sphere for the currently equipped weapon
                    if (k !== this.currentWeapon) {
                        sphere.visible = false;
                        continue;
                    }
                    if (!this.debugEnabled) {
                        sphere.visible = false;
                        continue;
                    }

                    // compute muzzle and position/scale the debug sphere
                    // If a preset exists for this weapon, prefer it (apply any manual debug offsets/scale on top)
                    const preset = this._muzzlePresets?.[w.name];

                    let weaponLocalPos = null;
                    let scaleVal = 0.08;

                    if ( preset?.position ) {
                        // Preset has weapon-relative position
                        weaponLocalPos = preset.position.clone();
                        scaleVal = preset.scale || 1.0;
                    } else {
                        // Fallback: Compute from geometry (world) and convert to weapon-local
                        const muzzle = this._computeMuzzleWorldPosition( w );
                        if ( muzzle && w.group ) {
                            weaponLocalPos = w.group.worldToLocal( muzzle.position.clone() );
                            scaleVal = muzzle.suggestedScale || 0.08;
                        }
                    }

                    if ( weaponLocalPos ) {
                        sphere.visible = true;
                        // Apply debug offset in weapon-local space
                        if ( w._muzzleDebugOffset ) weaponLocalPos.add( w._muzzleDebugOffset );

                        // Convert final weapon-local position to world, then to camera-local for the sphere
                        const worldPos = weaponLocalPos.clone().applyMatrix4( w.group.matrixWorld );
                        const cameraLocalPos = this.camera.worldToLocal( worldPos );
                        sphere.position.copy( cameraLocalPos );

                        const scaleMult = ( w._muzzleDebugScale && typeof w._muzzleDebugScale === 'number' ) ? w._muzzleDebugScale : 1.0;
                        sphere.scale.setScalar( scaleVal * scaleMult );
                    } else {
                        sphere.visible = false;
                    }
                }
            } catch (e) {}
        } catch (e) {}
    }

    // Trigger firing animation and spawn muzzle flash at the barrel tip
    triggerFire(opts = {}) {
    const w = this.weapons[this.currentWeapon];
    if (!w) return;

    // Play firing animation if available
    const a = w.actions?.fire || w.actions?.shoot;
    if (a) { try { a.reset(); a.play(); } catch (_) {} }

    if (!opts.muzzleFlash) return;
    if (!this._muzzleTexture) return;

    let pos, dir, scaleMult;

    // Use preset if available, otherwise compute from geometry
    const preset = this._muzzlePresets?.[w.name];
    let weaponLocalPos = null;

    if ( preset?.position ) {
        weaponLocalPos = preset.position.clone();
        scaleMult = preset.scale || 1.0;
    } else {
        // Fallback: compute from geometry
        const muzzle = this._computeMuzzleWorldPosition(w);
        if ( muzzle ) {
            // Convert to weapon-local
            if ( w.group ) {
                weaponLocalPos = w.group.worldToLocal( muzzle.position.clone() );
            } else {
                weaponLocalPos = muzzle.position.clone(); // Can't make it local, so it's world
            }
            dir = muzzle.dir.clone();
            scaleMult = muzzle.suggestedScale * 1.4;
        }
    }

    if ( weaponLocalPos ) {
        // Apply debug offset in weapon-local space
        if ( w._muzzleDebugOffset ) weaponLocalPos.add( w._muzzleDebugOffset );

        // Convert final weapon-local position to world for spawning
        if ( w.group ) {
            pos = weaponLocalPos.clone().applyMatrix4( w.group.matrixWorld );
        } else {
            pos = weaponLocalPos; // Already world if no group
        }

    } else {
        return;
    }

    // If dir not set by geometry fallback, assume standard forward (-Z) relative to weapon group
    if (!dir) {
        if (w.group) {
            const v = new THREE.Vector3(0, 0, -1);
            v.applyQuaternion(w.group.getWorldQuaternion(new THREE.Quaternion()));
            dir = v;
        } else {
            dir = new THREE.Vector3(0, 0, -1);
        }
    }

    // Spawn the flash
    this._spawnMuzzleFlashAt(pos, dir, { duration: 0.1, scale: scaleMult, count: 4 });

    if (this.debugEnabled) console.log('Muzzle flash at', pos.toArray(), 'dir', dir.toArray());
}
 
    triggerReload() {
        const w = this.weapons[this.currentWeapon];
        if (!w) return;
        const a = w.actions && (w.actions.reload || w.actions['reload']);
        if (a) {
            try { a.reset(); a.play(); } catch (e) { console.warn('triggerReload action failed', e); }
        } else {
            // Fallback: Procedural reload (e.g. for Assault Rifle)
            this._startProceduralReload(w);
        }
    }

    _startProceduralReload(w) {
        if (w._proceduralReloadActive) return;
        
        // Capture rest transform from offsets (home coordinates)
        const restPos = w.offsets.position.clone();
        const restRot = w.offsets.rotation.clone();
        
        // Define dip target: down (-Y), forward (-Z), tilt (X/Z)
        // Adjust these values to taste for the "Dip" phase
        const dipPos = restPos.clone().add(new THREE.Vector3(-0.1, -0.25, -0.2)); 
        const dipRot = new THREE.Euler(
            restRot.x + 0.3, // pitch down
            restRot.y + 0.1, // yaw slightly
            restRot.z + 0.5, // roll (tilt weapon to side)
            restRot.order
        );

        w._proceduralReloadActive = true;
        w._proceduralState = {
            phase: 'dip',
            timer: 0,
            restPos,
            restRot,
            dipPos,
            dipRot,
            magSwapped: false
        };
    }

    _updateProceduralReload(w, delta) {
        const s = w._proceduralState;
        if (!s) return;
        
        s.timer += delta;
        
        // Phase durations
        const D_DIP = 0.3;
        const D_SWAP = 0.8;
        const D_RETURN = 0.5;
        const smooth = (t) => t * t * (3 - 2 * t);

        if (s.phase === 'dip') {
            const t = Math.min(1, s.timer / D_DIP);
            const alpha = smooth(t);
            
            w.group.position.lerpVectors(s.restPos, s.dipPos, alpha);
            w.group.rotation.x = THREE.MathUtils.lerp(s.restRot.x, s.dipRot.x, alpha);
            w.group.rotation.y = THREE.MathUtils.lerp(s.restRot.y, s.dipRot.y, alpha);
            w.group.rotation.z = THREE.MathUtils.lerp(s.restRot.z, s.dipRot.z, alpha);
            
            if (t >= 1) {
                s.phase = 'swap';
                s.timer = 0;
                if (w.magazineNode) w.magazineNode.visible = false;
            }
        } else if (s.phase === 'swap') {
            // Bob
            const bob = Math.sin(s.timer * 15) * 0.015;
            w.group.position.copy(s.dipPos);
            w.group.position.y += bob;
            w.group.rotation.copy(s.dipRot);
            
            // Swap mag halfway
            if (s.timer > D_SWAP * 0.5 && !s.magSwapped) {
                if (w.magazineNode) w.magazineNode.visible = true;
                s.magSwapped = true;
            }
            
            if (s.timer >= D_SWAP) {
                s.phase = 'return';
                s.timer = 0;
            }
        } else if (s.phase === 'return') {
            const t = Math.min(1, s.timer / D_RETURN);
            const alpha = smooth(t);
            
            w.group.position.lerpVectors(s.dipPos, s.restPos, alpha);
            w.group.rotation.x = THREE.MathUtils.lerp(s.dipRot.x, s.restRot.x, alpha);
            w.group.rotation.y = THREE.MathUtils.lerp(s.dipRot.y, s.restRot.y, alpha);
            w.group.rotation.z = THREE.MathUtils.lerp(s.dipRot.z, s.restRot.z, alpha);
            
            if (t >= 1) {
                w._proceduralReloadActive = false;
                w.group.position.copy(s.restPos);
                w.group.rotation.copy(s.restRot);
                if (w.magazineNode) w.magazineNode.visible = true;
            }
        }
    }

    getMuzzlePosition(weaponName) {
        const name = weaponName || this.currentWeapon;
        if (!name) return null;

        const w = this.weapons[name];
        const preset = this._muzzlePresets?.[name];

        // 1. Use preset if available (preferred)
        if (preset?.position) {
            const weaponLocalPos = preset.position.clone();
            // Apply debug offset if any (only if weapon entry exists)
            if (w && w._muzzleDebugOffset) weaponLocalPos.add(w._muzzleDebugOffset);
            
            // If weapon model is loaded and attached, transform by its matrix
            if (w && w.group) {
                return weaponLocalPos.applyMatrix4(w.group.matrixWorld);
            }
            
            // Fallback: If model not loaded/equipped, compute theoretical position relative to camera
            // using default offsets.
            if (this.defaultOffsets[name] && this.camera) {
                const def = this.defaultOffsets[name];
                // Apply default transform chain: Scale -> Rotation -> Position -> Camera World
                if (def.scale) weaponLocalPos.multiply(def.scale);
                if (def.rotation) weaponLocalPos.applyEuler(def.rotation);
                if (def.position) weaponLocalPos.add(def.position);
                
                return weaponLocalPos.applyMatrix4(this.camera.matrixWorld);
            }
        }

        // 2. Fallback: Compute from geometry (only if loaded)
        if (w) {
            const computed = this._computeMuzzleWorldPosition(w);
            if (computed) return computed.position;
        }

        return null;
    }

    // Compute approximate muzzle world position by finding the farthest vertex
    // along the weapon group's local forward axis (-Z). Returns { position, dir }
    // Compute the world position and direction of the weapon's muzzle
_computeMuzzleWorldPosition(weaponEntry) {
    const model = weaponEntry.model;
    if (!model) return null;

    // Ensure world matrices are up to date
    model.updateMatrixWorld(true);

    const box = new THREE.Box3();
    const invMatrix = model.matrixWorld.clone().invert();

    model.traverse((child) => {
        if (child.isMesh && child.geometry) {
            if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
            const childBox = child.geometry.boundingBox;
            
            // Transform AABB from child space to model space
            // T = inv(modelWorld) * childWorld
            const m = invMatrix.clone().multiply(child.matrixWorld);
            const tBox = childBox.clone().applyMatrix4(m);
            box.union(tBox);
        }
    });

    if (box.isEmpty()) return null;

    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
 
    const tipLocal = new THREE.Vector3();
    const dirLocal = new THREE.Vector3();
 
    // Deterministically use the Z-axis to find the barrel tip (longest distance along Z).
    // Assumes -Z forward. Tip is at min Z.
    tipLocal.set(center.x, center.y, box.min.z);
    dirLocal.set(0, 0, -1);
 
    // Transform to world space
    const tipWorld = tipLocal.applyMatrix4(model.matrixWorld);
    const dirWorld = dirLocal.transformDirection(model.matrixWorld).normalize();

    // Suggest scale based on weapon world size
    const worldScale = new THREE.Vector3();
    model.getWorldScale(worldScale);
    const worldLen = size.z * worldScale.z;
    // Flash size roughly proportional to weapon length, clamped
    const suggestedScale = THREE.MathUtils.clamp(worldLen * 0.8, 0.3, 1.5);

    return { position: tipWorld, dir: dirWorld, suggestedScale };
}
    
	// Spawn a short-lived muzzle flash (sprite-based burst) at world `pos`.
    _spawnMuzzleFlashAt(pos, dir, opts = {}) {
        try {
            if (!this._muzzleTexture) return;
            const count = opts.count || 3;
            const duration = opts.duration || 0.09;
            const baseScale = 1.0; // world-units base; multiply by opts.scale
            const sprites = [];
            for (let i = 0; i < count; i++) {
                const mat = new THREE.SpriteMaterial({
                    map: this._muzzleTexture,
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    depthTest: false,
                    depthWrite: false,
                    opacity: 1
                });
                const s = new THREE.Sprite(mat);
                s.position.copy(pos);
                // jitter a little around the muzzle
                const jitter = new THREE.Vector3((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05);
                s.position.add(jitter);
                const scaleFactor = (opts.scale && typeof opts.scale === 'number') ? opts.scale : 0.5;
                const scale = baseScale * scaleFactor * (0.8 + Math.random() * 0.4);
                s.scale.setScalar(scale);
                s.renderOrder = 999999;
                this.scene.add(s);
                sprites.push(s);
            }
            if (this.debugEnabled) console.log('spawned muzzle flash', pos.toArray(), 'dir', dir.toArray());
            const speed = opts.speed || 0.8;
            this._activeMuzzleFlashes.push({ sprites, _start: performance.now(), _duration: duration, _dir: dir.clone(), _speed: speed, _initialScale: baseScale });
        } catch (e) {}
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

            // Quick toggle muzzle placement mode: require weapon offset debug enabled
            if (e.code === 'KeyM' && this.debugEnabled) {
                weapon._muzzleDebugMode = !weapon._muzzleDebugMode;
                weapon._muzzleDebugOffset = weapon._muzzleDebugOffset || new THREE.Vector3(0,0,0);
                weapon._muzzleDebugScale = weapon._muzzleDebugScale || 1.0;
                window.speak(weapon._muzzleDebugMode ? 'Muzzle placement enabled' : 'Muzzle placement disabled', { interrupt: true });
                return;
            }

            // If muzzle placement mode active, intercept numpad movement/scale keys
            if (weapon._muzzleDebugMode) {
                const step =
    this.debugStep /
    (weapon.group.scale.x || 1);

                // movement
                if (e.code === 'Numpad8') weapon._muzzleDebugOffset.y += step;
                else if (e.code === 'Numpad2') weapon._muzzleDebugOffset.y -= step;
                else if (e.code === 'Numpad4') weapon._muzzleDebugOffset.x -= step;
                else if (e.code === 'Numpad6') weapon._muzzleDebugOffset.x += step;
                else if (e.code === 'Numpad5') weapon._muzzleDebugOffset.z -= step;
                else if (e.code === 'NumpadDecimal') weapon._muzzleDebugOffset.z += step;

                // size adjustments: NumpadAdd / NumpadSubtract and also Numpad1 / Numpad7
                else if (e.code === 'NumpadAdd' || e.code === 'Numpad1') {
                    weapon._muzzleDebugScale = (weapon._muzzleDebugScale || 1.0) * (1 + this.debugScaleStep);
                    window.speak(`Muzzle size ${weapon._muzzleDebugScale.toFixed(2)} meters`, { interrupt: true });
                } else if (e.code === 'NumpadSubtract' || e.code === 'Numpad7') {
                    weapon._muzzleDebugScale = Math.max(0.01, (weapon._muzzleDebugScale || 1.0) * (1 - this.debugScaleStep));
                    window.speak(`Muzzle size ${weapon._muzzleDebugScale.toFixed(2)} meters`, { interrupt: true });
                }

                // prevent any other handling when muzzle placement mode is active
                return;
            }

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
                // compute muzzle sphere world position & scale for logging
                let muzzleInfo = '';
                try {
                    if ( weapon._muzzleDebugSphere && weapon._muzzleDebugSphere.visible ) {
                        const sphere = weapon._muzzleDebugSphere;

                        // Capture the debug sphere's world position
                        const worldPos = sphere.getWorldPosition( new THREE.Vector3() );

                        // Convert it to weapon-local space
                        const localPos = g.worldToLocal( worldPos.clone() );

                        // The sphere's scale is already the final computed scale
                        const finalScale = sphere.scale.x;

                             // Update the runtime preset immediately
                        if (!this._muzzlePresets[this.currentWeapon]) {
                            this._muzzlePresets[this.currentWeapon] = {};
                        }
                        this._muzzlePresets[this.currentWeapon].position = localPos.clone();
                        this._muzzlePresets[this.currentWeapon].scale = finalScale;

                        // Reset debug offset since it's now baked into the preset
                        if (weapon._muzzleDebugOffset) weapon._muzzleDebugOffset.set(0, 0, 0);
                        weapon._muzzleDebugScale = 1.0;

                        muzzleInfo = `,\nmuzzleFlash: { position: new THREE.Vector3(${localPos.x.toFixed(4)}, ${localPos.y.toFixed(4)}, ${localPos.z.toFixed(4)}), scale: ${finalScale.toFixed(4)} }`;

                        // DEBUG VERIFICATION
                        const testWorld = g.localToWorld( localPos.clone() );
                        console.log( '[MUZZLE VERIFY] Sphere World Pos:', worldPos.toArray().map( n => n.toFixed( 4 ) ).join( ', ' ) );
                        console.log( '[MUZZLE VERIFY] Test World Pos:  ', testWorld.toArray().map( n => n.toFixed( 4 ) ).join( ', ' ) );

                        // Log the preset format for copy-pasting
                        console.log(
                            `%c[MUZZLE PRESET] Copy this into _muzzlePresets for "${this.currentWeapon}":`, 'color: #00ff00; font-weight: bold;'
                        );
                        console.log(
                            `${this.currentWeapon}: {\n` +
                            `    position: new THREE.Vector3(${localPos.x.toFixed(4)}, ${localPos.y.toFixed(4)}, ${localPos.z.toFixed(4)}),\n` +
                            `    scale: ${finalScale.toFixed(4)}\n` +
                            `},`
                        );
                    }
                } catch (e) {}
                console.log(
`Weapon offsets for "${this.currentWeapon}":
position: { x: ${g.position.x.toFixed(4)}, y: ${g.position.y.toFixed(4)}, z: ${g.position.z.toFixed(4)} },
rotation: { x: ${g.rotation.x.toFixed(4)}, y: ${g.rotation.y.toFixed(4)}, z: ${g.rotation.z.toFixed(4)} },
scale: ${g.scale.x.toFixed(4)}${muzzleInfo}`
                );
                window.speak(`${this.currentWeapon} offsets saved and logged`, { interrupt: true });
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
                    // muzzle debug state (per-weapon)
                    weapon._muzzleDebugMode = false;
                    weapon._muzzleDebugOffset = weapon._muzzleDebugOffset || new THREE.Vector3(0,0,0);
                    weapon._muzzleDebugScale = weapon._muzzleDebugScale || 1.0;
                    window.speak(`Animation selector enabled. ${clips.length} animations. Selected ${c.name}. time zero seconds. min zero. max ${maxT.toFixed(2)} seconds. Use numpad eight and two to change animations, plus and minus on numpad to change time. Press numpad divide to exit. Press M to toggle muzzle debug mode (when enabled use numpad arrows to move sphere and numpad + / - to resize).`, { interrupt: true });
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

                // Toggle muzzle debug mode while in animation selector: M key
                if (e.code === 'KeyM') {
                    weapon._muzzleDebugMode = !weapon._muzzleDebugMode;
                    window.speak(weapon._muzzleDebugMode ? 'Muzzle debug mode enabled' : 'Muzzle debug mode disabled', { interrupt: true });
                    return;
                }

                if (e.code === 'NumpadAdd' || e.code === 'NumpadSubtract') {
                    // If muzzle debug mode active, use +/- to change muzzle sphere size
                    if (weapon._muzzleDebugMode) {
                        weapon._muzzleDebugScale = weapon._muzzleDebugScale || 1.0;
                        const delta = (e.code === 'NumpadAdd') ? 0.05 : -0.05;
                        weapon._muzzleDebugScale = Math.max(0.05, weapon._muzzleDebugScale + delta);
                        window.speak(`Muzzle size ${weapon._muzzleDebugScale.toFixed(2)} meters`, { interrupt: true });
                        return;
                    }
                    // otherwise adjust animation time as before
                    if (!weapon._animDebug) weapon._animDebug = { index: idx, time: 0, step: this._animDebug.step, action: null };
                    if (e.code === 'NumpadAdd') {
                        weapon._animDebug.time = Math.min(maxT, (weapon._animDebug.time || 0) + (weapon._animDebug.step || 0.1));
                    } else {
                        weapon._animDebug.time = Math.max(0, (weapon._animDebug.time || 0) - (weapon._animDebug.step || 0.1));
                    }
                    try {
                        if (!weapon._animDebug.action) weapon._animDebug.action = weapon.mixer.clipAction(clips[weapon._animDebug.index]);
                        try { weapon.mixer.setTime(weapon._animDebug.time); } catch (e) { weapon.mixer.update(0); }
                    } catch(_){ }
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

            if (this._animDebug && this._animDebug.active && weapon._muzzleDebugMode) {
                // When muzzle debug mode is active, map numpad to adjust the muzzle sphere offset
                if (!weapon._muzzleDebugOffset) weapon._muzzleDebugOffset = new THREE.Vector3(0,0,0);
                if (e.code === 'Numpad8') weapon._muzzleDebugOffset.y += step;
                if (e.code === 'Numpad2') weapon._muzzleDebugOffset.y -= step;
                if (e.code === 'Numpad4') weapon._muzzleDebugOffset.x -= step;
                if (e.code === 'Numpad6') weapon._muzzleDebugOffset.x += step;
                if (e.code === 'Numpad5') weapon._muzzleDebugOffset.z -= step;
                if (e.code === 'NumpadDecimal') weapon._muzzleDebugOffset.z += step;
            } else {
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
            }

            // Scale
                if (e.code === 'Numpad1' || e.code === 'NumpadAdd') {
                    if (this._animDebug && this._animDebug.active && weapon._muzzleDebugMode) {
                        weapon._muzzleDebugScale = weapon._muzzleDebugScale || 1.0;
                        weapon._muzzleDebugScale = weapon._muzzleDebugScale * (1 + this.debugScaleStep);
                        window.speak(`Muzzle size ${weapon._muzzleDebugScale.toFixed(2)} meters`, { interrupt: true });
                    } else {
                        weapon.group.scale.multiplyScalar(1 + this.debugScaleStep);
                    }
                }

                if (e.code === 'Numpad7' || e.code === 'NumpadSubtract') {
                    if (this._animDebug && this._animDebug.active && weapon._muzzleDebugMode) {
                        weapon._muzzleDebugScale = weapon._muzzleDebugScale || 1.0;
                        weapon._muzzleDebugScale = Math.max(0.01, weapon._muzzleDebugScale * (1 - this.debugScaleStep));
                        window.speak(`Muzzle size ${weapon._muzzleDebugScale.toFixed(2)} meters`, { interrupt: true });
                    } else {
                        weapon.group.scale.multiplyScalar(1 - this.debugScaleStep);
                    }
                }
        });
    } // end _bindKeyboard
} // end WeaponManager