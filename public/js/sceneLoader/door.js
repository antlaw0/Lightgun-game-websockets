import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

/**
 * Door class - handles door opening/closing with animation.
 */
export class Door {
  constructor(def) {
    this.id = def.id || 'door_' + Math.random();
    this.mesh = def.mesh;
    this.hinge = this.mesh;
    this.position = def.position || { x: 0, y: 0, z: 0 };
    this.size = def.size || { x: 1, y: 2, z: 0.15 };
    this.hp = 9999;
    this.maxHp = 9999;
    this.indestructible = true;

    this.openDirection = def.openDirection || 1;
    this.openInOut = def.openInOut || 1;
    this.openDuration = def.openDuration || 800;
    this.openSound = def.openSound || null;

    this.isOpen = false;
    this.isAnimating = false;
    this.currentRotation = 0;
    this.openedRotation = 0;
    this.doorMesh = def.doorMesh;
    this.openAngle = Math.PI / 2;
    this.closedRotationY = this.hinge?.rotation?.y ?? 0;
    this.closedQuaternion = this.hinge?.quaternion?.clone() ?? new THREE.Quaternion();
    this.openQuaternion = this.closedQuaternion.clone();

    if (this.openSound) {
      try {
        this.audioElement = new Audio(this.openSound);
        this.audioElement.volume = 0.7;
      } catch (e) {
        console.warn('Failed to preload door sound:', this.openSound, e);
        this.audioElement = null;
      }
    }
  }

  openDoor(onComplete) {
    if (this.isAnimating || this.isOpen) {
      if (onComplete) onComplete();
      return;
    }

    this.isAnimating = true;
    const startTime = Date.now();
    const directionSign = (this.openInOut * this.openDirection) >= 0 ? 1 : -1;
    const targetRotation = this.openAngle;
    const signedTarget = targetRotation * directionSign;

    this.closedRotationY = this.hinge?.rotation?.y ?? this.closedRotationY;
    this.closedQuaternion.copy(this.hinge?.quaternion ?? this.closedQuaternion);
    const deltaQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), signedTarget);
    this.openQuaternion.copy(this.closedQuaternion).multiply(deltaQuat);

    this.openedRotation = this.closedRotationY + signedTarget;

    console.log(`[Door ${this.id}] Opening: targetRotation=${targetRotation}, openInOut=${this.openInOut}, openDirection=${this.openDirection}, will rotate to ${this.openedRotation}`);

    if (this.audioElement) {
      try {
        this.audioElement.currentTime = 0;
        this.audioElement.play().catch((e) => console.warn('Door sound play failed:', e));
      } catch (e) {
        console.warn('Door sound play error:', e);
      }
    }

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / this.openDuration, 1);

      this.hinge.quaternion.slerpQuaternions(this.closedQuaternion, this.openQuaternion, progress);
      this.currentRotation = signedTarget * progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
        this.isOpen = true;
        this.currentRotation = signedTarget;
        this.hinge.quaternion.copy(this.openQuaternion);
        console.log(`[Door ${this.id}] Opened. currentRotation=${this.currentRotation}, hinge.rotation.y=${this.hinge.rotation.y}`);
        if (onComplete) onComplete();
      }
    };

    animate();
  }

  closeDoor(onComplete) {
    if (this.isAnimating || !this.isOpen) {
      if (onComplete) onComplete();
      return;
    }

    this.isAnimating = true;
    const startTime = Date.now();
    const directionSign = (this.openInOut * this.openDirection) >= 0 ? 1 : -1;
    const signedTarget = this.openAngle * directionSign;

    const closedY = this.closedRotationY;
    const startQuaternion = this.hinge.quaternion.clone();
    this.openQuaternion.copy(startQuaternion);

    console.log(`[Door ${this.id}] Closing from rotation ${this.hinge.rotation.y} to ${closedY}.`);

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / this.openDuration, 1);

      this.hinge.quaternion.slerpQuaternions(startQuaternion, this.closedQuaternion, progress);
      this.currentRotation = signedTarget * (1 - progress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
        this.isOpen = false;
        this.currentRotation = 0;
        this.openedRotation = closedY;
        this.hinge.quaternion.copy(this.closedQuaternion);
        console.log(`[Door ${this.id}] Closed. currentRotation=${this.currentRotation}, hinge.rotation.y=${this.hinge.rotation.y}`);
        if (onComplete) onComplete();
      }
    };

    animate();
  }

  toggleDoor() {
    if (this.isOpen) {
      this.closeDoor();
    } else {
      this.openDoor();
    }
  }

  getDoorCenterPosition() {
    const worldPos = new THREE.Vector3();
    if (this.doorMesh) {
      try {
        const bounds = new THREE.Box3().setFromObject(this.doorMesh);
        if (!bounds.isEmpty()) {
          bounds.getCenter(worldPos);
          return worldPos;
        }
      } catch (e) {}
    }
    if (this.hinge) {
      this.hinge.getWorldPosition(worldPos);
    }
    return worldPos;
  }

  isPlayerNear(playerPos, proximityDistance = 3) {
    const doorCenter = this.getDoorCenterPosition();
    const distance = playerPos.distanceTo(doorCenter);
    return distance <= proximityDistance;
  }

  takeDamage(amount) {
    return false;
  }

  dispose() {
    try {
      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement.src = '';
        this.audioElement = null;
      }
    } catch (e) {}
    try {
      if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
    } catch (e) {}
  }
}
