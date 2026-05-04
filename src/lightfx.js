import * as THREE from 'three';

const textureCache = new Map();

function makeCanvasTexture(key, width, height, paint) {
  if (textureCache.has(key)) return textureCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  paint(ctx, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  textureCache.set(key, texture);
  return texture;
}

function makeRadialTexture(key, stops) {
  const size = 256;
  return makeCanvasTexture(key, size, size, (ctx, width, height) => {
    const c = width / 2;
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
    for (const [at, alpha] of stops) {
      gradient.addColorStop(at, `rgba(255,255,255,${alpha})`);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  });
}

function makeWallBeamTexture(key, topBias = 0.12) {
  return makeCanvasTexture(key, 384, 768, (ctx, width, height) => {
    const x = width / 2;
    const y = height * topBias;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, height * 0.88);
    glow.addColorStop(0, 'rgba(255,255,255,0.95)');
    glow.addColorStop(0.18, 'rgba(255,255,255,0.58)');
    glow.addColorStop(0.48, 'rgba(255,255,255,0.20)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const vertical = ctx.createLinearGradient(0, 0, 0, height);
    vertical.addColorStop(0, 'rgba(255,255,255,0.55)');
    vertical.addColorStop(0.22, 'rgba(255,255,255,0.22)');
    vertical.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = vertical;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  });
}

function makeLinearSheenTexture(key) {
  return makeCanvasTexture(key, 384, 512, (ctx, width, height) => {
    const vertical = ctx.createLinearGradient(0, 0, 0, height);
    vertical.addColorStop(0, 'rgba(255,255,255,0.65)');
    vertical.addColorStop(0.32, 'rgba(255,255,255,0.22)');
    vertical.addColorStop(0.72, 'rgba(255,255,255,0.035)');
    vertical.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = vertical;
    ctx.fillRect(0, 0, width, height);

    const edge = ctx.createLinearGradient(0, 0, width, 0);
    edge.addColorStop(0, 'rgba(255,255,255,0)');
    edge.addColorStop(0.45, 'rgba(255,255,255,0.75)');
    edge.addColorStop(0.55, 'rgba(255,255,255,0.75)');
    edge.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  });
}

function makePlaqueTexture(key, { title = 'Untitled', sub = '', dark = false } = {}) {
  return makeCanvasTexture(key, 768, 192, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = dark ? 'rgba(16,14,12,0.86)' : 'rgba(235,226,208,0.92)';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = dark ? 'rgba(255,220,180,0.22)' : 'rgba(58,43,28,0.20)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, width - 3, height - 3);

    ctx.fillStyle = dark ? '#f3dfc4' : '#23170e';
    ctx.font = '500 38px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(title.slice(0, 34), 42, 38);

    if (sub) {
      ctx.fillStyle = dark ? 'rgba(243,223,196,0.68)' : 'rgba(35,23,14,0.64)';
      ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(sub.slice(0, 46).toUpperCase(), 42, 102);
    }
  });
}

export function makeSectionSignTexture(label) {
  return makeCanvasTexture(`section:${label}`, 1024, 256, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);

    // Subtle warm gradient backing
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(20,12,4,0.18)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Glow halo behind text
    const halo = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.5);
    halo.addColorStop(0, 'rgba(255, 220, 168, 0.42)');
    halo.addColorStop(0.4, 'rgba(255, 200, 138, 0.18)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, width, height);

    // Text — engraved warm metal feel
    const text = label;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '300 130px "Times New Roman", "Didot", Georgia, serif';
    // shadow underlayer
    ctx.fillStyle = 'rgba(255, 220, 175, 0.18)';
    ctx.fillText(text, width / 2 + 3, height / 2 + 3);
    // main fill
    ctx.fillStyle = '#fff1d2';
    ctx.fillText(text, width / 2, height / 2);

    // Letter-spacing brand tick under
    ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255, 220, 175, 0.62)';
    ctx.fillText('· · ·', width / 2, height / 2 + 78);
  });
}

export function makeWallBeamMaterial({
  color = 0xffd39a,
  opacity = 0.15,
  variant = 'gallery',
} = {}) {
  const texture = makeWallBeamTexture(`wall-beam:${variant}`, variant === 'tattoo' ? 0.08 : 0.12);

  return new THREE.MeshBasicMaterial({
    map: texture,
    color,
    opacity,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

export function makeCanvasSheenMaterial({
  color = 0xfff0d0,
  opacity = 0.05,
  variant = 'gallery',
} = {}) {
  const texture = makeLinearSheenTexture(`canvas-sheen:${variant}`);

  return new THREE.MeshBasicMaterial({
    map: texture,
    color,
    opacity,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

export function makePlaqueMaterial(piece, { dark = false } = {}) {
  const subParts = [];
  if (piece.medium) subParts.push(piece.medium);
  if (piece.year) subParts.push(piece.year);
  const texture = makePlaqueTexture(`plaque:${piece.id}:${dark ? 'dark' : 'light'}`, {
    title: piece.title || 'Untitled',
    sub: subParts.join(' / '),
    dark,
  });

  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    toneMapped: false,
  });
}

export function makeShadowCardMaterial({
  opacity = 0.22,
  softness = 'wide',
} = {}) {
  const texture = softness === 'wide'
    ? makeRadialTexture('shadow-wide', [[0, 1], [0.46, 0.54], [0.82, 0.14], [1, 0]])
    : makeRadialTexture('shadow-soft', [[0, 1], [0.32, 0.52], [0.74, 0.12], [1, 0]]);

  return new THREE.MeshBasicMaterial({
    map: texture,
    color: 0x000000,
    opacity,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

export function makeLightCardMaterial({
  color = 0xffffff,
  opacity = 0.18,
  softness = 'soft',
  additive = true,
} = {}) {
  const texture = softness === 'wide'
    ? makeRadialTexture('wide', [[0, 1], [0.34, 0.62], [0.72, 0.18], [1, 0]])
    : makeRadialTexture('soft', [[0, 1], [0.28, 0.58], [0.66, 0.12], [1, 0]]);

  return new THREE.MeshBasicMaterial({
    map: texture,
    color,
    opacity,
    transparent: true,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
    toneMapped: false,
  });
}
