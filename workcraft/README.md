# Workcraft Site

This directory is the source of the 3D personal site, kept next to the shared
Homecraft engine the same way `examples/terry-home/` is. It is staged into a
standalone application root before deployment; the repository's `engine/` is
never modified.

## Layout

```
workcraft/
  index.html          cover page and the 3D world's mount points
  cover.js            renders content.js, opens the world on demand
  content.js          all site text and project data
  home.config.js      name, language, Dock, mailbox
  homecraft.json      public site metadata
  routes.json         Miaoda application routes
  assets/             cover styles, images, app icons
  world/              the world: layout, house, furniture, showroom
  assets/models/      the Aima headquarters GLB
  vendor-additions/   three.js addons for this site (glTF loader, meshopt decoder)
  engine-additions/   files this site adds to the engine (Feishu app icon)
  tools/
    engine-patch.mjs  the site's engine patches, as exact anchors
    stage.mjs         build dist/ and bundle the engine
    server.mjs        static server without caching
    smoke.mjs         headless boot check at desktop and phone size
  dist/               generated application root (ignored)
```

Source paths point at the sibling directories (`../engine/style.css`). Staging
copies the site to `dist/`, places `engine/` and `vendor/` inside it, rewrites
those paths, and bundles `engine/main.js` to `dist/engine/world-3d.js`.

The bundle lives under `engine/` on purpose: the engine resolves its own assets
with `new URL('./assets/…', import.meta.url)`, and at `engine/world-3d.js` that
base is still `engine/`.

## Commands

```sh
node tools/stage.mjs            # build dist/
node tools/stage.mjs --serve    # build, then serve dist/ at 127.0.0.1:8130
node tools/smoke.mjs            # headless boot check; screenshots in tools/.check/
node ../tools/check-site.mjs .  # metadata, skin and engine state (no install needed)
```

`stage.mjs` needs Node.js 22 or newer and downloads `esbuild@0.25.10` through
`npx` on first use. Run `node tools/bump-res.mjs` before a release so browsers
and CDNs drop the old bundle.

Deploy `dist/` as the application root. Nothing outside `dist/` ships.

## Aima headquarters

`world/aima.js`, `assets/models/aima-build.glb` and the glTF loader in
`vendor-additions/` come from `feat/aima-headquarters`. The model's site is
about 80×75 m and 71.5 m tall, so it cannot sit on the 74×57 m home island. It
occupies an east campus of its own:

- `HQ_ISLAND` (x 44–135, z −69–27) is a second `buildIsland` call, separated
  from `HOME_ISLAND` by a 6 m channel. `ISLAND` is the union of both and remains
  the engine's grid for navigation, the radar, fog and the opening shot.
- `BRIDGE` (x 38–52, z −11…−6) is a short deck with rails from the east
  driveway to the campus. Its west end meets the house lawn; its east end meets
  the forecourt.
- `HQ.position` is the GLB origin (site centre, ground y = 0) and `HQ.yaw` is
  −π/2. The rotation turns the model's south passage and forecourt west, towards
  the bridge and the house. `aima.js` rotates every local ground-floor
  `FOOTPRINTS` rectangle and point light through the same transform.
- `HQ_SITE` is the rotated paving footprint, drawn on the radar in `build.js`.
  The two 1F passages through the podium stay open; the reflecting pool is
  blocked.

`aima-build.glb` is meshopt-compressed with `KHR_mesh_quantization` (289 KB,
down from 1.7 MB). `aima.js` enables the vendored `MeshoptDecoder` on the
loader. The compression preserves all 15 material names, which `ENV_INTENSITY`
and `NIGHT_GLOW` look up. To rebuild after editing a source GLB, run from
`workcraft/`:

```sh
npx @gltf-transform/cli@4 optimize source.glb assets/models/aima-build.glb --compress meshopt --palette false --simplify false --texture-compress false
```

`--palette false` keeps the materials separate; the palette pass would merge
them and break the per-material reflection and night tuning.

The model loads in the background as soon as `buildAima` runs, so the opening
shot and the bridge view see it without a pop-in; `window.__aimaLoaded` turns
true when it is added to the scene. At the bridge landing, the `office` station
(`at: [58, −9.5]`) has no card and, on F, pulls the camera back over the water
to frame the campus.

To move the campus, change `HQ_ISLAND`, `BRIDGE`, `HQ.position` and `HQ_SITE`
together. To remove it, set `HQ.enabled` to `false`; the campus island, bridge
blocks, office station and radar rectangle are then left unused and should be
removed too.

### Budget notes

The model is 289 KB after meshopt compression, plus the 25 KB decoder; it no
longer exceeds the 500 KB initial-load target by itself, though the engine
bundle still sets the total. It adds 15 draw calls. The settled house view
measures 58 draw calls and the office view 56, within the 60 target. The
opening shot starts close to the Aima forecourt and measures 21 draw calls at
both desktop and phone size; the model accounts for 15 of those calls. The
swoop then crosses the channel to the house. The model returns two point
lights, so with the house's two the engine keeps only the first two and the
campus lights do not render. These are content-size and budget decisions for
the site owner, not engine changes.

## Engine patches

The repository's `engine/` matches the official release, so merging upstream
never resolves engine changes. `tools/engine-patch.mjs` lists what this site
adds to the engine:

| File | Change |
|---|---|
| `main.js` | clickable plates (`world.pickables` → `window.__homePlate`) and Dock entries for `page: false` stations |
| `world/world.js` | passes `pickables` from `build()` to `main.js` |
| `ui/phone.js` | resolves app icons from `engine/`, adds the Feishu tile |
| `ui/icons.js` | resolves the Homecraft logo from `engine/` once bundled |
| `ui/photo.js` | resolves the Homecraft watermark from `engine/` once bundled |

Patches are applied to `dist/engine/` after staging, never to the source tree.
An upstream update that changes those anchors makes staging fail with the file
and the anchor's first line: update the anchor, then run `node tools/smoke.mjs`.

The two features and the Feishu tile belong in the shared engine. Once they are
merged upstream, delete the matching entries here.

## Updating from upstream

```sh
git fetch upstream
git switch main && git merge --ff-only upstream/main
git switch workcraft && git merge main
node workcraft/tools/stage.mjs
node workcraft/tools/smoke.mjs
```

Shared files (`package.json`, `tools/`, `engine/`) are intentionally untouched
on this branch, which keeps merges conflict-free. Commands live in this README
instead of `package.json` for the same reason.

## Deploying to Miaoda

Miaoda takes `workcraft/`, `engine/` and `vendor/` from the monorepo as input
and serves the staged application root, not the source tree. The paths in
`workcraft/index.html` are source paths: `../engine/style.css` is correct and
must not be changed to `engine/style.css` for local preview.

Run the version bump before every release, then preview the staged root from
`workcraft/`:

```sh
node tools/bump-res.mjs
node tools/stage.mjs --serve
```

`bump-res.mjs` increments `RES_VER` and the `cover.css` / `cover.js` query
versions together, and the independent `content.js` counter. Each run
increments again, so run it once per release.

`--out <dir>` writes the staged site somewhere other than `workcraft/dist/`;
relative paths resolve from the current directory. `--quiet` prints only errors
and the final output path. Deploy the output directory as the application root;
do not commit `dist/`.

For the hosting repository only, `deploy-mirror.mjs` mirrors `workcraft/`,
`engine/` and `vendor/` into a temporary monorepo, stages it, and syncs the
result to a dedicated target:

```sh
node tools/deploy-mirror.mjs /tmp/site
```

The target keeps a `.deploy-manifest.json`; files this tool managed on the
previous run and no longer produces are removed. Files it never managed are
left alone.

## Adding files

Add every top-level file or folder the site needs to `ITEMS` in
`tools/stage.mjs`; `dist/` is rebuilt from scratch, so anything not listed is
left out of the deployment.
