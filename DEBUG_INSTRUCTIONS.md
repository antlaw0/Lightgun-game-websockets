# Turret Debug Instructions

## Quick Troubleshooting

### Step 1: Verify Debug Tools are Loaded
```javascript
// Check if debug tools exist
console.log(window.TURRET_DEBUG);

// Should output an object with methods, not undefined
```

### Step 2: List All Turrets
```javascript
// This will log all turrets and their IDs
TURRET_DEBUG.listTurrets();

// Copy the exact turret ID from the output
```

### Step 3: Check if the Specific Turret Exists
```javascript
// Replace 'autoturret_1' with the correct ID from step 2
const enemy = window.ENEMY_INSTANCES?.find(e => e.id === 'autoturret_1');
console.log('Enemy found:', !!enemy);
console.log('Enemy has mesh:', !!enemy?.mesh);
```

### Step 4: If Mesh Doesn't Exist Yet
The mesh might be loading asynchronously. Wait a moment and try again:
```javascript
// Wait 2 seconds for async model loading
setTimeout(() => {
  TURRET_DEBUG.logSpheres('autoturret_1');
}, 2000);
```

### Step 5: If Still Not Working
Check the browser console for any errors:
```javascript
// Look for console messages like:
// [TURRET DEBUG] Tools loaded...
// [turret...] Found X SphereGeometry objects
// [characterLoader] Found X SphereGeometry in loaded model
```

---

## What Each Tool Does

| Command | Purpose |
|---------|---------|
| `TURRET_DEBUG.listTurrets()` | Shows all turret IDs in the scene |
| `TURRET_DEBUG.getSpheres(id)` | Returns array of all spheres in a turret |
| `TURRET_DEBUG.logSpheres(id)` | Logs sphere details to console |
| `TURRET_DEBUG.hideAllSpheres(id)` | Hides all spheres (test if one is the problem) |
| `TURRET_DEBUG.showAllSpheres(id)` | Shows all spheres |
| `TURRET_DEBUG.toggleSphere(id, name)` | Toggle a specific sphere by name |

---

## Expected Console Output

When spheres are found, you should see output like:
```
[TURRET DEBUG] Found 1 spheres in turret autoturret_1:
  [0] name='auto_turret_muzzle_flash_fx' visible=true scale=(0.045, 0.045, 0.045)
```

The muzzle flash sphere is **normally tiny** (0.045 scale). If you see a huge sphere, report its:
- Name
- Scale values
- Geometry parameters

---

## If You See the Huge Sphere

Run this to hide it:
```javascript
TURRET_DEBUG.hideAllSpheres('autoturret_1');
```

If that removes the sphere, we know it's a THREE.js sphere. Then run:
```javascript
TURRET_DEBUG.logSpheres('autoturret_1');
```

to identify which one it is.
