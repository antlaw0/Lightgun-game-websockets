// game/loadingTracker.js
// Tracks in-flight GLTF / texture loads so the boot sequence can wait until
// all initial scene assets have finished loading before starting the game loop.

let _pending = 0;
const _waiters = [];

/**
 * Register a Promise with the tracker.
 * _pending increments immediately; decrements when the promise settles.
 * @param {Promise<any>} promise
 */
export function trackLoad(promise) {
  _pending++;
  Promise.resolve(promise).finally(() => {
    _pending = Math.max(0, _pending - 1);
    if (_pending === 0) {
      const batch = _waiters.splice(0);
      batch.forEach(resolve => resolve());
    }
  });
}

/**
 * Returns a Promise that resolves once all tracked loads have settled.
 * Resolves immediately if nothing is currently pending.
 * @returns {Promise<void>}
 */
export function waitForLoads() {
  if (_pending === 0) return Promise.resolve();
  return new Promise(resolve => _waiters.push(resolve));
}
