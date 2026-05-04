import * as THREE from 'three';
import { config } from './config.js';
import { makePlaqueMaterial } from './lightfx.js';

let loader = new THREE.TextureLoader();

export function setArtLoadingManager(manager) {
  loader = new THREE.TextureLoader(manager);
}

// Single shared emissive material used as the picture-light bar above each piece.
// Bloom catches the emissive so it reads as a real warm glow.
const pictureLightLensMat = new THREE.MeshStandardMaterial({
  color: 0x000000,
  emissive: 0xffc982,
  emissiveIntensity: 2.4,
  roughness: 0.4,
});

const ART_ANISO = config.performance?.anisotropy ?? 4;
function loadTexture(url) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = ART_ANISO;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        resolve(tex);
      },
      undefined,
      (err) => reject(err),
    );
  });
}

function getRoomKey(item) {
  return item.room || 'gallery';
}

// Auto-distribute pieces across the long walls of their room/section when no
// explicit placement is provided.
function autoPlacements(items) {
  const buckets = new Map();
  for (const it of items) {
    if (it.placement) continue;
    const room = getRoomKey(it);
    const section = room === 'gallery' ? (it.section || 'paintings') : '__default';
    const key = `${room}::${section}`;
    if (!buckets.has(key)) buckets.set(key, { left: [], right: [] });
    const b = buckets.get(key);
    (b.left.length <= b.right.length ? b.left : b.right).push(it);
  }
  for (const b of buckets.values()) {
    for (const wall of ['left', 'right']) {
      const arr = b[wall];
      const n = arr.length;
      arr.forEach((it, i) => {
        const t01 = n === 1 ? 0.5 : (i + 0.5) / n;
        // along ∈ [-0.82, 0.82] within the section/room
        const along = (t01 - 0.5) * 2 * 0.82;
        it.placement = { wall, along };
      });
    }
  }
}

export async function loadArtManifest(manager = null) {
  const url = './art/manifest.json';
  manager?.itemStart(url);
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error('failed to load art manifest');
    const manifest = await res.json();
    manager?.itemEnd(url);
    return manifest;
  } catch (err) {
    manager?.itemError(url);
    manager?.itemEnd(url);
    throw err;
  }
}

export async function loadArt(scene, layout, { manifest = null, manager = null } = {}) {
  if (!manifest) manifest = await loadArtManifest(manager);

  const items = manifest.pieces || [];
  autoPlacements(items);

  const group = new THREE.Group();
  group.name = 'art';
  const interactables = [];

  // Counts for spotlight budget
  const perf = config.performance ?? {};
  const isTouch = typeof window !== 'undefined' &&
    window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
  let spotBudget = perf.maxSpotLights ?? 24;
  if (isTouch) spotBudget = Math.floor(spotBudget / (perf.touchSpotLightDivisor ?? 3));
  const wantPerPieceSpot = !!perf.perPieceSpotLight;

  const nodes = await Promise.all(items.map(async (item, idx) => {
    try {
      // Decide whether this piece gets a real spotlight (budget-permitting)
      const spotLightAllowed = wantPerPieceSpot && spotBudget > 0;
      if (spotLightAllowed) spotBudget--;
      return await buildPiece(item, layout, { spotLightAllowed });
    } catch (e) {
      console.warn('skipping piece', item.id, e);
      return null;
    }
  }));

  for (const node of nodes) {
    if (!node) continue;
    group.add(node.root);
    interactables.push(node.target);
  }

  scene.add(group);
  return { group, interactables, manifest };
}

async function buildPiece(item, layout, { spotLightAllowed = false } = {}) {
  const A = config.art;
  const T = config.theme;
  const roomKey = getRoomKey(item);
  const room = layout[roomKey];
  if (!room) throw new Error(`unknown room: ${roomKey}`);

  // Choose section anchor in gallery; tattoo uses room directly.
  let anchorCenterZ = room.centerZ;
  let anchorLength  = room.length;
  if (roomKey === 'gallery' && room.sections) {
    const sec = room.sections[item.section || 'paintings'];
    if (sec) {
      anchorCenterZ = sec.centerZ;
      anchorLength  = sec.length;
    }
  }

  const tex = await loadTexture(item.src);
  const img = tex.image;
  const aspect = (img && img.width && img.height) ? img.width / img.height : 1;

  const sizeScale = item.scale ?? 1;
  let w = A.maxWidth * sizeScale;
  let h = w / aspect;
  if (h > A.maxHeight * sizeScale) {
    h = A.maxHeight * sizeScale;
    w = h * aspect;
  }

  const root = new THREE.Group();
  root.name = `piece-${item.id}`;

  const frameW = w + A.frameInset * 2 + A.matInset * 2;
  const frameH = h + A.frameInset * 2 + A.matInset * 2;

  // Frame — single Standard material that responds to room lighting
  const frameColor = item.frameColor ?? 0x1a1612;
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(frameW, frameH, A.frameDepth),
    new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.55, metalness: 0.12 }),
  );
  frame.position.z = A.frameDepth / 2;
  root.add(frame);

  // Mat (Basic = fast, no PBR cost)
  const matColor = item.matColor ?? 0xf6f1e7;
  const matMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w + A.matInset * 2, h + A.matInset * 2),
    new THREE.MeshBasicMaterial({ color: matColor }),
  );
  matMesh.position.z = A.frameDepth + 0.001;
  root.add(matMesh);

  // Canvas — Basic material (always bright, no fragment-shader PBR cost).
  // Paintings end up looking flat-lit, which is actually correct for artwork
  // displayed under gallery lighting.
  const canvasMat = new THREE.MeshBasicMaterial({ map: tex });
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), canvasMat);
  canvas.position.z = A.frameDepth + 0.002;
  canvas.userData.piece = item;
  root.add(canvas);

  // Compact picture light: single emissive bar above the frame.
  const lightLength = Math.min(Math.max(frameW * 0.36, 0.30), 0.62);
  const pictureLight = new THREE.Mesh(
    new THREE.BoxGeometry(lightLength, 0.04, 0.05),
    pictureLightLensMat,
  );
  pictureLight.position.set(0, frameH / 2 + 0.10, A.frameDepth + 0.040);
  root.add(pictureLight);

  // Real SpotLight pointing down at the canvas (one per piece, no shadows)
  if (spotLightAllowed) {
    const intensity = roomKey === 'tattoo'
      ? 3.6
      : (T.pictureLightIntensity ?? 7.5);
    const color = roomKey === 'tattoo' ? 0xffe0c0 : (T.pictureLightColor ?? 0xffd9a8);
    const spot = new THREE.SpotLight(
      color,
      intensity,
      3.2,                  // distance
      Math.PI / 5.2,        // angle
      0.62,                 // penumbra
      1.6,                  // decay
    );
    spot.position.set(0, frameH / 2 + 0.10, A.frameDepth + 0.06);
    const tgt = new THREE.Object3D();
    tgt.position.set(0, 0, A.frameDepth);
    root.add(tgt);
    spot.target = tgt;
    root.add(spot);
  }

  // Plaque (title + medium / year)
  const plaqueW = Math.min(0.9, Math.max(0.62, frameW * 0.5));
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(plaqueW, plaqueW * 0.25),
    makePlaqueMaterial(item, { dark: roomKey === 'tattoo' }),
  );
  plaque.position.set(0, -frameH / 2 - 0.20, A.frameDepth + 0.018);
  plaque.renderOrder = 5;
  root.add(plaque);

  // Position + orient by wall (relative to section/room anchor)
  const wall = item.placement.wall;
  const along = item.placement.along ?? 0;
  const y = item.hangHeight ?? A.hangHeight;
  const cz = anchorCenterZ;
  const halfLen = anchorLength / 2;

  if (wall === 'left') {
    root.position.set(-room.width/2 + 0.001, y, cz + along * halfLen);
    root.rotation.y = Math.PI / 2;
  } else if (wall === 'right') {
    root.position.set(room.width/2 - 0.001, y, cz + along * halfLen);
    root.rotation.y = -Math.PI / 2;
  } else if (wall === 'back') {
    root.position.set(along * (room.width/2), y, cz - halfLen + 0.001);
    root.rotation.y = 0;
  } else if (wall === 'front') {
    root.position.set(along * (room.width/2), y, cz + halfLen - 0.001);
    root.rotation.y = Math.PI;
  }

  return { root, target: canvas };
}
