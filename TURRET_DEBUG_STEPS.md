// Step-by-step turret debug commands
// Run each one separately in browser console and report what you see

// STEP 1: Check if debug tools are loaded
window.TURRET_DEBUG

// STEP 2: If Step 1 shows an object, list all turrets
TURRET_DEBUG.listTurrets()

// STEP 3: Check all enemies
window.ENEMY_INSTANCES

// STEP 4: Search for turret enemies
window.ENEMY_INSTANCES?.filter(e => String(e.id).includes('turret'))

// STEP 5: Check scene loader
window.sceneLoader

// STEP 6: Check for all meshes in scene
window.sceneLoader?.enemies?.map(e => ({ id: e.id, hasMesh: !!e.mesh }))

// STEP 7: Manual sphere search
window.ENEMY_INSTANCES?.forEach(e => {
  if (String(e.id).includes('autoturret')) {
    console.log(`Enemy: ${e.id}, Active: ${e._isActive}, HasMesh: ${!!e.mesh}`);
    if (e.mesh) {
      let sphereCount = 0;
      e.mesh.traverse(obj => {
        if (obj.isMesh && obj.geometry?.type === 'SphereGeometry') {
          console.log(`  Found sphere: ${obj.name}, visible=${obj.visible}, scale=${obj.scale.x.toFixed(3)}`);
          sphereCount++;
        }
      });
      if (sphereCount === 0) console.log('  No spheres found');
    }
  }
});
