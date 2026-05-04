import * as THREE from 'three';
import { config } from './config.js';
import { makeBakedCeilingMaterial, makeBakedFloorMaterial, makeBakedWallMaterial } from './baked.js';
import { makeLightCardMaterial, makeShadowCardMaterial, makeSectionSignTexture } from './lightfx.js';

let texLoader = new THREE.TextureLoader();
texLoader.crossOrigin = 'anonymous';
const sourceTextureCache = new Map();
const ANISO = config.performance?.anisotropy ?? 4;

export function setWorldLoadingManager(manager) {
  texLoader = new THREE.TextureLoader(manager);
  texLoader.crossOrigin = 'anonymous';
  sourceTextureCache.clear();
}

function getSourceEntry(url, srgb) {
  const key = `${url}:${srgb ? 'srgb' : 'linear'}`;
  if (sourceTextureCache.has(key)) return sourceTextureCache.get(key);

  const entry = { tex: null, ready: false, pending: [] };
  const tex = texLoader.load(url, () => {
    entry.ready = true;
    for (const clone of entry.pending) clone.needsUpdate = true;
    entry.pending.length = 0;
  });
  tex.anisotropy = ANISO;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  entry.tex = tex;
  sourceTextureCache.set(key, entry);
  return entry;
}

function makeRepeatTexture(spec, srgb, repeat, channel = 'diff') {
  if (!spec || !spec[channel]) return null;
  const entry = getSourceEntry(spec[channel], srgb);
  const t = entry.tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = ANISO;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (entry.ready) t.needsUpdate = true;
  else entry.pending.push(t);
  return t;
}

// Build a SINGLE shared material per (spec, tint, roughness). UVs are scaled
// per-plane via geometry instead of cloning textures. This collapses
// hundreds of unique materials down to ~2–3 (gallery wall, tattoo wall, floor),
// dramatically reducing draw-call count and shader recompiles.
const sharedMatCache = new Map();
function getSharedTexturedMaterial(spec, { tint, roughness, key }) {
  if (sharedMatCache.has(key)) return sharedMatCache.get(key);
  const perf = config.performance ?? {};
  let mat;
  if (!spec) {
    mat = new THREE.MeshStandardMaterial({ color: tint, roughness, metalness: 0 });
  } else if (perf.fastRoomMaterials) {
    // Use 1m repeat baseline; geometry UVs handle scaling
    mat = new THREE.MeshBasicMaterial({
      color: tint,
      map: makeRepeatTexture(spec, true, [1, 1], 'diff'),
      fog: true,
    });
  } else {
    const useHigh = perf.useHighCostMaterialMaps;
    mat = new THREE.MeshStandardMaterial({
      color: tint,
      map:          makeRepeatTexture(spec, true, [1, 1], 'diff'),
      normalMap:    useHigh ? makeRepeatTexture(spec, false, [1, 1], 'nor')   : null,
      roughnessMap: useHigh ? makeRepeatTexture(spec, false, [1, 1], 'rough') : null,
      roughness,
      metalness: 0,
    });
  }
  sharedMatCache.set(key, mat);
  return mat;
}

// Build a Plane mesh with UVs pre-scaled to (sx*repeatPerMeter, sy*repeatPerMeter).
// All planes share the same material instance.
function texturedPlane(sx, sy, mat, repeatPerMeter = [1, 1]) {
  const geom = new THREE.PlaneGeometry(sx, sy);
  const uv = geom.attributes.uv;
  const rx = sx * repeatPerMeter[0];
  const ry = sy * repeatPerMeter[1];
  if (rx !== 1 || ry !== 1) {
    for (let i = 0; i < uv.count; i++) {
      uv.setX(i, uv.getX(i) * rx);
      uv.setY(i, uv.getY(i) * ry);
    }
    uv.needsUpdate = true;
  }
  return new THREE.Mesh(geom, mat);
}

function colorToCss(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export function buildWorld(scene) {
  const T = config.theme;
  const W = config.world;

  scene.background = new THREE.Color(T.backgroundColor);
  scene.fog = new THREE.Fog(T.fogColor, T.fogNear, T.fogFar);

  const group = new THREE.Group();
  group.name = 'world';

  const gw = W.galleryWidth;
  const gl = W.galleryLength;
  const tw = W.tattooWidth;
  const tl = W.tattooLength;
  const h  = W.height;
  const dw = W.doorWidth;
  const dh = W.doorHeight;
  const arch = W.arch;

  // Asymmetric inner split: paintings section is at the front (entry side, +z).
  const paintingsLength = W.paintingsLength ?? gl / 2;
  const drawingsLength  = gl - paintingsLength;
  const archZ = gl/2 - paintingsLength;       // z of the inner archway
  const paintingsCenterZ = (archZ + gl/2) / 2;
  const drawingsCenterZ  = (archZ - gl/2) / 2;

  // Layout: gallery z ∈ [-gl/2, gl/2]; tattoo z ∈ [-gl/2 - tl, -gl/2]; divider at z = -gl/2.
  const dividerZ = -gl/2;
  const tattooCenterZ = dividerZ - tl/2;

  const perf = config.performance ?? {};
  const wallSpec  = T.textures?.wall;
  const floorSpec = T.textures?.floor;

  // ----- Shared materials (one per surface type, regardless of plane size) -----
  const galleryWallMaterial = perf.bakedRoomMaterials
    ? makeBakedWallMaterial({ width: 5, height: h, tint: colorToCss(T.wallColor), room: 'gallery' })
    : getSharedTexturedMaterial(wallSpec, {
      tint: T.wallColor, roughness: 0.95, key: `wall:gallery:${T.wallColor}`,
    });
  const tattooWallMaterial = perf.bakedRoomMaterials
    ? makeBakedWallMaterial({ width: 5, height: h, tint: colorToCss(config.tattoo.wallColor), room: 'tattoo' })
    : getSharedTexturedMaterial(wallSpec, {
      tint: config.tattoo.wallColor, roughness: 0.92, key: `wall:tattoo:${config.tattoo.wallColor}`,
    });
  const wallRpm = wallSpec?.repeatPerMeter ?? [1, 1];

  // Helpers — one shared material, UVs scaled per-plane.
  function galleryWallPlane(sx, sy) {
    return texturedPlane(sx, sy, galleryWallMaterial, wallRpm);
  }
  function tattooWallPlane(sx, sy) {
    return texturedPlane(sx, sy, tattooWallMaterial, wallRpm);
  }

  // ----- Floor (continuous, both rooms) -----
  const totalLengthZ = gl + tl;
  const floorMaterial = perf.bakedRoomMaterials
    ? makeBakedFloorMaterial({ width: gw, length: totalLengthZ })
    : getSharedTexturedMaterial(floorSpec, {
      tint: T.floorTint, roughness: 0.62, key: `floor:${T.floorTint}`,
    });
  const floor = texturedPlane(gw, totalLengthZ, floorMaterial, floorSpec?.repeatPerMeter ?? [1, 1]);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -tl / 2;
  group.add(floor);

  // ----- Ceiling -----
  const ceilMat = perf.bakedRoomMaterials
    ? makeBakedCeilingMaterial({ width: gw, length: totalLengthZ })
    : new THREE.MeshStandardMaterial({
      color: T.ceilingColor, roughness: 0.96, metalness: 0,
    });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(gw, totalLengthZ), ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, h, -tl / 2);
  group.add(ceiling);

  // ----- Gallery long walls -----
  const leftG = galleryWallPlane(gl, h);
  leftG.position.set(-gw/2, h/2, 0);
  leftG.rotation.y = Math.PI / 2;
  group.add(leftG);

  const rightG = galleryWallPlane(gl, h);
  rightG.position.set(gw/2, h/2, 0);
  rightG.rotation.y = -Math.PI / 2;
  group.add(rightG);

  // ----- Gallery front (entry) wall -----
  const frontG = galleryWallPlane(gw, h);
  frontG.position.set(0, h/2, gl/2);
  frontG.rotation.y = Math.PI;
  group.add(frontG);

  // ----- Inner archway (z = archZ; split between sections) -----
  const archPanelW   = arch.panelWidth;
  const archOpening  = arch.openingWidth;
  const archHeaderH  = arch.headerHeight;
  const archHeaderY  = h - archHeaderH;
  const archGapToWall = (gw - (2 * archPanelW + archOpening)) / 2;

  function makeArchPanel(xCenter, faceForward) {
    const m = galleryWallPlane(archPanelW, h);
    m.position.set(xCenter, h/2, archZ + (faceForward ? 0.005 : -0.005));
    m.rotation.y = faceForward ? 0 : Math.PI;
    return m;
  }
  const leftPanelX  = -(archOpening/2 + archPanelW/2);
  const rightPanelX =  (archOpening/2 + archPanelW/2);

  group.add(makeArchPanel(leftPanelX,  true));
  group.add(makeArchPanel(leftPanelX,  false));
  group.add(makeArchPanel(rightPanelX, true));
  group.add(makeArchPanel(rightPanelX, false));

  if (archGapToWall > 0.01) {
    const fillerL = galleryWallPlane(archGapToWall, h);
    fillerL.position.set(-(archOpening/2 + archPanelW + archGapToWall/2), h/2, archZ + 0.005);
    group.add(fillerL);
    const fillerLb = galleryWallPlane(archGapToWall, h);
    fillerLb.position.set(-(archOpening/2 + archPanelW + archGapToWall/2), h/2, archZ - 0.005);
    fillerLb.rotation.y = Math.PI;
    group.add(fillerLb);

    const fillerR = galleryWallPlane(archGapToWall, h);
    fillerR.position.set( (archOpening/2 + archPanelW + archGapToWall/2), h/2, archZ + 0.005);
    group.add(fillerR);
    const fillerRb = galleryWallPlane(archGapToWall, h);
    fillerRb.position.set( (archOpening/2 + archPanelW + archGapToWall/2), h/2, archZ - 0.005);
    fillerRb.rotation.y = Math.PI;
    group.add(fillerRb);
  }

  const headerMat = new THREE.MeshStandardMaterial({
    color: 0x1a120c, roughness: 0.55, metalness: 0.18,
  });
  const headerBox = new THREE.Mesh(
    new THREE.BoxGeometry(archOpening + 0.4, archHeaderH, 0.16),
    headerMat,
  );
  headerBox.position.set(0, archHeaderY + archHeaderH/2, archZ);
  group.add(headerBox);

  function makeSectionSign(label, faceForward) {
    const tex = makeSectionSignTexture(label);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, toneMapped: false,
    });
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(archOpening * 0.78, archHeaderH * 0.62),
      mat,
    );
    sign.position.set(0, archHeaderY + archHeaderH/2, archZ + (faceForward ? 0.085 : -0.085));
    sign.rotation.y = faceForward ? 0 : Math.PI;
    return sign;
  }
  group.add(makeSectionSign(config.sections.paintings.label, true));
  group.add(makeSectionSign(config.sections.drawings.label,  false));

  const archUplightMat = makeLightCardMaterial({
    color: 0xffc98b, opacity: 0.18, softness: 'wide',
  });
  for (const dz of [0.09, -0.09]) {
    const up = new THREE.Mesh(new THREE.PlaneGeometry(archOpening + 0.6, 1.2), archUplightMat);
    up.position.set(0, archHeaderY - 0.05, archZ + dz);
    up.rotation.y = dz < 0 ? Math.PI : 0;
    group.add(up);
  }

  // ----- Divider wall (gallery ↔ tattoo room) with doorway -----
  const sidePanelW = (gw - dw) / 2;

  const dividerLeft = galleryWallPlane(sidePanelW, h);
  dividerLeft.position.set(-(dw/2 + sidePanelW/2), h/2, dividerZ);
  group.add(dividerLeft);

  const dividerRight = galleryWallPlane(sidePanelW, h);
  dividerRight.position.set(dw/2 + sidePanelW/2, h/2, dividerZ);
  group.add(dividerRight);

  const headerH = h - dh;
  const dividerHeader = galleryWallPlane(dw, headerH);
  dividerHeader.position.set(0, dh + headerH/2, dividerZ);
  group.add(dividerHeader);

  const dividerLeftBack = tattooWallPlane(sidePanelW, h);
  dividerLeftBack.position.set(-(dw/2 + sidePanelW/2), h/2, dividerZ - 0.001);
  dividerLeftBack.rotation.y = Math.PI;
  group.add(dividerLeftBack);

  const dividerRightBack = tattooWallPlane(sidePanelW, h);
  dividerRightBack.position.set(dw/2 + sidePanelW/2, h/2, dividerZ - 0.001);
  dividerRightBack.rotation.y = Math.PI;
  group.add(dividerRightBack);

  const dividerHeaderBack = tattooWallPlane(dw, headerH);
  dividerHeaderBack.position.set(0, dh + headerH/2, dividerZ - 0.001);
  dividerHeaderBack.rotation.y = Math.PI;
  group.add(dividerHeaderBack);

  // ----- Tattoo room walls -----
  const leftT = tattooWallPlane(tl, h);
  leftT.position.set(-tw/2, h/2, tattooCenterZ);
  leftT.rotation.y = Math.PI / 2;
  group.add(leftT);

  const rightT = tattooWallPlane(tl, h);
  rightT.position.set(tw/2, h/2, tattooCenterZ);
  rightT.rotation.y = -Math.PI / 2;
  group.add(rightT);

  const backT = tattooWallPlane(tw, h);
  backT.position.set(0, h/2, dividerZ - tl);
  group.add(backT);

  // ----- Skirting (dark trim) -----
  const skirtMat = new THREE.MeshStandardMaterial({
    color: T.skirtingColor, roughness: 0.6, metalness: 0,
  });
  const sH = 0.14;
  const makeSkirt = (sx, sz, px, pz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sH, sz), skirtMat);
    m.position.set(px, sH/2, pz);
    return m;
  };
  group.add(makeSkirt(0.05, gl, -gw/2 + 0.025, 0));
  group.add(makeSkirt(0.05, gl,  gw/2 - 0.025, 0));
  group.add(makeSkirt(gw, 0.05, 0, gl/2 - 0.025));
  group.add(makeSkirt(archPanelW, 0.05, leftPanelX,  archZ + 0.025));
  group.add(makeSkirt(archPanelW, 0.05, rightPanelX, archZ + 0.025));
  group.add(makeSkirt(archPanelW, 0.05, leftPanelX,  archZ - 0.025));
  group.add(makeSkirt(archPanelW, 0.05, rightPanelX, archZ - 0.025));
  group.add(makeSkirt(sidePanelW, 0.05, -(dw/2 + sidePanelW/2), dividerZ + 0.025));
  group.add(makeSkirt(sidePanelW, 0.05,  dw/2 + sidePanelW/2,  dividerZ + 0.025));
  group.add(makeSkirt(sidePanelW, 0.05, -(dw/2 + sidePanelW/2), dividerZ - 0.025));
  group.add(makeSkirt(sidePanelW, 0.05,  dw/2 + sidePanelW/2,  dividerZ - 0.025));
  group.add(makeSkirt(0.05, tl, -tw/2 + 0.025, tattooCenterZ));
  group.add(makeSkirt(0.05, tl,  tw/2 - 0.025, tattooCenterZ));
  group.add(makeSkirt(tw, 0.05, 0, dividerZ - tl + 0.025));

  // ===== Lighting =====

  group.add(new THREE.AmbientLight(T.ambientColor, T.ambientIntensity));

  const hemi = new THREE.HemisphereLight(T.hemiSky, T.hemiGround, T.hemiIntensity);
  hemi.position.set(0, h, 0);
  group.add(hemi);

  // ----- Gallery ceiling: recessed downlights (cosmetic + sparse fill) -----
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0x070504, roughness: 0.55, metalness: 0.25,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x050403, roughness: 0.5, metalness: 0.32,
  });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: T.diskColor,
    emissiveIntensity: 1.6,
    roughness: 0.4,
    metalness: 0.0,
  });
  const benchShadowMat = makeShadowCardMaterial({ opacity: 0.18, softness: 'wide' });

  const track = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.035, gl * 0.96),
    railMat,
  );
  track.position.set(0, h - 0.032, 0);
  group.add(track);

  // Place ceiling fixtures spaced ~6m apart, skipping near the inner arch.
  // Each fixture is just 2 meshes (trim + emissive lens). Bloom adds the halo.
  const fixtureSpacing = 6.0;
  const fixtureCount = Math.max(4, Math.round(gl / fixtureSpacing));
  const archZoneHalf = arch.headerHeight + 0.5;
  const fillCount = perf.ceilingFillSpotCount ?? 2;
  const fillStride = Math.max(1, Math.floor(fixtureCount / fillCount));

  for (let i = 0; i < fixtureCount; i++) {
    const t01 = (i + 0.5) / fixtureCount;
    const z = -gl/2 + t01 * gl;
    if (Math.abs(z - archZ) < archZoneHalf) continue;

    const trim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.035, 20),
      fixtureMat,
    );
    trim.position.set(0, h - 0.018, z);
    group.add(trim);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.145, 20), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, h - 0.039, z);
    group.add(lens);

    // Real fill SpotLight, capped to ceilingFillSpotCount.
    if (i % fillStride === Math.floor(fillStride / 2)) {
      const sp = new THREE.SpotLight(0xffe1b8, 1.6, 7.5, Math.PI/3.6, 0.6, 1.2);
      sp.position.set(0, h - 0.05, z);
      const tgt = new THREE.Object3D();
      tgt.position.set(0, 0, z);
      group.add(tgt);
      sp.target = tgt;
      group.add(sp);
    }
  }

  // ----- Gallery benches (one per section) -----
  const benchMat = new THREE.MeshStandardMaterial({
    color: 0x140d08, roughness: 0.5, metalness: 0.1,
  });
  for (const z of [paintingsCenterZ, drawingsCenterZ]) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.45), benchMat);
    seat.position.y = 0.42;
    bench.add(seat);
    for (const sx of [-0.75, 0.75]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.42), benchMat);
      leg.position.set(sx, 0.21, 0);
      bench.add(leg);
    }
    bench.position.set(0, 0, z);
    group.add(bench);

    const benchShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), benchShadowMat);
    benchShadow.rotation.x = -Math.PI / 2;
    benchShadow.position.set(0, 0.009, z);
    benchShadow.scale.set(2.05, 0.72, 1);
    group.add(benchShadow);
  }

  const headerStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(dw, 0.04),
    new THREE.MeshBasicMaterial({ color: 0xff6b34, toneMapped: false }),
  );
  headerStrip.position.set(0, dh - 0.02, dividerZ + 0.005);
  group.add(headerStrip);

  scene.add(group);

  // ===== Walkable regions (multi-rect collision) =====
  const r = config.player.radius;
  const regions = [
    // Gallery — paintings (front of arch, +z side)
    { minX: -gw/2 + r, maxX: gw/2 - r, minZ: archZ + r,    maxZ: gl/2 - r },
    // Gallery — drawings (back of arch, -z side)
    { minX: -gw/2 + r, maxX: gw/2 - r, minZ: -gl/2 + r,    maxZ: archZ - r },
    // Inner archway corridor
    { minX: -archOpening/2 + r, maxX: archOpening/2 - r, minZ: archZ - r - 0.06, maxZ: archZ + r + 0.06 },
    // Tattoo room
    { minX: -tw/2 + r, maxX: tw/2 - r, minZ: -gl/2 - tl + r, maxZ: -gl/2 - r },
    // Doorway corridor between gallery and tattoo
    { minX: -dw/2 + r, maxX: dw/2 - r, minZ: -gl/2 - r - 0.01, maxZ: -gl/2 + r + 0.01 },
  ];

  return {
    group,
    regions,
    layout: {
      gallery: {
        width: gw, length: gl, centerZ: 0,
        sections: {
          paintings: { centerZ: paintingsCenterZ, length: paintingsLength },
          drawings:  { centerZ: drawingsCenterZ,  length: drawingsLength  },
        },
      },
      tattoo:  { width: tw, length: tl, centerZ: tattooCenterZ },
      door:    { width: dw, height: dh, z: dividerZ },
      arch:    { z: archZ, opening: archOpening, headerHeight: archHeaderH, headerY: archHeaderY },
      height: h,
    },
  };
}
