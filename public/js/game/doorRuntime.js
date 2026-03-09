export function createDoorRuntime({ THREE }) {
  function tryInteractDoor() {
    if (!window.sceneLoader || !window.sceneLoader.props) return;
    if (!window.player || !window.player.camera) return;

    const playerPos = window.player.camera.position.clone();

    const doors = window.sceneLoader.props.filter((prop) => {
      return prop && (prop.openDoor || (prop.mesh && prop.mesh.userData && prop.mesh.userData.isDoor));
    });

    if (doors.length === 0) {
      console.log('No doors available');
      return;
    }

    const PROXIMITY_DISTANCE = 6.0;
    const HORIZONTAL_PROXIMITY = 5.5;
    let closestDoor = null;
    let closestDistance = PROXIMITY_DISTANCE;

    doors.forEach((door) => {
      if (door.mesh) {
        const doorPos =
          typeof door.getDoorCenterPosition === 'function'
            ? door.getDoorCenterPosition()
            : new THREE.Vector3().setFromMatrixPosition(door.mesh.matrixWorld);
        const dx = playerPos.x - doorPos.x;
        const dz = playerPos.z - doorPos.z;
        const horizontalDistance = Math.hypot(dx, dz);
        const distance = playerPos.distanceTo(doorPos);
        const effectiveDistance = Math.min(distance, horizontalDistance);

        if (
          effectiveDistance < closestDistance &&
          (distance <= PROXIMITY_DISTANCE || horizontalDistance <= HORIZONTAL_PROXIMITY)
        ) {
          closestDistance = effectiveDistance;
          closestDoor = door;
        }
      }
    });

    if (closestDoor) {
      console.log('Interacting with door:', closestDoor.id);
      if (typeof closestDoor.openDoor === 'function') {
        if (closestDoor.isOpen) closestDoor.closeDoor();
        else closestDoor.openDoor();
      } else {
        console.warn('Door does not have openDoor method');
      }
    } else {
      console.log('No doors within proximity');
    }
  }

  function openDoorById(doorId, callback) {
    if (!window.sceneLoader || !window.sceneLoader.propsById) return;
    const door = window.sceneLoader.propsById[doorId];
    if (door && typeof door.openDoor === 'function') {
      door.openDoor(callback);
    } else {
      console.warn('Door not found or missing openDoor method:', doorId);
    }
  }

  function closeDoorById(doorId, callback) {
    if (!window.sceneLoader || !window.sceneLoader.propsById) return;
    const door = window.sceneLoader.propsById[doorId];
    if (door && typeof door.closeDoor === 'function') {
      door.closeDoor(callback);
    } else {
      console.warn('Door not found or missing closeDoor method:', doorId);
    }
  }

  return {
    tryInteractDoor,
    openDoorById,
    closeDoorById
  };
}
