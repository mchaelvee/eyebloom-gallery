import * as THREE from 'three';

const materialCache = new Map();

function cacheMaterial(key, create) {
  if (!materialCache.has(key)) materialCache.set(key, create());
  return materialCache.get(key);
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function makeTexture(canvas, { anisotropy = 8 } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  return texture;
}

function fillNoise(ctx, width, height, seed, count, alpha, light = false) {
  const rand = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    const shade = light
      ? 190 + Math.floor(rand() * 52)
      : 18 + Math.floor(rand() * 40);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${alpha * rand()})`;
    ctx.fillRect(rand() * width, rand() * height, 1 + rand() * 2.5, 1 + rand() * 2.5);
  }
}

function addEllipseGlow(ctx, x, y, rx, ry, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(${color},${alpha})`);
  g.addColorStop(0.42, `rgba(${color},${alpha * 0.42})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function makeBakedFloorMaterial({ width, length }) {
  return cacheMaterial(`floor:${Math.round(width * 10)}:${Math.round(length * 10)}`, () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1536;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');

  const base = ctx.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, '#0f0905');
  base.addColorStop(0.5, '#21130a');
  base.addColorStop(1, '#090604');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const rand = seededRandom(42);
  const plankCount = 14;
  const plankW = canvas.width / plankCount;
  for (let i = 0; i < plankCount; i++) {
    const x = i * plankW;
    const shade = 17 + Math.floor(rand() * 24);
    ctx.fillStyle = `rgba(${shade + 24},${shade + 13},${shade + 5},0.22)`;
    ctx.fillRect(x, 0, plankW - 2, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(x, 0, 2, canvas.height);
  }

  for (let i = 0; i < 190; i++) {
    const x = rand() * canvas.width;
    const y = rand() * canvas.height;
    ctx.strokeStyle = `rgba(214,151,84,${0.025 + rand() * 0.045})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 20 - rand() * 40, y + 80, x + 16 - rand() * 32, y + 180, x + 8 - rand() * 16, y + 330);
    ctx.stroke();
  }

  const poolCount = Math.max(4, Math.round(length / 5));
  for (let i = 0; i < poolCount; i++) {
    const y = ((i + 0.5) / poolCount) * canvas.height;
    addEllipseGlow(ctx, canvas.width * 0.5, y, canvas.width * 0.24, canvas.height * 0.07, '255,181,92', 0.18);
  }

  const edge = ctx.createLinearGradient(0, 0, canvas.width, 0);
  edge.addColorStop(0, 'rgba(0,0,0,0.55)');
  edge.addColorStop(0.18, 'rgba(0,0,0,0)');
  edge.addColorStop(0.82, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  fillNoise(ctx, canvas.width, canvas.height, 301, 12000, 0.035);

  return new THREE.MeshBasicMaterial({
    map: makeTexture(canvas, { anisotropy: 10 }),
    fog: true,
  });
  });
}

export function makeBakedWallMaterial({ width, height, tint = '#d9cdb6', room = 'gallery' }) {
  return cacheMaterial(`wall:${room}:${tint}:${Math.round(width * 10)}:${Math.round(height * 10)}`, () => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1024, Math.min(2048, Math.round(width * 128)));
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const vertical = ctx.createLinearGradient(0, 0, 0, canvas.height);
  vertical.addColorStop(0, room === 'tattoo' ? 'rgba(0,0,0,0.48)' : 'rgba(54,38,22,0.26)');
  vertical.addColorStop(0.32, 'rgba(255,242,218,0.05)');
  vertical.addColorStop(0.68, 'rgba(255,226,176,0.08)');
  vertical.addColorStop(1, room === 'tattoo' ? 'rgba(0,0,0,0.5)' : 'rgba(44,28,14,0.2)');
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lightCount = Math.max(2, Math.round(width / 5.2));
  for (let i = 0; i < lightCount; i++) {
    const x = ((i + 0.5) / lightCount) * canvas.width;
    addEllipseGlow(ctx, x, canvas.height * 0.47, canvas.width * 0.16, canvas.height * 0.35, '255,207,148', room === 'tattoo' ? 0.06 : 0.12);
  }

  const edge = ctx.createLinearGradient(0, 0, canvas.width, 0);
  edge.addColorStop(0, 'rgba(0,0,0,0.18)');
  edge.addColorStop(0.08, 'rgba(0,0,0,0)');
  edge.addColorStop(0.92, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  fillNoise(ctx, canvas.width, canvas.height, room === 'tattoo' ? 908 : 620, 11000, room === 'tattoo' ? 0.025 : 0.035, true);

  return new THREE.MeshBasicMaterial({
    map: makeTexture(canvas),
    fog: true,
  });
  });
}

export function makeBakedCeilingMaterial({ width, length }) {
  return cacheMaterial(`ceiling:${Math.round(width * 10)}:${Math.round(length * 10)}`, () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#070503';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lightCount = Math.max(4, Math.round(length / 5));
  for (let i = 0; i < lightCount; i++) {
    const y = ((i + 0.5) / lightCount) * canvas.height;
    addEllipseGlow(ctx, canvas.width * 0.5, y, canvas.width * 0.18, canvas.height * 0.045, '255,226,178', 0.16);
  }

  fillNoise(ctx, canvas.width, canvas.height, 117, 5000, 0.035);

  return new THREE.MeshBasicMaterial({
    map: makeTexture(canvas, { anisotropy: 6 }),
    fog: true,
  });
  });
}
