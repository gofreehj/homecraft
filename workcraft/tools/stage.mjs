#!/usr/bin/env node
// Stage this site into a standalone application root, then bundle the engine.
//
// The repository holds this site in workcraft/ next to the shared engine/, the
// same way examples/terry-home does. Hosting wants a site at the application
// root, so this copies the site, engine/ and vendor/ into the output directory,
// applies this site's engine patches there, rewrites module paths, and bundles
// engine/main.js into engine/world-3d.js.
//
//   node tools/stage.mjs                    build workcraft/dist/
//   node tools/stage.mjs --out <dir>        build into another directory
//   node tools/stage.mjs --quiet            print errors and the output path only
//   node tools/stage.mjs --serve            build, then serve the output
//
// The repository's engine/ is never modified. Deploy the output as the site root.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyEnginePatches } from './engine-patch.mjs';
import { serveDir } from './server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '..');
const repo = resolve(site, '..');
const ESBUILD = '0.25.10';
const TARGET = 'chrome89,edge89,firefox108,safari16.4,ios16.4';

// Everything the deployed site needs, relative to workcraft/. Add new top-level
// files and folders here; the output is rebuilt from scratch on every run.
const ITEMS = ['index.html', 'cover.js', 'content.js', 'home.config.js', 'homecraft.json', 'routes.json', 'thumbnail.png', 'assets', 'world'];

// CLI. --out is resolved from the current directory; its default stays inside
// workcraft/, so the command works unchanged from any cwd.
const argv = process.argv.slice(2);
const flag = name => argv.includes(name);
const value = name => {
  const at = argv.indexOf(name);
  if (at < 0) return null;
  const next = argv[at + 1];
  if (!next || next.startsWith('--')) throw new Error(`${name} needs a value`);
  return next;
};
const outArg = value('--out');
const out = outArg ? resolve(process.cwd(), outArg) : join(site, 'dist');
const quiet = flag('--quiet');

// Refuse the paths whose deletion would damage the source tree. A custom
// output directory must be a dedicated build directory.
const outRoot = parse(out).root;
if (out === outRoot || out === repo || out === site) throw new Error(`refusing to use ${out} as the output directory`);
if (existsSync(out) && !statSync(out).isDirectory()) throw new Error(`${out} is not a directory`);
for (const dir of [join(repo, 'engine'), join(repo, 'vendor')]) {
  const rel = relative(dir, out);
  if (!rel.startsWith('..') && !isAbsolute(rel)) throw new Error(`refusing to write inside ${dir}`);
}
const fromOut = relative(out, repo);
if (!fromOut.startsWith('..') && !isAbsolute(fromOut)) throw new Error(`refusing to write above ${repo}`);
for (const item of ['assets', 'world', 'tools', '.spark', 'vendor-additions', 'engine-additions']) {
  const dir = join(site, item);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
  const rel = relative(dir, out);
  if (!rel.startsWith('..') && !isAbsolute(rel)) throw new Error(`refusing to write inside ${dir}`);
}

const log = message => { if (!quiet) console.log(`[stage] ${message}`); };
const bytes = n => `${(n / 1024).toFixed(1)} KB`;

// Entries that staging handles on purpose or that never ship. Anything else at
// the top level is likely a forgotten ITEMS entry, so warn instead of silently
// dropping it from the deployed site.
const NOT_DEPLOYED = new Set(['tools', 'README.md', '.gitignore', 'dist', '.spark', 'vendor-additions', 'engine-additions']);
const unstaged = readdirSync(site).filter(name => !ITEMS.includes(name) && !NOT_DEPLOYED.has(name));
if (unstaged.length) log(`warning: not in ITEMS and not deployed: ${unstaged.join(', ')}`);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const item of ITEMS) {
  const from = join(site, item);
  if (!existsSync(from)) throw new Error(`${item} is missing; update ITEMS in tools/stage.mjs`);
  cpSync(from, join(out, item), { recursive: true });
}

// Miaoda application metadata travels with the app, minus its local state.
if (existsSync(join(site, '.spark', 'meta.json'))) {
  mkdirSync(join(out, '.spark'), { recursive: true });
  cpSync(join(site, '.spark', 'meta.json'), join(out, '.spark', 'meta.json'));
}

// Shared engine and three.js, copied without their local changes.
for (const item of ['engine', 'vendor']) {
  const from = join(repo, item);
  if (!existsSync(from)) throw new Error(`${item}/ is missing at the repository root`);
  cpSync(from, join(out, item), { recursive: true });
}

// Site-specific three.js addons: the glTF loader and its helper live here, not
// in the shared vendor/, so the repository's vendor stays upstream-identical.
const addons = join(site, 'vendor-additions');
if (existsSync(addons)) cpSync(addons, join(out, 'vendor'), { recursive: true });

const version = JSON.parse(readFileSync(join(repo, 'engine/manifest.json'), 'utf8')).version;
applyEnginePatches(join(out, 'engine'));
log(`engine ${version} patched`);

// Files this site adds to the engine (the Feishu app icon, for example).
const additions = join(site, 'engine-additions');
if (existsSync(additions)) {
  for (const entry of readdirSync(additions)) cpSync(join(additions, entry), join(out, 'engine', entry), { recursive: true });
}

// Hosting serves the site at the application root, so the source's paths into
// the sibling engine/ have to lose one level.
const index = join(out, 'index.html');
writeFileSync(index, readFileSync(index, 'utf8').replaceAll('href="../engine/', 'href="engine/'));

// Bundle: esbuild needs file paths, not the import map. Rewrite the site's
// aliases to relative paths first; three stays a package alias.
rewriteAliases(out, ['engine', 'world']);

try {
  execSync([
    'npx --yes', `esbuild@${ESBUILD}`, 'engine/main.js',
    '--bundle --format=esm --minify --charset=utf8', `--target=${TARGET}`,
    '--alias:three=./vendor/three/three.module.min.js',
    `--outfile=engine/world-3d.js --log-level=${quiet ? 'error' : 'warning'}`,
  ].join(' '), { cwd: out, stdio: quiet ? ['ignore', 'inherit', 'inherit'] : 'inherit' });
} catch (error) {
  throw new Error(`esbuild failed; the site was not staged. ${error.message}`);
}

const bundle = join(out, 'engine/world-3d.js');
const size = statSync(bundle).size;
writeFileSync(join(out, 'engine/build-info.json'), `${JSON.stringify({
  engine: version,
  esbuild: ESBUILD,
  builtAt: new Date().toISOString(),
  bundle: size,
}, null, 2)}\n`);
log(`bundled engine/world-3d.js (${bytes(size)})`);
log(`output ready: ${relative(repo, out).split(sep).join('/')}/`);
if (quiet) console.log(out);

const serve = flag('--serve');
if (serve) {
  const port = Number(value('--port') ?? 8130);
  if (!Number.isInteger(port) || port < 0) throw new Error('--port needs a non-negative integer');
  const { url } = await serveDir(out, port);
  console.log(`[stage] serving ${url} (Ctrl+C to stop)`);
} else if (!quiet) {
  log('deploy the output as the application root');
}

// Rewrite '@engine/…', '@world/…' and '@config' to relative paths inside the output.
function rewriteAliases(rootDir, dirs) {
  const files = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.js')) files.push(path);
    }
  };
  for (const dir of dirs) walk(join(rootDir, dir));
  const aliases = { '@config': join(rootDir, 'home.config.js') };
  for (const path of files) {
    let text = readFileSync(path, 'utf8');
    text = text.replace(/(\bfrom\s*)(['"])(@engine\/[^'"]+|@world\/[^'"]+|@config)\2/g, (all, lead, quote, spec) => {
      const target = aliases[spec] || join(rootDir, spec.split('/')[0].slice(1), spec.slice(spec.indexOf('/') + 1));
      let rel = relative(dirname(path), target).split(sep).join('/');
      if (!rel.startsWith('.')) rel = `./${rel}`;
      return `${lead}${quote}${rel}${quote}`;
    });
    writeFileSync(path, text);
  }
}
