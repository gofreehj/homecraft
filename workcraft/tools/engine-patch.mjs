// The site's engine patches, applied to a staged copy of engine/ only.
//
// The repository's engine/ stays exactly as released, so `git merge` of
// upstream never has to resolve engine changes. Everything this site adds to
// the shared engine is listed here, as exact anchors, and applied by
// tools/stage.mjs after engine/ is copied into dist/.
//
// When an anchor stops matching after an upstream update, this throws with the
// file and the anchor's first line. Re-read the new upstream code, update the
// anchor, and run tools/smoke.mjs. Do not copy patched files back into engine/.
//
// The patches, in order:
//   main.js       clickable plates (world.pickables -> window.__homePlate) and
//                 Dock entries for stations without a page
//   world/world.js  pass world.pickables through from build() to main.js
//   ui/phone.js   resolve app icons from engine/, and add the Feishu tile
//   ui/icons.js   resolve the Homecraft logo from engine/ once bundled
//   ui/photo.js   resolve the Homecraft watermark from engine/ once bundled
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const PATCHES = [
  {
    file: 'main.js',
    edits: [
      {
        find: `  const hotspots = world.hotspots.filter(h => publicStations.some(s => s.id === h.id));

  function pick(clientX, clientY) {`,
        replace: `  const hotspots = world.hotspots.filter(h => publicStations.some(s => s.id === h.id));
  // Clickable plates (a showroom's information boards): the site's page
  // receives the id and decides what to show.
  const pickables = world.pickables || [];

  function pick(clientX, clientY) {`,
      },
      {
        find: `      if (!best || t < best.t) best = { t, h };
    }
    const portalHit = portal?.pick(ray.ray);`,
        replace: `      if (!best || t < best.t) best = { t, h };
    }
    for (const p of pickables) {
      if (!ray.ray.intersectBox(p.box, hit)) continue;
      const t = hit.distanceTo(o);
      if (block && t > block.t + 0.35) continue;
      if (!best || t < best.t) best = { t, h: { id: p.id, plate: p.id } };
    }
    const portalHit = portal?.pick(ray.ray);`,
      },
      {
        find: `    stage.renderer.domElement.style.cursor = aimOk ? 'none' : x >= 0 && pick(x, y).spot?.id === 'portal' ? 'pointer' : '';`,
        replace: `    const spot = x >= 0 && !aimOk ? pick(x, y).spot : null;
    stage.renderer.domElement.style.cursor = aimOk ? 'none' : spot && (spot.id === 'portal' || spot.plate) ? 'pointer' : '';`,
      },
      {
        find: `    if (rig.introActive) { rig.skipIntro(); return; }
    // Lying on the pool's floor looking up, a tap only brings them up again.`,
        replace: `    if (rig.introActive) { rig.skipIntro(); return; }
    // A plate belongs to the page, not the scene: hand the id over instead of
    // opening a text card in the world.
    if (target.spot?.plate) { window.__homePlate?.(target.spot.plate); return; }
    // Lying on the pool's floor looking up, a tap only brings them up again.`,
      },
      {
        find: `    const s = publicStations.find(s => s.id === id);
    if (s) dockButton(() => nameOf(s), s.icon || s.id, () => go(s.id)).dataset.station = s.id;`,
        replace: `    // Stations without a page (page: false), such as a showroom, still get a
    // Dock button: it flies the player there and shows the camera move.
    const s = publicStations.find(s => s.id === id) || STATIONS.find(st => st.id === id && st.at);
    if (s) dockButton(() => nameOf(s), s.icon || s.id, () => go(s.id)).dataset.station = s.id;`,
      },
    ],
  },
  {
    file: 'world/world.js',
    edits: [
      {
        find: `    batches = {}, planes = [], obstacles = [], lights: allLights = [], bakes = [], hotspots = [], animated = {}, surfaces = {},`,
        replace: `    batches = {}, planes = [], obstacles = [], lights: allLights = [], bakes = [], hotspots = [], pickables = [], animated = {}, surfaces = {},`,
      },
      {
        find: `    obstacles, hotspots, animated, surfaces, lights, materials, tiles, isNight: () => night,`,
        replace: `    obstacles, hotspots, pickables, animated, surfaces, lights, materials, tiles, isNight: () => night,`,
      },
    ],
  },
  {
    file: 'ui/phone.js',
    edits: [
      {
        find: `const app = name => new URL(\`../assets/apps/\${name}.webp\`, import.meta.url).href;
const LOOKS = {
  jike: { tile: '#ffe411', ink: '#1d1d1f', img: app('jike') },
  x: { tile: '#0f0f10', img: app('x') },
  github: { tile: '#24292f', img: app('github') },`,
        replace: `// The engine runs as a bundle at engine/world-3d.js, so asset paths resolve
// from engine/, not from engine/ui/. Names here include the file extension.
const app = file => new URL(\`./assets/apps/\${file}\`, import.meta.url).href;
const LOOKS = {
  jike: { tile: '#ffe411', ink: '#1d1d1f', img: app('jike.webp') },
  x: { tile: '#0f0f10', img: app('x.webp') },
  github: { tile: '#24292f', img: app('github.webp') },`,
      },
      {
        find: `  mail: { tile: '#3b72d6', glyph: 'mail' },`,
        replace: `  mail: { tile: '#3b72d6', glyph: 'mail' },
  feishu: { tile: '#ffffff', img: app('feishu.png') },`,
      },
    ],
  },
  {
    // The engine's own modules sit one level below engine/, so they address
    // engine/assets as ../assets. In the bundle at engine/world-3d.js that
    // resolves above engine/, where the site's assets live; point it back.
    file: 'ui/icons.js',
    edits: [
      {
        find: `const HOMECRAFT_LOGO_URL = new URL('../assets/homecraft-logo-32.png', import.meta.url).href;`,
        replace: `const HOMECRAFT_LOGO_URL = new URL('./assets/homecraft-logo-32.png', import.meta.url).href;`,
      },
    ],
  },
  {
    file: 'ui/photo.js',
    edits: [
      {
        find: `  const HOMECRAFT_LOGO_URL = new URL('../assets/homecraft-logo.png', import.meta.url).href;`,
        replace: `  const HOMECRAFT_LOGO_URL = new URL('./assets/homecraft-logo.png', import.meta.url).href;`,
      },
    ],
  },
];

// Apply every patch under `engineDir` (a staged copy), preserving line endings.
export function applyEnginePatches(engineDir, patches = PATCHES) {
  for (const { file, edits } of patches) {
    const path = join(engineDir, file);
    const original = readFileSync(path, 'utf8');
    const crlf = original.includes('\r\n');
    let text = crlf ? original.replace(/\r\n/g, '\n') : original;
    for (const { find, replace } of edits) {
      const first = text.indexOf(find);
      if (first < 0) {
        throw new Error(`${relative(engineDir, path)}: anchor not found after an engine update; update tools/engine-patch.mjs.\n  ${find.split('\n')[0]}`);
      }
      if (text.indexOf(find, first + 1) >= 0) {
        throw new Error(`${relative(engineDir, path)}: anchor matches more than once; make it more specific.\n  ${find.split('\n')[0]}`);
      }
      text = text.replace(find, replace);
    }
    writeFileSync(path, crlf ? text.replace(/\n/g, '\r\n') : text);
  }
}
