import * as THREE from 'three';
import { config } from './config.js';
import { makeLightCardMaterial, makeShadowCardMaterial } from './lightfx.js';

// Adds tattoo studio props inside the existing world. Reads layout from buildWorld.
export function buildTattooRoom(scene, layout) {
  const T = config.tattoo;
  const { tattoo: room, height: h } = layout;

  const group = new THREE.Group();
  group.name = 'tattoo';

  const cz = room.centerZ;

  // ----- Materials -----
  const padMat   = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.85, metalness: 0.05 });
  const baseMat  = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.45, metalness: 0.6 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xbfc4cc, roughness: 0.25, metalness: 0.85 });
  const inkBottleMat = new THREE.MeshStandardMaterial({ color: 0x1a1010, roughness: 0.4, metalness: 0.1 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.6, metalness: 0.05 });
  const warmWorkGlowMat = makeLightCardMaterial({
    color: 0xffd1a0,
    opacity: 0.085,
    softness: 'wide',
  });
  const redNeonGlowMat = makeLightCardMaterial({
    color: T.accentColor,
    opacity: 0.16,
    softness: 'wide',
  });
  const cyanNeonGlowMat = makeLightCardMaterial({
    color: T.cyanNeonColor,
    opacity: 0.12,
    softness: 'wide',
  });
  const contactShadowMat = makeShadowCardMaterial({ opacity: 0.24, softness: 'wide' });
  const softShadowMat = makeShadowCardMaterial({ opacity: 0.14, softness: 'wide' });

  const addFloorCard = (x, z, sx, sz, mat, y = 0.009) => {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    card.rotation.x = -Math.PI / 2;
    card.position.set(x, y, z);
    card.scale.set(sx, sz, 1);
    group.add(card);
    return card;
  };

  const workGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), warmWorkGlowMat);
  workGlow.rotation.x = -Math.PI / 2;
  workGlow.position.set(-1.35, 0.012, cz + 1.05);
  workGlow.scale.set(2.3, 2.9, 1);
  group.add(workGlow);

  addFloorCard(-1.35, cz + 1.05, 1.05, 2.35, contactShadowMat);
  addFloorCard(0.85, cz + 0.75, 0.85, 0.68, softShadowMat);
  addFloorCard(-2.35, cz + 0.85, 0.56, 0.56, softShadowMat);
  addFloorCard(1.85, cz + 1.65, 0.62, 0.62, softShadowMat);

  // ----- Tattoo bed (long padded table) -----
  const bed = new THREE.Group();
  // Pad
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 1.95), padMat);
  pad.position.y = 0.78;
  bed.add(pad);
  // Headrest pad
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.10, 0.35), padMat);
  head.position.set(0, 0.86, -1.05);
  bed.add(head);
  // Base column
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.72, 16), baseMat);
  col.position.y = 0.36;
  bed.add(col);
  // Foot disc
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 24), baseMat);
  foot.position.y = 0.02;
  bed.add(foot);

  bed.position.set(-1.35, 0, cz + 1.05);
  group.add(bed);

  // ----- Side cart with tattoo equipment -----
  const cart = new THREE.Group();
  const cartTop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.45), chromeMat);
  cartTop.position.y = 0.85;
  cart.add(cartTop);
  const cartShelf = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.45), chromeMat);
  cartShelf.position.y = 0.5;
  cart.add(cartShelf);
  for (const [px, pz] of [[-0.27, -0.20], [0.27, -0.20], [-0.27, 0.20], [0.27, 0.20]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.85, 8), chromeMat);
    leg.position.set(px, 0.42, pz);
    cart.add(leg);
  }

  // Tattoo machine on top of cart — coil-style silhouette
  const machine = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.10), chromeMat);
  frame.position.set(0, 0.06, 0);
  machine.add(frame);
  const coil1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 16), inkBottleMat);
  coil1.position.set(0, 0.13, -0.03);
  coil1.rotation.x = Math.PI/2;
  machine.add(coil1);
  const coil2 = coil1.clone();
  coil2.position.z = 0.03;
  machine.add(coil2);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 12), chromeMat);
  grip.position.set(0, 0.08, 0.10);
  grip.rotation.x = Math.PI/3.2;
  machine.add(grip);
  machine.position.set(-0.15, 0.87, 0);
  cart.add(machine);

  // Ink bottles
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.08, 12), inkBottleMat);
    b.position.set(0.12 + i * 0.07, 0.91, 0.12);
    cart.add(b);
  }
  // Paper towel roll
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.15, 16),
    new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.95 }));
  roll.position.set(0.1, 0.93, -0.1);
  roll.rotation.z = Math.PI/2;
  cart.add(roll);

  cart.position.set(0.85, 0, cz + 0.75);
  group.add(cart);

  // ----- Swing-arm lamp -----
  const lampGroup = new THREE.Group();
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.04, 24), baseMat);
  lampGroup.add(lampBase);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.5, 12), chromeMat);
  pole.position.y = 0.77;
  lampGroup.add(pole);
  const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.55, 12), chromeMat);
  arm1.position.set(0.18, 1.5, 0);
  arm1.rotation.z = Math.PI/2.6;
  lampGroup.add(arm1);
  const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.45, 12), chromeMat);
  arm2.position.set(0.55, 1.4, 0);
  arm2.rotation.z = -Math.PI/3;
  lampGroup.add(arm2);
  // Lamp head (cone shade)
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.18, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }),
  );
  shade.position.set(0.78, 1.18, 0);
  shade.rotation.x = Math.PI;
  lampGroup.add(shade);
  // Bulb glow disk
  const bulb = new THREE.Mesh(
    new THREE.CircleGeometry(0.07, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false }),
  );
  bulb.position.set(0.78, 1.10, 0);
  bulb.rotation.x = -Math.PI/2;
  lampGroup.add(bulb);
  lampGroup.position.set(-2.35, 0, cz + 0.85);
  group.add(lampGroup);

  // ----- Stool -----
  const stool = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 24), padMat);
  seat.position.y = 0.55;
  stool.add(seat);
  const stoolPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 12), chromeMat);
  stoolPole.position.y = 0.275;
  stool.add(stoolPole);
  const stoolBase = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 24), chromeMat);
  stoolBase.position.y = 0.015;
  stool.add(stoolBase);
  stool.position.set(1.85, 0, cz + 1.65);
  group.add(stool);

  // ----- Mirror on back wall -----
  const mirrorZ = cz - room.length/2 + 0.024;
  const mirror = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x2a3540, roughness: 0.05, metalness: 0.95 }),
  );
  mirror.position.set(2.0, 1.5, mirrorZ);
  group.add(mirror);

  const frameZ = mirrorZ + 0.018;
  const mirrorFrameW = 0.78;
  const mirrorFrameH = 1.18;
  const rail = 0.045;
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(mirrorFrameW, rail, 0.035), wood);
  frameTop.position.set(2.0, 1.5 + mirrorFrameH / 2, frameZ);
  group.add(frameTop);
  const frameBottom = frameTop.clone();
  frameBottom.position.y = 1.5 - mirrorFrameH / 2;
  group.add(frameBottom);
  const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(rail, mirrorFrameH, 0.035), wood);
  frameLeft.position.set(2.0 - mirrorFrameW / 2, 1.5, frameZ);
  group.add(frameLeft);
  const frameRight = frameLeft.clone();
  frameRight.position.x = 2.0 + mirrorFrameW / 2;
  group.add(frameRight);

  // ----- Neon "INK" sign on back wall -----
  const signGroup = new THREE.Group();
  // Use line segments / boxes to fake neon — three boxes for "I N K"
  const neonMat = new THREE.MeshBasicMaterial({
    color: T.accentColor,
    toneMapped: false,
  });
  const stroke = 0.04;
  const letterH = 0.28;
  const letterGap = 0.12;
  const buildI = (xc) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(stroke, letterH, stroke), neonMat);
    m.position.set(xc, 0, 0);
    return m;
  };
  const buildN = (xc) => {
    const w = 0.18;
    const g = new THREE.Group();
    const l = new THREE.Mesh(new THREE.BoxGeometry(stroke, letterH, stroke), neonMat);
    l.position.set(xc - w/2, 0, 0);
    const r = new THREE.Mesh(new THREE.BoxGeometry(stroke, letterH, stroke), neonMat);
    r.position.set(xc + w/2, 0, 0);
    const d = new THREE.Mesh(new THREE.BoxGeometry(stroke, Math.hypot(w, letterH), stroke), neonMat);
    d.position.set(xc, 0, 0);
    d.rotation.z = Math.atan2(w, letterH);
    g.add(l, r, d);
    return g;
  };
  const buildK = (xc) => {
    const g = new THREE.Group();
    const l = new THREE.Mesh(new THREE.BoxGeometry(stroke, letterH, stroke), neonMat);
    l.position.set(xc - 0.07, 0, 0);
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(stroke, 0.18, stroke), neonMat);
    a1.position.set(xc - 0.01, 0.06, 0);
    a1.rotation.z = -Math.PI/3.5;
    const a2 = new THREE.Mesh(new THREE.BoxGeometry(stroke, 0.18, stroke), neonMat);
    a2.position.set(xc - 0.01, -0.06, 0);
    a2.rotation.z = Math.PI/3.5;
    g.add(l, a1, a2);
    return g;
  };

  const I = buildI(-2 * (0.18 + letterGap)); // approx letter width 0.18
  const N = buildN(-(0.18/2 + letterGap/2));
  const K = buildK( (0.18/2 + letterGap/2 + 0.08));
  signGroup.add(I, N, K);
  signGroup.position.set(-1.4, 2.6, cz - room.length/2 + 0.04);
  group.add(signGroup);

  const signGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), redNeonGlowMat);
  signGlow.position.set(-1.4, 2.6, cz - room.length/2 + 0.035);
  signGlow.scale.set(1.9, 0.95, 1);
  group.add(signGlow);

  // ----- Cyan accent on side wall -----
  const cyanStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(0.04, 1.6),
    new THREE.MeshBasicMaterial({ color: T.cyanNeonColor, toneMapped: false }),
  );
  cyanStrip.position.set(-room.width/2 + 0.02, 1.4, cz - 1.2);
  cyanStrip.rotation.y = Math.PI / 2;
  group.add(cyanStrip);
  const cyanGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cyanNeonGlowMat);
  cyanGlow.position.set(-room.width/2 + 0.025, 1.4, cz - 1.2);
  cyanGlow.rotation.y = Math.PI / 2;
  cyanGlow.scale.set(1.55, 2.45, 1);
  group.add(cyanGlow);
  // ----- Tattoo-room ambient (slightly cooler / dimmer than gallery) -----
  group.add(new THREE.AmbientLight(0xfff2dc, T.ambientIntensity));

  scene.add(group);
  return group;
}
