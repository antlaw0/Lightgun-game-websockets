# Door System - Quick Reference Guide

## Overview
Complete door opening/closing mechanics for GLB models with hinge-based rotation and animation.

## Scene Definition Format

```javascript
{
  id: "door_01",
  type: "door",
  position: { x: 1, y: 0, z: 18 },
  rotation: { x: 0, y: 0, z: 0 },
  size: { x: 1.2, y: 2.2, z: 0.15 },
  hp: 9999,
  maxHp: 9999,
  indestructible: true,
  texture: "assets/textures/door_wood.png",
  
  // Door-specific properties
  openDirection: 1,              // 1 = right hinge, -1 = left hinge
  openInOut: 1,                  // 1 = outward (away from camera), -1 = inward (toward camera)
  openDuration: 800,             // milliseconds for 90° rotation
  openSound: "assets/sfx/props/door1.ogg"  // Optional sound file
}
```

## Property Combinations

| openDirection | openInOut | Behavior |
|---|---|---|
| 1 | 1 | Right hinge, swings outward |
| 1 | -1 | Right hinge, swings inward |
| -1 | 1 | Left hinge, swings outward |
| -1 | -1 | Left hinge, swings inward |

## Usage Methods

### 1. Player F Key Interaction
- Player presses **F** key near a door (within 3 units)
- Closest door is automatically detected and toggled (open/close)
- Smooth 90° rotation over specified `openDuration` milliseconds
- Sound plays when door opens

```javascript
// Automatically triggered by F key press
tryInteractDoor(); // Finds and toggles nearest door
```

### 2. Camera Rails Sequence Triggering
Add door triggers to camera rails `onReach` callbacks:

```javascript
cameraRails: {
  intro: [
    { 
      type: 'moveTo', 
      position: { x: 0, y: 1.7, z: 12 }, 
      duration: 2000 
    },
    { 
      type: 'pause', 
      duration: 500,
      onReach: () => window.openDoorById('door_01')  // Opens door at this point
    },
    { 
      type: 'moveTo', 
      position: { x: 5, y: 1.7, z: 10 }, 
      duration: 1000
    },
    {
      type: 'pause',
      duration: 300,
      onReach: () => window.closeDoorById('door_01')  // Closes door at this point
    }
  ]
}
```

### 3. Direct JavaScript Control
From console or other code:

```javascript
// Open a door by ID
window.openDoorById('door_01');
window.openDoorById('door_01', () => {
  console.log('Door opened!');
});

// Close a door by ID
window.closeDoorById('door_01');
window.closeDoorById('door_01', () => {
  console.log('Door closed!');
});

// Access door instance directly from SceneLoader
const door = window.sceneLoader.propsById['door_01'];
door.openDoor();    // Open
door.closeDoor();   // Close
door.toggleDoor();  // Toggle state
```

## Door Properties & Methods

### Properties
- `id` - Unique door identifier
- `isOpen` - Current state (boolean)
- `isAnimating` - Animation in progress (boolean)
- `openDirection` - 1 (right) or -1 (left)
- `openInOut` - 1 (outward) or -1 (inward)
- `openDuration` - Animation duration in milliseconds
- `openSound` - Sound file path
- `mesh` - THREE.Group containing door geometry
- `hinge` - Rotation point (same as mesh)
- `position` - World position {x, y, z}
- `size` - Door dimensions {x, y, z}

### Methods
- `openDoor(callback)` - Animate door open
- `closeDoor(callback)` - Animate door closed
- `toggleDoor()` - Toggle open/closed state
- `getDoorCenterPosition()` - Get world position Vector3
- `isPlayerNear(playerPos, distance=3)` - Check proximity

## Animation Details
- Uses `requestAnimationFrame` for smooth 60fps animation
- Rotation around Y-axis
- Linear interpolation over `openDuration` milliseconds
- Respects both `openDirection` and `openInOut` properties
- Audio plays at start of opening animation

## Testing
1. Load `scene_test.js` which contains `door_01`
2. Move player camera near position (x:1, y:0, z:18)
3. Press **F** to open door
4. Press **F** again to close door
5. Door rotates 90° in 800ms with sound effect

## Audio Files
Door sound files should be located in `public/assets/sfx/props/` directory.
Specify the path relative to the public folder in `openSound` property:
- `"assets/sfx/props/door1.ogg"` ✓ Correct
- `"public/assets/sfx/props/door1.ogg"` ✗ Incorrect

## Tips
- Set `openDuration` to match animation speeds (typically 600-1000ms for 90° door)
- Use `-1` for left-side hinges on right-side door frames
- Test camera rails timing to ensure doors don't block player movement during sequence
- Can stack multiple door operations in camera rails by chaining `onReach` callbacks
