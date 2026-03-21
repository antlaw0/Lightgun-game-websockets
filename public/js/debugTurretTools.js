// js/debugTurretTools.js
// Debug utilities for inspecting turret rendering issues

export function setupTurretDebugTools() {
  window.TURRET_DEBUG = {
    // Get all spheres in a specific turret
    getSpheres: (turretId) => {
      const enemy = window.ENEMY_INSTANCES?.find(e => e.id === turretId);
      if (!enemy) {
        console.warn(`Turret ${turretId} not found`);
        return [];
      }
      if (!enemy.mesh) {
        console.warn(`Turret ${turretId} has no mesh yet`);
        return [];
      }
      
      const spheres = [];
      enemy.mesh.traverse(obj => {
        if (obj.isMesh && obj.geometry && obj.geometry.type === 'SphereGeometry') {
          spheres.push({
            name: obj.name,
            visible: obj.visible,
            position: obj.position.clone(),
            scale: obj.scale.clone(),
            geometry: obj.geometry,
            material: obj.material,
            parent: obj.parent?.name || 'root',
            userData: obj.userData
          });
        }
      });
      return spheres;
    },

    // Log all spheres in a turret
    logSpheres: (turretId) => {
      const spheres = window.TURRET_DEBUG.getSpheres(turretId);
      if (spheres.length === 0) {
        console.log(`[TURRET DEBUG] No spheres found in turret ${turretId}`);
        return;
      }
      console.warn(`[TURRET DEBUG] Found ${spheres.length} spheres in turret ${turretId}:`);
      spheres.forEach((s, idx) => {
        const posStr = `(${s.position.x.toFixed(2)}, ${s.position.y.toFixed(2)}, ${s.position.z.toFixed(2)})`;
        const scaleStr = `(${s.scale.x.toFixed(3)}, ${s.scale.y.toFixed(3)}, ${s.scale.z.toFixed(3)})`;
        const geomStr = JSON.stringify(s.geometry.parameters);
        console.warn(`  [${idx}] name='${s.name}' visible=${s.visible} pos=${posStr} scale=${scaleStr}`, geomStr);
      });
    },

    // Toggle visibility of a sphere by name
    toggleSphere: (turretId, sphereName) => {
      const enemy = window.ENEMY_INSTANCES?.find(e => e.id === turretId);
      if (!enemy?.mesh) return false;
      
      let found = false;
      enemy.mesh.traverse(obj => {
        if (obj.isMesh && obj.geometry && obj.geometry.type === 'SphereGeometry' && obj.name === sphereName) {
          obj.visible = !obj.visible;
          console.log(`[TURRET DEBUG] Toggled sphere '${sphereName}' to visible=${obj.visible}`);
          found = true;
        }
      });
      return found;
    },

    // Hide all spheres in a turret
    hideAllSpheres: (turretId) => {
      const enemy = window.ENEMY_INSTANCES?.find(e => e.id === turretId);
      if (!enemy?.mesh) return;
      
      let count = 0;
      enemy.mesh.traverse(obj => {
        if (obj.isMesh && obj.geometry && obj.geometry.type === 'SphereGeometry') {
          obj.visible = false;
          count++;
        }
      });
      console.log(`[TURRET DEBUG] Hid ${count} spheres in turret ${turretId}`);
    },

    // Show all spheres in a turret
    showAllSpheres: (turretId) => {
      const enemy = window.ENEMY_INSTANCES?.find(e => e.id === turretId);
      if (!enemy?.mesh) return;
      
      let count = 0;
      enemy.mesh.traverse(obj => {
        if (obj.isMesh && obj.geometry && obj.geometry.type === 'SphereGeometry') {
          obj.visible = true;
          count++;
        }
      });
      console.log(`[TURRET DEBUG] Showed ${count} spheres in turret ${turretId}`);
    },

    // Get all turrets
    listTurrets: () => {
      const turrets = (window.ENEMY_INSTANCES || []).filter(e => e.id && e.id.includes('autoturret'));
      console.log(`[TURRET DEBUG] Found ${turrets.length} turrets:`);
      turrets.forEach(t => {
        console.log(`  - ${t.id} (active=${t._isActive})`);
      });
      return turrets.map(t => t.id);
    },

    // Help
    help: () => {
      console.log(`
TURRET DEBUG TOOLS:
  TURRET_DEBUG.listTurrets()           - List all turrets
  TURRET_DEBUG.getSpheres(id)          - Get sphere data for turret
  TURRET_DEBUG.logSpheres(id)          - Log all spheres in turret
  TURRET_DEBUG.toggleSphere(id, name)  - Toggle sphere visibility
  TURRET_DEBUG.hideAllSpheres(id)      - Hide all spheres
  TURRET_DEBUG.showAllSpheres(id)      - Show all spheres
  TURRET_DEBUG.help()                  - Show this help
`);
    }
  };
  
  console.log('[TURRET DEBUG] Tools loaded. Type TURRET_DEBUG.listTurrets() to get started.');
}
