import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

export class EnemyVoiceManager {
  constructor(camera, listener) {
    this.listener = listener;
    this.camera = camera;

    this.maxSimultaneous = 2;
    this.globalCooldownMs = 900;
    this.perEnemyCooldownMs = 2500;
  this._engagePlayed = false; // <-- ADD THIS
    this._lastGlobalPlay = 0;
    this._enemyLastPlay = new Map();
    this._activeVoices = new Set();
  }

  request({ enemy, type, clips }) {
  console.log("[VOICE REQUEST]", enemy?.id, type, clips?.length);

  // --- Basic validation ---
  if (!enemy || !enemy.mesh || !clips || clips.length === 0) {
    console.warn("[VOICE BLOCKED] invalid request");
    return;
  } // end validation

  const now = performance.now();

  // --- ENGAGE: allow only once per scene ---
  if (type === "engage") {
    if (this._engagePlayed) {
      console.log("[VOICE BLOCKED] engage already played");
      return;
    }
    this._engagePlayed = true;
  } // end engage gate

  // --- Max simultaneous voices ---
  if (this._activeVoices.size >= this.maxSimultaneous) {
    console.log("[VOICE BLOCKED] maxSimultaneous");
    return;
  } // end maxSimultaneous check

  // --- Global cooldown (engage ignores this) ---
  if (type !== "engage") {
    if (now - this._lastGlobalPlay < this.globalCooldownMs) {
      console.log("[VOICE BLOCKED] global cooldown");
      return;
    }
  } // end global cooldown check

  // --- Per-enemy cooldown (engage ignores this) ---
  if (type !== "engage") {
    const lastEnemy = this._enemyLastPlay.get(enemy.id) || 0;
    if (now - lastEnemy < this.perEnemyCooldownMs) {
      console.log("[VOICE BLOCKED] per-enemy cooldown");
      return;
    }
  } // end per-enemy cooldown check

  // --- Distance check ---
  const dist = enemy.mesh.position.distanceTo(this.camera.position);
  console.log("[VOICE DIST]", dist);

  if (dist > 25) {
    console.log("[VOICE BLOCKED] too far");
    return;
  } // end distance check

  // --- Select and play clip ---
  const clip = clips[Math.floor(Math.random() * clips.length)];
  console.log("[VOICE PLAY]", clip);

  this._play3D(enemy, clip);

  // --- Update cooldown tracking (non-engage only) ---
  if (type !== "engage") {
    this._lastGlobalPlay = now;
    this._enemyLastPlay.set(enemy.id, now);
  }
} // end request()

  _play3D(enemy, url) {
  const loader = new THREE.AudioLoader();

  loader.load(url, buffer => {
    const sound = new THREE.PositionalAudio(this.listener);
    sound.setBuffer(buffer);
    sound.setVolume(0.5);
    sound.setRefDistance(10); // distance for 3D attenuation

    enemy.mesh.add(sound);           // attach to enemy mesh
    this._activeVoices.add(sound);   // track active voices

    // Remove when finished
    sound.onEnded = () => {
      enemy.mesh.remove(sound);
      this._activeVoices.delete(sound);
    };

    sound.play();
  });
}
}