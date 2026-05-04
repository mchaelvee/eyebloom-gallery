import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }    from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js';

import { config } from './config.js';
import { buildWorld, setWorldLoadingManager } from './gallery.js';
import { buildTattooRoom } from './tattoo.js';
import { loadArt, loadArtManifest, setArtLoadingManager } from './art.js';
import { createControls, isTouchDevice } from './controls.js';
import { createLightbox } from './lightbox.js';

const canvas = document.getElementById('scene');
const touchDevice = isTouchDevice();
const perfConfig = config.performance ?? {};
const bloomConfig = config.bloom ?? {};
const useBloom = !!(bloomConfig.enabled && !(touchDevice && bloomConfig.skipOnTouch));

const maxPixelRatio = touchDevice
  ? (perfConfig.mobilePixelRatio ?? 1.15)
  : (perfConfig.desktopPixelRatio ?? 1.5);
const initialPixelRatio = Math.max(
  window.devicePixelRatio || 1,
  touchDevice
    ? (perfConfig.mobileInitialPixelRatio ?? 0)
    : (perfConfig.desktopInitialPixelRatio ?? 0),
);
const minPixelRatio = perfConfig.minPixelRatio ?? 0.85;
let currentPixelRatio = Math.max(
  minPixelRatio,
  Math.min(initialPixelRatio, maxPixelRatio),
);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: perfConfig.antialias ?? !touchDevice,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(currentPixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = config.theme.toneMappingExposure ?? 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 100);

// UI refs
const focusLabel = document.getElementById('focus-label');
const crosshair = document.getElementById('crosshair');
const hud = document.getElementById('hud');
const intro = document.getElementById('intro');
const enterBtn = document.getElementById('enter-btn');
const exitBtn = document.getElementById('exit-btn');
const loader = document.getElementById('loader');
const loaderProgress = document.getElementById('loader-progress');
const loaderLabel = document.getElementById('loader-label');

let galleryReady = false;
let loadFailed = false;
const loadStartedAt = performance.now();

function setLoadingState(progress, label) {
  if (loaderProgress) loaderProgress.style.width = `${Math.round(progress * 100)}%`;
  if (loaderLabel && label) loaderLabel.textContent = label;
}

enterBtn.disabled = true;
enterBtn.textContent = 'loading gallery';
setLoadingState(0, 'preparing gallery');

const loadingManager = new THREE.LoadingManager();
setWorldLoadingManager(loadingManager);
setArtLoadingManager(loadingManager);

const managerIdle = new Promise((resolve) => {
  loadingManager.onStart = () => setLoadingState(0.18, 'loading gallery assets');
  loadingManager.onProgress = (url, loaded, total) => {
    const progress = total > 0 ? loaded / total : 0.05;
    const cleanUrl = url.split('/').pop() || 'asset';
    setLoadingState(0.18 + Math.min(progress, 0.72), `loading ${cleanUrl}`);
  };
  loadingManager.onLoad = () => {
    setLoadingState(0.92, 'assets loaded');
    resolve();
  };
  loadingManager.onError = () => {
    setLoadingState(1, 'some assets failed');
  };
});

// World + tattoo room props
setLoadingState(0.04, 'building gallery');
const { regions, layout } = buildWorld(scene);
setLoadingState(0.10, 'placing studio details');
buildTattooRoom(scene, layout);
setLoadingState(0.16, 'loading artwork');
const manifestPromise = loadArtManifest(loadingManager);

// Art across both rooms
let interactables = [];
let artReady = false;
const artPromise = manifestPromise.then((manifest) => loadArt(scene, layout, {
  manifest,
  manager: loadingManager,
}));

Promise.all([managerIdle, artPromise]).then(async ([, { interactables: list }]) => {
  interactables = list;
  artReady = true;
  await warmUpGallery();
  galleryReady = true;
  loader?.classList.add('ready');
  enterBtn.disabled = false;
  enterBtn.textContent = 'enter gallery';
  setLoadingState(1, 'ready');
}).catch((err) => {
  console.error('gallery load failed', err);
  loadFailed = true;
  enterBtn.disabled = true;
  enterBtn.textContent = 'load failed';
  setLoadingState(1, 'gallery failed to load');
});

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

let hovered = null;

function clearHoverState() {
  if (!hovered && !focusLabel.classList.contains('visible')) return;
  hovered = null;
  crosshair.classList.remove('active');
  focusLabel.classList.remove('visible');
}

function pickInteractable() {
  if (!artReady) return null;
  raycaster.setFromCamera(center, camera);
  const hits = raycaster.intersectObjects(interactables, false);
  if (!hits.length) return null;
  const hit = hits[0];
  if (hit.distance > 6) return null;
  return hit.object;
}

const lightbox = createLightbox({
  onOpen: () => {
    controls.stop();
    hud.classList.add('hidden');
  },
  onClose: () => {
    intro.classList.add('hidden');
    hud.classList.remove('hidden');
    controls.start();
  },
});

const controls = createControls({
  camera,
  domElement: canvas,
  getRegions: () => regions,
  onClickInteractable: () => {
    const obj = pickInteractable();
    if (obj && obj.userData.piece) {
      lightbox.show(obj.userData.piece);
    }
  },
});
scene.add(controls.object);

// Debug handle.
if (typeof window !== 'undefined') {
  window.__eb = { scene, camera, controls, layout, regions };
}

function enterGallery() {
  if (!galleryReady || loadFailed) return;
  intro.classList.add('hidden');
  hud.classList.remove('hidden');
  controls.start();
}

function exitGallery() {
  controls.stop();
  hud.classList.add('hidden');
  intro.classList.remove('hidden');
}

enterBtn.addEventListener('click', enterGallery);
exitBtn.addEventListener('click', exitGallery);
document.addEventListener('keydown', (e) => {
  if (
    e.key !== 'Escape' ||
    lightbox.isOpen ||
    controls.isLocked ||
    intro.classList.contains('hidden') === false
  ) {
    return;
  }
  e.preventDefault();
  exitGallery();
});

// ----- Postprocessing (bloom on emissives) -----
let composer = null;
let bloomPass = null;

if (useBloom) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    bloomConfig.strength ?? 0.55,
    bloomConfig.radius ?? 0.4,
    bloomConfig.threshold ?? 0.78,
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function uploadSceneTextures() {
  if (!renderer.initTexture) return;

  const textures = new Set();
  const textureKeys = [
    'alphaMap',
    'aoMap',
    'bumpMap',
    'displacementMap',
    'emissiveMap',
    'envMap',
    'lightMap',
    'map',
    'metalnessMap',
    'normalMap',
    'roughnessMap',
  ];

  scene.traverse((obj) => {
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (!material) continue;
      for (const key of textureKeys) {
        const texture = material[key];
        if (texture?.isTexture) textures.add(texture);
      }
    }
  });

  for (const texture of textures) {
    if (texture.image) renderer.initTexture(texture);
  }
}

async function renderWarmupView(position, yaw = 0, pitch = 0) {
  const originalPosition = controls.object.position.clone();
  const originalYaw = controls.object.rotation.y;
  const pitchObject = camera.parent;
  const originalPitch = pitchObject?.rotation.x ?? 0;

  controls.object.position.copy(position);
  controls.object.rotation.y = yaw;
  if (pitchObject) pitchObject.rotation.x = pitch;
  camera.updateMatrixWorld(true);

  const frames = perfConfig.warmup?.framesPerView ?? 2;
  for (let i = 0; i < frames; i += 1) {
    if (composer) composer.render();
    else renderer.render(scene, camera);
    await nextFrame();
  }

  controls.object.position.copy(originalPosition);
  controls.object.rotation.y = originalYaw;
  if (pitchObject) pitchObject.rotation.x = originalPitch;
  camera.updateMatrixWorld(true);
}

async function warmUpGallery() {
  const warmup = perfConfig.warmup ?? {};
  if (!warmup.enabled) return;

  try {
    setLoadingState(0.96, 'optimizing gallery');
    onResize();
    uploadSceneTextures();

    if (renderer.compileAsync) {
      await renderer.compileAsync(scene, camera);
    } else {
      renderer.compile(scene, camera);
    }

    const eyeY = config.player.eyeHeight;
    const views = [
      [new THREE.Vector3(0, eyeY, config.player.startZ), Math.PI],
      [new THREE.Vector3(0, eyeY, layout.gallery.sections.paintings.centerZ), Math.PI / 2],
      [new THREE.Vector3(0, eyeY, layout.gallery.sections.drawings.centerZ), -Math.PI / 2],
      [new THREE.Vector3(0, eyeY, layout.tattoo.centerZ), 0],
    ];

    for (const [position, yaw] of views) {
      await renderWarmupView(position, yaw, -0.03);
    }

    const elapsed = performance.now() - loadStartedAt;
    const remaining = (warmup.minLoadMs ?? 0) - elapsed;
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  } catch (err) {
    console.warn('gallery warmup skipped', err);
  }
}

function setRenderPixelRatio(next) {
  const clamped = Math.max(minPixelRatio, Math.min(maxPixelRatio, next));
  if (Math.abs(clamped - currentPixelRatio) < 0.03) return;
  currentPixelRatio = clamped;
  renderer.setPixelRatio(currentPixelRatio);
  onResize();
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  if (composer) composer.setSize(w, h);
  if (bloomPass) bloomPass.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

// Animation loop
const clock = new THREE.Clock();
let pickElapsed = 0;
let fpsElapsed = 0;
let fpsFrames = 0;
let slowWindows = 0;
let fastWindows = 0;

function updateAdaptiveQuality(dt) {
  if (
    !perfConfig.dynamicResolution ||
    !galleryReady ||
    !controls.active ||
    document.hidden ||
    lightbox.isOpen
  ) return;

  fpsElapsed += dt;
  fpsFrames += 1;
  if (fpsElapsed < 1.4) return;

  const fps = fpsFrames / fpsElapsed;
  const target = perfConfig.targetFps ?? 52;
  fpsElapsed = 0;
  fpsFrames = 0;

  if (fps < target) {
    slowWindows += 1;
    fastWindows = 0;
    setRenderPixelRatio(currentPixelRatio - 0.15);
  } else if (fps > target + 8 && currentPixelRatio < maxPixelRatio && slowWindows === 0) {
    fastWindows += 1;
    if (fastWindows >= 4) {
      setRenderPixelRatio(currentPixelRatio + 0.1);
      fastWindows = 0;
    }
  } else {
    slowWindows = Math.max(0, slowWindows - 1);
    fastWindows = 0;
  }
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  controls.update(dt);
  updateAdaptiveQuality(dt);

  if (!touchDevice && controls.active && controls.isLocked && !lightbox.isOpen) {
    pickElapsed += dt;
    if (pickElapsed >= (perfConfig.pickInterval ?? 0.1)) {
      pickElapsed = 0;
      const obj = pickInteractable();
      if (obj !== hovered) {
        hovered = obj;
        if (hovered) {
          crosshair.classList.add('active');
          const p = hovered.userData.piece;
          focusLabel.textContent = p?.title || 'view';
          focusLabel.classList.add('visible');
        } else {
          crosshair.classList.remove('active');
          focusLabel.classList.remove('visible');
        }
      }
    }
  } else if (!touchDevice) {
    clearHoverState();
  }

  if (!lightbox.isOpen) {
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
