// Build the Homecraft show-home example. The engine calls build() once at boot,
// then setup() once the player exists.
import { buildIsland } from '@engine/world/terrain.js';
import { buildForest } from '@engine/world/landscape.js';
import { defineHouseBlocks, surfaceAt, buildPool, buildShell } from './house.js';
import { furnish } from './furnish.js';
import { buildOuter } from './outer.js';
import { buildMountain } from './mountain.js';
import { buildRoofAccess } from './roof-access.js';
import { createStainless } from './stainless.js';
import { createVertec } from './vertec.js';
import { buildAima, setupAima } from './aima.js';
import { HOME_ISLAND, HQ_ISLAND, HQ_SITE, FOREST, COURT, RIM, HQ, BRIDGE } from './layout.js';

// The campus island is a flat, lightly wooded ring around the model's site slab.
const campusSurfaceAt = (x, z, edge) => edge < 3 ? 'sand' : 'grass';

export function build({ grid, layer, materials, stage }) {
  // The kitchen's brushed steel is a real metal, with its own room reflection.
  materials.boxMetal = createStainless(stage);
  defineHouseBlocks(grid);
  buildIsland(grid, HOME_ISLAND, { surfaceAt });
  buildIsland(grid, HQ_ISLAND, { surfaceAt: campusSurfaceAt, seed: 23 });
  buildPool(grid);
  buildShell(grid);
  // A short boardwalk from the east driveway to the campus forecourt.
  grid.fill(BRIDGE.x0, -1, BRIDGE.z0, BRIDGE.x1, 0, BRIDGE.z1, 'deck');
  grid.fill(BRIDGE.x0, 0, BRIDGE.z0, BRIDGE.x1, 1, BRIDGE.z0 + 1, 'black_metal');
  grid.fill(BRIDGE.x0, 0, BRIDGE.z1 - 1, BRIDGE.x1, 1, BRIDGE.z1, 'black_metal');
  const forest = buildForest(grid, layer, FOREST);
  const furn = furnish({ layer });
  // The pier and sailboat, the mountain and the roof's outside stair are
  // ground of their own, outside the block grid.
  const outer = buildOuter(layer, materials), mountain = buildMountain(layer, materials), roofAccess = buildRoofAccess(layer, materials);
  stage.scene.add(outer.group, mountain.group, roofAccess.group);
  // The headquarters sits on its own island east of the home island.
  const aima = HQ.enabled ? buildAima({ stage }) : null;
  return {
    batches: furn.batches,
    planes: furn.planes,
    obstacles: aima ? [...furn.obstacles, ...aima.obstacles] : furn.obstacles,
    lights: aima ? [...furn.lights, ...aima.lights] : furn.lights,
    hotspots: furn.hotspots, pickables: furn.pickables, animated: furn.animated, surfaces: furn.surfaces, forest,
    // 引擎这一版把烘焙灯叫作 bakes；示例代码里叫 lighting，两者结构相同。
    bakes: furn.lighting || [],
    sites: [outer, mountain], sitesAfter: [roofAccess],
    named: { outer, mountain, roofAccess, drawMap },
  };
}

// The half court and the Aima site on the radar.
function drawMap(ctx, X, Z, PPM) {
  ctx.fillStyle = 'rgba(201, 204, 205, 0.55)';
  ctx.fillRect(X(HQ_SITE.x0), Z(HQ_SITE.z0), (HQ_SITE.x1 - HQ_SITE.x0) * PPM, (HQ_SITE.z1 - HQ_SITE.z0) * PPM);
  ctx.fillStyle = '#2b2e31';
  ctx.fillRect(X(COURT.x0 - 1), Z(COURT.z0 - 1), (COURT.x1 - COURT.x0 + 2) * PPM, (COURT.z1 - COURT.z0 + 2) * PPM);
  ctx.fillStyle = '#d9ae76';
  ctx.fillRect(X(COURT.x0), Z(COURT.z0), (COURT.x1 - COURT.x0) * PPM, (COURT.z1 - COURT.z0) * PPM);
  ctx.fillStyle = '#b92d28';
  ctx.fillRect(X(COURT.x0), Z(RIM.z - 2.45), 5.8 * PPM, 4.9 * PPM);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const courtSide = Math.min((COURT.z1 - COURT.z0) / 2 - 0.9, 6.7);
  ctx.arc(X(RIM.x), Z(RIM.z), 6.75 * PPM, -Math.asin(courtSide / 6.75), Math.asin(courtSide / 6.75));
  ctx.stroke();
  ctx.strokeRect(X(COURT.x0), Z(COURT.z0), (COURT.x1 - COURT.x0) * PPM, (COURT.z1 - COURT.z0) * PPM);
}

// The moving parts the engine does not know about: the Vertec in the gym
// (jump beside it and the vanes swing) and the sailboat rocking at the pier.
export function setup({ stage, world, player, avatar, sound }) {
  const vertec = createVertec({ avatar, sound });
  const aima = HQ.enabled ? setupAima({ stage }) : null;
  stage.scene.add(vertec.mesh);
  return {
    update(dt) {
      vertec.update(dt, player);
      world.outer.update(dt, stage.camera);
      aima?.update(dt);
    },
  };
}
