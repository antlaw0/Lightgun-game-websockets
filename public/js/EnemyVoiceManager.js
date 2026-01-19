import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

console.log('[VOICE MODULE LOADED]', new Date().toISOString());

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
    this._loopVoices = new Map(); // enemyId -> PositionalAudio for looping clips
  }

  request({ enemy, type, clips, _retry = 0 }) {
  console.log("[VOICE REQUEST]", enemy?.id, type, clips?.length, "retry=" + _retry);

  // --- Basic validation (mesh may be not yet attached; allow retries) ---
  if (!enemy || !clips || clips.length === 0) {
    console.warn("[VOICE BLOCKED] invalid request");
    console.log('[VOICE BLOCK] invalid request', enemy?.id, clips && clips.length);
    return;
  }

  // If mesh is not attached yet, retry a few times (model loading is async)
  if (!enemy.mesh) {
    if (_retry < 6) {
      const delay = 200;
      console.log('[VOICE] enemy.mesh not ready, retrying', enemy.id, 'in', delay, 'ms (attempt', _retry + 1, ')');
      setTimeout(() => this.request({ enemy, type, clips, _retry: _retry + 1 }), delay);
      return;
    }
    console.warn('[VOICE] enemy.mesh never became ready, giving up for', enemy.id);
    console.log('[VOICE BLOCK] mesh-never-ready', enemy.id);
    return;
  }

  // Extra diagnostics: mesh parent, position, distance and AudioContext state
  try {
    console.log('[VOICE DIAG] mesh parent:', enemy.mesh.parent ? 'attached' : 'null', 'mesh.pos=', enemy.mesh.position?.toArray());
    const listenerState = this.listener?.context?.state;
    console.log('[VOICE DIAG] AudioContext state=', listenerState);
    const distDiag = enemy.mesh.position.distanceTo(this.camera.position);
    console.log('[VOICE DIAG] distanceToCamera=', distDiag, 'cameraPos=', this.camera.position?.toArray());
  } catch (e) { console.warn('[VOICE DIAG] diagnostic probe failed', e); }

  const now = performance.now();

  // --- ENGAGE: allow only once per scene ---
  if (type === "engage") {
    if (this._engagePlayed) {
      //console.log("[VOICE BLOCKED] engage already played");
      return;
    }
    this._engagePlayed = true;
  } // end engage gate

  // --- Max simultaneous voices ---
  // Looped ambient voices should be allowed to start even if the transient
  // voice budget is exhausted. Only enforce maxSimultaneous for non-loop types.
  if (type !== 'loop' && this._activeVoices.size >= this.maxSimultaneous) {
    console.log('[VOICE BLOCK] maxSimultaneous', this._activeVoices.size, '>=', this.maxSimultaneous);
    return;
  } // end maxSimultaneous check

  // --- Global cooldown (engage ignores this). Allow loops to bypass global cooldown so they can auto-start ---
  if (type !== "engage" && type !== "loop") {
    if (now - this._lastGlobalPlay < this.globalCooldownMs) {
      console.log('[VOICE BLOCK] globalCooldown delta=', Math.round(now - this._lastGlobalPlay));
      return;
    }
  } else if (type === 'loop') {
    console.log('[VOICE] bypassing globalCooldown for loop', enemy.id);
  } // end global cooldown check

  // --- Per-enemy cooldown (engage and loop ignore this) ---
  // Looped voices are ambient for a given enemy and should not be blocked by
  // the short per-enemy cooldown used for transient voice lines.
  if (type !== "engage" && type !== 'loop') {
    const lastEnemy = this._enemyLastPlay.get(enemy.id) || 0;
    if (now - lastEnemy < this.perEnemyCooldownMs) {
      console.log('[VOICE BLOCK] perEnemyCooldown delta=', Math.round(now - lastEnemy));
      return;
    }
  } // end per-enemy cooldown check

  // --- Distance check ---
  const dist = enemy.mesh.position.distanceTo(this.camera.position);
  //console.log("[VOICE DIST]", dist);

  if (dist > 25) {
    console.log('[VOICE BLOCK] tooFar dist=', dist);
    return;
  } // end distance check

  // --- Select and play clip ---
  const clip = clips[Math.floor(Math.random() * clips.length)];
  //console.log("[VOICE PLAY]", clip);

  // Detailed, single-line trace for loop gating decisions (helps when Network tab isn't available)
  try {
    const loopGate = {
      meshPresent: !!enemy.mesh,
      alreadyLooping: this._loopVoices.has(enemy.id),
      activeVoices: this._activeVoices.size,
      maxSimultaneous: this.maxSimultaneous,
      lastGlobalDelta: Math.round(performance.now() - this._lastGlobalPlay),
      perEnemyDelta: Math.round(performance.now() - (this._enemyLastPlay.get(enemy.id) || 0)),
      distance: Math.round(dist)
    };
    console.log('[VOICE TRACE]', enemy.id, 'type=', type, 'clip=', clip, JSON.stringify(loopGate));
  } catch (e) { console.warn('[VOICE TRACE] failed', e); }

  // If this is a loop request, handle specially: only one loop per enemy
  if (type === 'loop') {
    // if already playing a loop for this enemy, skip
    if (this._loopVoices.has(enemy.id)) {
      console.log("[VOICE] loop already playing for", enemy.id);
      return;
    }

    // warn if AudioContext is suspended (autoplay policy)
    try {
      const state = this.listener?.context?.state;
      if (state === 'suspended') console.warn('[VOICE] AudioContext suspended; user interaction needed to resume');
    } catch (e) {}

    console.log("[VOICE] starting loop for", enemy.id, clip);

    // Check that the audio file is reachable (show HTTP status) before attempting loader.
    (async () => {
      try {
        const url = clip;
        // try HEAD first to reveal server status quickly
        let status = null;
        try {
          const resp = await fetch(url, { method: 'HEAD' });
          status = resp.status;
        } catch (e) {
          // HEAD might fail on some servers; try a GET without downloading body
          try { const resp2 = await fetch(url, { method: 'GET' }); status = resp2.status; } catch (e2) { status = 'fetch-failed'; }
        }
        console.log('[VOICE DIAG] asset HTTP status for', clip, '=', status);
      } catch (e) { console.warn('[VOICE DIAG] fetch diag failed', e); }

      // Give a small delay if mesh is present but not yet parented to scene
      if (!enemy.mesh.parent) await new Promise(r => setTimeout(r, 120));

      this._play3DLoop(enemy, clip);
    })();
    return;
  }

  this._play3D(enemy, clip);

  // --- Update cooldown tracking (non-engage only) ---
  if (type !== "engage") {
    this._lastGlobalPlay = now;
    this._enemyLastPlay.set(enemy.id, now);
  }
} // end request()

  _play3D(enemy, url) {
  const loader = new THREE.AudioLoader();
  loader.load(url,
    buffer => {
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

      try { sound.play(); console.log('[VOICE] played', url, 'for', enemy.id); } catch (e) { console.warn('[VOICE] play failed', e); }
    },
    // onProgress
    undefined,
    // onError
    err => { console.warn('[VOICE] audio load failed', url, err); }
  );
}

  // Play a looped positional audio attached to an enemy. The loop is tracked
  // so it can be stopped when the enemy dies or is removed.
  _play3DLoop(enemy, url) {
    const loader = new THREE.AudioLoader();
    console.log('[VOICE] _play3DLoop loader.start', url, 'for', enemy.id);
    loader.load(url,
      buffer => {
        try {
          console.log('[VOICE] _play3DLoop buffer loaded', url, 'duration=', buffer.duration);
          const sound = new THREE.PositionalAudio(this.listener);
          sound.setBuffer(buffer);
          sound.setLoop(true);
          sound.setVolume(0.5);
          sound.setRefDistance(10);

          enemy.mesh.add(sound);
          this._activeVoices.add(sound);
          this._loopVoices.set(enemy.id, sound);

          try { sound.play(); console.log('[VOICE] loop started', url, 'for', enemy.id); } catch (e) { console.warn('[VOICE] loop play failed', e); }
        } catch (e) {
          console.warn('[VOICE] failed to start loop', url, e);
        }
      },
      // onProgress
      xhr => {
        try { console.log('[VOICE] _play3DLoop progress', url, xhr.loaded, xhr.total); } catch(e){}
      },
      // onError
      err => { console.warn('[VOICE] loop audio load failed', url, err); }
    );
  }

  // Stop any looped voice for a given enemy (safe to call if none exist)
  stopLoop(enemy) {
    try {
      const sound = this._loopVoices.get(enemy.id);
      if (!sound) return;
      console.log('[VOICE] stopping loop for', enemy.id);
      try { sound.stop(); } catch(_) {}
      try { if (enemy.mesh) enemy.mesh.remove(sound); } catch(_) {}
      this._loopVoices.delete(enemy.id);
      this._activeVoices.delete(sound);
    } catch (e) { console.warn('stopLoop failed', e); }
  }
}