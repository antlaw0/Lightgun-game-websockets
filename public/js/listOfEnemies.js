import { Enemy } from './enemy.js';

export const LIST_OF_ENEMIES = {
  grunt_1: {
    name: 'grunt_1',
    type: 'Grunt',
    displayName: 'Grunt Soldier',
    hp: 40,
    modelUrl: 'assets/models/model.fbx',
    modelScale: null,
    behavior: {
      pattern: 'path',
      params: {
        loop: true,
        steps: [
          { type: 'move', axis: 'x', distance: 6, durationMs: 3000 },
          { type: 'pause', durationMs: 800 },
          { type: 'move', axis: 'x', distance: -6, durationMs: 3000 },
          { type: 'pause', durationMs: 800 }
        ]
      }
    },
    firePauseMs: 800,
    weapon: 'pistol',
    sprite: 'assets/sprites/grunt.png',
    voice: {
      pain: ['assets/sfx/grunt/pain1.ogg', 'assets/sfx/grunt/pain2.ogg'],
      death: ['assets/sfx/grunt/death1.ogg', 'assets/sfx/grunt/death2.ogg'],
      taunt: ['assets/sfx/grunt/taunt1.ogg', 'assets/sfx/grunt/taunt2.ogg'],
      engage: ['assets/sfx/grunt/engage1.ogg']
    },
    hitSounds: ['assets/sfx/grunt/hit1.ogg', 'assets/sfx/grunt/hit2.ogg'],
    deathSounds: ['assets/sfx/grunt/death1.ogg', 'assets/sfx/grunt/death2.ogg']
  },

  drone_1: {
    name: 'drone_1',
    type: 'Drone',
    displayName: 'Drone',
    hp: 30,
    modelUrl: 'assets/models/drone.glb',
    modelScale: 0.3,
    behavior: {
      pattern: 'path',
      params: {
        loop: true,
        steps: [
          { type: 'move', axis: 'y', distance: 2.2, durationMs: 1200 },
          { type: 'pause', durationMs: 400 },
          { type: 'move', axis: 'x', distance: 3.0, durationMs: 2200 },
          { type: 'pause', durationMs: 600 },
          { type: 'move', axis: 'x', distance: -3.0, durationMs: 2200 },
          { type: 'pause', durationMs: 600 },
          { type: 'move', axis: 'y', distance: -1.2, durationMs: 1200 },
          { type: 'pause', durationMs: 800 }
        ]
      }
    },
    firePauseMs: 900,
    weapon: 'laser_pistol',
    voice: {
      loop: ['assets/sfx/drone/drone_loop.ogg'],
      pain: ['assets/sfx/drone/drone_pain1.ogg'],
      taunt: ['assets/sfx/drone/drone_taunt1.ogg']
    },
    hitSounds: ['assets/sfx/drone/drone_hit1.ogg', 'assets/sfx/drone/drone_hit2.ogg'],
    deathSounds: ['assets/sfx/drone/drone_die1.ogg', 'assets/sfx/drone/drone_die2.ogg']
  },

  brute_1: {
    name: 'brute_1',
    type: 'Grunt',
    displayName: 'Brute',
    hp: 60,
    modelUrl: 'assets/models/brute.fbx',
    animationUrls: {
      walk: 'assets/animations/brute_walk.fbx'
    },
    behavior: {
      pattern: 'meleeRush',
      params: {
        approachSpeed: 0.9,
        meleeRange: 1.6,
        sideOffset: 0.2,
        attackCooldownMs: 900
      }
    },
    sprite: 'assets/sprites/grunt.png',
    hitSounds: ['assets/sfx/grunt/hit1.ogg', 'assets/sfx/grunt/hit2.ogg'],
    deathSounds: ['assets/sfx/grunt/death1.ogg', 'assets/sfx/grunt/death2.ogg']
  }
};

let _spawnCounter = 0;

export function spawnEnemy(x = 0, y = 0, z = 0, name) {
  const def = LIST_OF_ENEMIES[name];
  if (!def) {
    console.warn('spawnEnemy: unknown enemy name', name);
    return null;
  }
  if (!window.sceneLoader) {
    console.warn('spawnEnemy: window.sceneLoader not found');
    return null;
  }

  const id = `${name}_${Date.now()}_${++_spawnCounter}`;
  const instanceConfig = {
    id,
    position: { x: Number(x) || 0, y: Number(y) || 0, z: Number(z) || 0 }
  };

  const enemy = new Enemy(window.sceneLoader.scene, def, instanceConfig, window.player, (origin, target, speed) => {
    if (window.sceneLoader && typeof window.sceneLoader.spawnProjectile === 'function') {
      return window.sceneLoader.spawnProjectile(origin, target, speed ?? 28);
    }
    return null;
  });

  // Register with SceneLoader so it tracks meshes and enemies by id
  if (typeof window.sceneLoader.addEnemy === 'function') {
    window.sceneLoader.addEnemy(enemy);
  }

  return enemy;
}

// Attach helper to global for convenience
window.spawnEnemy = spawnEnemy;

export default LIST_OF_ENEMIES;
