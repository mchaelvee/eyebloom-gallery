import * as THREE from 'three';
import { config } from './config.js';

// Yaw/pitch FPS camera with shared movement vector.
// Desktop: pointer lock + WASD. Mobile: virtual joystick + touch-drag look.

export function isTouchDevice() {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

function inAnyRegion(x, z, regions) {
  for (const r of regions) {
    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return true;
  }
  return false;
}

export function createControls({ camera, domElement, getRegions, onClickInteractable }) {
  const yawObject = new THREE.Object3D();
  const pitchObject = new THREE.Object3D();
  yawObject.add(pitchObject);
  pitchObject.add(camera);

  yawObject.position.set(0, config.player.eyeHeight, config.player.startZ);

  const move = { forward: 0, right: 0 };
  const keys = new Set();
  let sprint = false;
  let locked = false;
  let active = false;
  const lockElement = document.body;

  // Pointer lock (desktop)
  function requestLock() {
    try {
      const lockRequest = lockElement.requestPointerLock?.();
      lockRequest?.catch?.(() => {});
    } catch {
      // Embedded preview browsers can reject pointer lock even after a click.
    }
  }

  function onLockChange() {
    locked = document.pointerLockElement === lockElement;
    if (!locked) {
      keys.clear();
      sprint = false;
    }
  }
  document.addEventListener('pointerlockchange', onLockChange);

  function applyLookDelta(dx, dy) {
    yawObject.rotation.y -= dx * config.player.lookSensitivity;
    pitchObject.rotation.x -= dy * config.player.lookSensitivity;
    pitchObject.rotation.x = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, pitchObject.rotation.x));
  }

  function onMouseMove(e) {
    if (!locked) return;
    applyLookDelta(e.movementX, e.movementY);
  }
  document.addEventListener('mousemove', onMouseMove);

  function onKeyDown(e) {
    if (!active) return;
    if (!isTouchDevice() && !locked) return;
    keys.add(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') sprint = true;
  }
  function onKeyUp(e) {
    keys.delete(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') sprint = false;
  }
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  function readKeys() {
    let f = 0, r = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp'))    f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown'))  f -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) r += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft'))  r -= 1;
    return { f, r };
  }

  // Click: unlocked canvas clicks capture the camera; locked clicks interact.
  function onDocumentClick(e) {
    if (!active) return;
    if (isTouchDevice()) return;

    if (!locked) {
      if (e.target === domElement) requestLock();
      return;
    }

    onClickInteractable?.();
  }
  document.addEventListener('click', onDocumentClick);

  // ---- Touch (mobile) ----
  const joystickEl = document.getElementById('joystick');
  const knob = document.getElementById('joystick-knob');
  const base = document.getElementById('joystick-base');

  let joyId = null;
  let joyOrigin = { x: 0, y: 0 };
  let joyVec = { x: 0, y: 0 };

  function onJoyStart(e) {
    if (joyId !== null) return;
    const t = e.changedTouches[0];
    joyId = t.identifier;
    const rect = base.getBoundingClientRect();
    joyOrigin = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    e.preventDefault();
  }
  function onJoyMove(e) {
    if (joyId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== joyId) continue;
      const dx = t.clientX - joyOrigin.x;
      const dy = t.clientY - joyOrigin.y;
      const max = 44;
      const len = Math.hypot(dx, dy);
      const cl = len > max ? max / len : 1;
      const kx = dx * cl, ky = dy * cl;
      knob.style.transform = `translate(${kx}px, ${ky}px)`;
      joyVec = { x: kx / max, y: ky / max };
      e.preventDefault();
    }
  }
  function onJoyEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyId) continue;
      joyId = null;
      joyVec = { x: 0, y: 0 };
      knob.style.transform = '';
    }
  }
  if (joystickEl) {
    joystickEl.addEventListener('touchstart', onJoyStart, { passive: false });
    joystickEl.addEventListener('touchmove', onJoyMove, { passive: false });
    joystickEl.addEventListener('touchend', onJoyEnd);
    joystickEl.addEventListener('touchcancel', onJoyEnd);
  }

  // Touch-drag look on the canvas (anywhere not in joystick zone)
  let lookId = null;
  let lastLook = { x: 0, y: 0 };
  let touchMoved = 0;

  function isInJoystick(x, y) {
    if (!joystickEl) return false;
    const r = joystickEl.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function onTouchStart(e) {
    if (!active) return;
    for (const t of e.changedTouches) {
      if (lookId !== null) break;
      if (isInJoystick(t.clientX, t.clientY)) continue;
      lookId = t.identifier;
      lastLook = { x: t.clientX, y: t.clientY };
      touchMoved = 0;
    }
  }
  function onTouchMove(e) {
    if (lookId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== lookId) continue;
      const dx = t.clientX - lastLook.x;
      const dy = t.clientY - lastLook.y;
      lastLook = { x: t.clientX, y: t.clientY };
      touchMoved += Math.abs(dx) + Math.abs(dy);
      yawObject.rotation.y -= dx * config.player.touchLookSensitivity;
      pitchObject.rotation.x -= dy * config.player.touchLookSensitivity;
      pitchObject.rotation.x = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, pitchObject.rotation.x));
      e.preventDefault();
    }
  }
  function onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== lookId) continue;
      lookId = null;
      // Treat as tap if minimal motion -> trigger interaction at center.
      if (touchMoved < 8 && active) {
        onClickInteractable?.();
      }
    }
  }
  domElement.addEventListener('touchstart', onTouchStart, { passive: false });
  domElement.addEventListener('touchmove', onTouchMove, { passive: false });
  domElement.addEventListener('touchend', onTouchEnd);
  domElement.addEventListener('touchcancel', onTouchEnd);

  // ---- API ----
  function start({ requestPointerLock = true } = {}) {
    active = true;
    if (isTouchDevice()) {
      joystickEl?.classList.remove('hidden');
    } else if (requestPointerLock) {
      requestLock();
    }
  }

  function stop() {
    active = false;
    keys.clear();
    sprint = false;
    joyVec = { x: 0, y: 0 };
    if (document.pointerLockElement === lockElement) {
      document.exitPointerLock();
    }
    joystickEl?.classList.add('hidden');
  }

  function update(dt) {
    if (!active) return;
    if (!isTouchDevice() && !locked) return;

    const { f: kf, r: kr } = readKeys();
    let f = kf - joyVec.y; // joystick up (-y) means forward
    let r = kr + joyVec.x;

    const len = Math.hypot(f, r);
    if (len > 1) { f /= len; r /= len; }

    const speed = sprint ? config.player.sprintSpeed : config.player.walkSpeed;
    if (f !== 0 || r !== 0) {
      const yaw = yawObject.rotation.y;
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      // forward = (-sin, 0, -cos), right = (cos, 0, -sin)
      const mvX = (-sin * f + cos * r) * speed * dt;
      const mvZ = (-cos * f - sin * r) * speed * dt;

      const regions = getRegions();
      // Slide along walls: try X then Z independently.
      const px = yawObject.position.x;
      const pz = yawObject.position.z;
      const nx = px + mvX;
      if (inAnyRegion(nx, pz, regions)) yawObject.position.x = nx;
      const nz = pz + mvZ;
      if (inAnyRegion(yawObject.position.x, nz, regions)) yawObject.position.z = nz;
    }
  }

  return {
    object: yawObject,
    start, stop, update,
    get active() { return active; },
    get isLocked() { return locked; },
  };
}
