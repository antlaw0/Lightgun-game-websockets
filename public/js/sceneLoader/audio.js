import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

export function playImpactSoundAudio(self, soundPath, position, volume = 0.7) {
  if (!soundPath) return;

  const audio = new Audio(soundPath);
  audio.volume = volume;
  audio.play().catch(() => {});
}

export function getAudioListenerAudio(self) {
  try {
    if (self.camera && self.camera.children && self.camera.children.length) {
      for (const c of self.camera.children) {
        if (!c) continue;
        if (c.isAudioListener || c.type === 'AudioListener') return c;
      }
    }
  } catch (e) {}
  if (window.audioListener) return window.audioListener;
  return null;
}

export function playPositionalImpactSoundAudio(self, soundPathOrArray, position, volume = 0.8, refDistance = 6) {
  if (!soundPathOrArray || !position) return;

  let soundPath = soundPathOrArray;
  if (Array.isArray(soundPathOrArray) && soundPathOrArray.length) {
    soundPath = soundPathOrArray[Math.floor(Math.random() * soundPathOrArray.length)];
  }

  const listener = getAudioListenerAudio(self);
  if (!listener) {
    playImpactSoundAudio(self, soundPath, position, volume);
    return;
  }

  const loader = self._audioLoader;
  const cache = self._audioBufferCache;
  const scene = self.scene;

  const playBuffer = (buffer) => {
    try {
      const sound = new THREE.PositionalAudio(listener);
      sound.setBuffer(buffer);
      sound.setRefDistance(refDistance);
      sound.setVolume(volume);

      const holder = new THREE.Object3D();
      holder.position.copy(position);
      holder.add(sound);
      scene.add(holder);

      sound.onEnded = () => {
        try {
          scene.remove(holder);
        } catch (e) {}
      };
      try {
        sound.play();
      } catch (e) {
        console.warn('Positional play failed', e);
      }

      const maxMs = Math.max(4000, Math.round((buffer.duration || 1) * 1000) + 2000);
      setTimeout(() => {
        try {
          if (scene && holder && holder.parent) scene.remove(holder);
        } catch (e) {}
      }, maxMs);
    } catch (e) {
      console.warn('playBuffer failed', e);
    }
  };

  if (cache[soundPath]) {
    playBuffer(cache[soundPath]);
    return;
  }

  loader.load(
    soundPath,
    (buffer) => {
      cache[soundPath] = buffer;
      playBuffer(buffer);
    },
    undefined,
    (err) => {
      console.warn('Positional audio load failed', soundPath, err);
      playImpactSoundAudio(self, soundPath, position, volume);
    }
  );
}
