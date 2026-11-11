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
`npx` on first use. Set `RES_VER` in `cover.js` after a release so browsers and
CDNs drop the old bundle.

Deploy `dist/` as the application root. Nothing outside `dist/` ships.

## Engine patches

The repository's `engine/` matches the official release, so merging upstream
never resolves engine changes. `tools/engine-patch.mjs` lists what this site
adds to the engine:

| File | Change |
|---|---|
| `main.js` | clickable plates (`world.pickables` → `window.__homePlate`) and Dock entries for `page: false` stations |
| `world/world.js` | passes `pickables` from `build()` to `main.js` |
| `ui/phone.js` | resolves app icons from `engine/`, adds the Feishu tile |

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

## Adding files

Add every top-level file or folder the site needs to `ITEMS` in
`tools/stage.mjs`; `dist/` is rebuilt from scratch, so anything not listed is
left out of the deployment.
