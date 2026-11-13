// The Aima Technology headquarters GLB (`assets/models/aima-build.glb`): an
// 80 x 75 m architectural office complex rising to 71.48 m on a 1:1 metre grid.
// Built to match reference photography: square main tower with an embedded
// magenta Aima wordmark (`LogoAima`), 2-story courtyard corridor ring, open
// south through-passage and north-west skybridge archway, sculpted planted
// roof gardens, and reflecting forecourt pool.
//
// `GLTFLoader` resolves asynchronously after the block world finishes initial
// shadow baking, so the module re-requests a shadow map update once loaded and
// drives reflective sky sheen and night illumination from `stage`.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import { canvasTexture } from '@engine/world/textures.js';
import { HQ } from './layout.js';

const MODEL = new URL('../assets/models/aima-build.glb', import.meta.url);

// Material response tuning layered over the GLB's own authored colours,
// baked textures (`CurtainGlass`, `RoofLawn`, `SiteAsphalt`, `LogoAima`), and PBR factors.
const ENV_INTENSITY = {
  CurtainGlass: 0.75,
  GlassBalustrade: 0.85,
  AluminumSilver: 0.62,
  CladdingSlate: 0.38,
  CladdingBronze: 0.28,
  WaterPool: 0.95,
};

const NIGHT_GLOW = {
  CurtainGlass: { emissive: 0xffd7a3, useMap: true, day: 0.02, night: 0.42 },
  LogoAima: { emissive: 0xffffff, useMap: true, day: 0.06, night: 0.95 },
};

// Non-overlapping ground-level (1F, y = 0..4 m) collision footprints in the
// GLB's local coordinate system. Both 1F open passages (`正面通道` x=[10.75..19.4]
// and `NW 后面通道` x=[-14.45..-6.0]) plus 1F courtyard colonnades stay passable.
const FOOTPRINTS = [
  { x0: -6.0, x1: 34.5, z0: -33.0, z1: -12.75 },   // Main Tower
  { x0: 22.85, x1: 34.5, z0: -12.75, z1: -5.5 },   // NE 2-Story Link 1F core (keeps foyer open)
  { x0: 21.45, x1: 34.5, z0: -5.5, z1: 19.15 },    // East Wing 1F behind open colonnade
  { x0: 19.4, x1: 34.5, z0: 19.15, z1: 29.85 },    // South-East Wing East of front passage
  { x0: -13.0, x1: 10.75, z0: 19.15, z1: 31.15 },  // South Wing West of front passage
  { x0: -26.5, x1: -13.0, z0: 18.5, z1: 30.85 },   // South-West Pavilion (west canopy open)
  { x0: -33.0, x1: -14.45, z0: -17.5, z1: 18.5 },  // West Wing (leaves NW passage & colonnade open)
  { x0: 4.15, x1: 7.45, z0: 2.95, z1: 6.25 },      // Central Courtyard planter mound
  { x0: 13.4, x1: 22.6, z0: 33.9, z1: 35.6 },      // South Forecourt reflecting pool
];

const state = {
  loadToken: 0,
  envMaterials: [],
  litMaterials: [],
  envTarget: null,
};

let startLoad = null;

function resetState() {
  state.envMaterials.length = 0;
  state.litMaterials.length = 0;
  if (state.envTarget) {
    state.envTarget.dispose();
    state.envTarget = null;
  }
}

// Prefiltered CubeUV sky reflection probe for metallic cladding, glazing, and
// water; baked once without allocating on subsequent frames.
function createSkyProbe(renderer) {
  const equirect = canvasTexture(256, 128, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.58);
    sky.addColorStop(0, '#78addf');
    sky.addColorStop(0.72, '#bdd9ed');
    sky.addColorStop(1, '#dce7ed');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.58);
    ctx.fillStyle = '#859184';
    ctx.fillRect(0, h * 0.58, w, h * 0.42);
    ctx.fillStyle = 'rgba(255, 246, 224, 0.92)';
    ctx.beginPath();
    ctx.arc(w * 0.68, h * 0.2, 9, 0, Math.PI * 2);
    ctx.fill();
  }, { pixelated: false });
  equirect.mapping = THREE.EquirectangularReflectionMapping;

  const pmrem = new THREE.PMREMGenerator(renderer);
  try {
    return pmrem.fromEquirectangular(equirect);
  } finally {
    pmrem.dispose();
    equirect.dispose();
  }
}

function configureMaterials(root, envMap) {
  const seen = new Set();
  root.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;

    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      if (!material || seen.has(material)) continue;
      seen.add(material);

      const baseEnv = ENV_INTENSITY[material.name];
      if (baseEnv) {
        material.envMap = envMap;
        material.envMapIntensity = baseEnv;
        state.envMaterials.push({ material, baseEnv });
      }

      if (material.name === 'GlassBalustrade') {
        material.transparent = true;
        material.depthWrite = false;
        material.side = THREE.DoubleSide;
      }

      const glow = NIGHT_GLOW[material.name];
      if (glow) {
        material.emissive.setHex(glow.emissive);
        if (glow.useMap && material.map) material.emissiveMap = material.map;
        material.emissiveIntensity = glow.day;
        state.litMaterials.push({ material, day: glow.day, night: glow.night });
      }

      material.needsUpdate = true;
    }
  });
}

export function buildAima({ stage }) {
  resetState();
  const token = ++state.loadToken;
  const [ox, oy, oz] = HQ.position;
  const yaw = HQ.yaw || 0, cos = Math.cos(yaw), sin = Math.sin(yaw);
  const place = (x, z) => ({ x: ox + x * cos + z * sin, z: oz - x * sin + z * cos });
  window.__aimaLoaded = false;
  let started = false;

  // The model is large, so it loads in the background while the house renders;
  // the intro camera already looks across the channel at the campus.
  startLoad = () => {
    if (started) return;
    started = true;
    new GLTFLoader().load(
      MODEL.href,
      gltf => {
        if (token !== state.loadToken) return;
        const root = gltf.scene;
        state.envTarget = createSkyProbe(stage.renderer);
        root.name = 'aima-hq';
        root.position.set(ox, oy, oz);
        root.rotation.y = yaw;
        configureMaterials(root, state.envTarget.texture);
        stage.scene.add(root);
        stage.renderer.shadowMap.needsUpdate = true;
        window.__aimaLoaded = true;
      },
      undefined,
      error => console.error('Aima headquarters failed to load', error),
    );
  };

  const obstacles = FOOTPRINTS.map(r => {
    const corners = [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]].map(([x, z]) => place(x, z));
    const xs = corners.map(p => p.x), zs = corners.map(p => p.z);
    return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), level: 0 };
  });

  // Two practical point lights wash the entrance forecourt/pool and the
  // central courtyard arcades after dark.
  const lights = [
    [15, 6.5, 36, 280, 80],
    [3, 7, 3, 220, 75],
  ].map(([x, y, z, base, distance]) => {
    const light = new THREE.PointLight(0xffd9b0, 0, distance, 2);
    const p = place(x, z);
    light.position.set(p.x, y + oy, p.z);
    light.userData = { base, day: 0.12, priority: 1 };
    return light;
  });

  startLoad();
  return { obstacles, lights };
}

export function setupAima({ stage }) {
  return {
    update() {
      const night = stage.night;
      const reflectionScale = (1 - 0.82 * night) * (1 - 0.55 * stage.veil);
      for (let i = 0; i < state.envMaterials.length; i++) {
        const entry = state.envMaterials[i];
        entry.material.envMapIntensity = entry.baseEnv * reflectionScale;
      }
      for (let i = 0; i < state.litMaterials.length; i++) {
        const entry = state.litMaterials[i];
        entry.material.emissiveIntensity = entry.day + (entry.night - entry.day) * night;
      }
    },
  };
}
