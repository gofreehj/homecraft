#!/usr/bin/env node
// Mirror the monorepo into a temporary directory, stage the workcraft site
// there, and sync the result to a deployment directory.
//
//   node tools/deploy-mirror.mjs <target>
//
// For the hosting repository only. The target must be a dedicated output
// directory. Files listed in the previous .deploy-manifest.json that are no
// longer produced are removed; files this tool never managed are left alone.
// No dependencies beyond Node 22.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '..');
const repo = resolve(site, '..');
const targetArg = process.argv[2];
if (!targetArg || targetArg.startsWith('--')) throw new Error('usage: node tools/deploy-mirror.mjs <target>');
const target = resolve(process.cwd(), targetArg);

// Refuse targets whose deletion would damage the source tree or a repository.
if (target === parse(target).root || target === repo || target === site) throw new Error(`refusing to use ${target} as the target directory`);
if (existsSync(join(target, '.git'))) throw new Error(`${target} looks like a git repository; choose a dedicated output directory`);
if (existsSync(target) && !statSync(target).isDirectory()) throw new Error(`${target} is not a directory`);
const fromTarget = relative(target, repo);
if (!fromTarget.startsWith('..') && !isAbsolute(fromTarget)) throw new Error(`refusing to write above ${repo}`);
for (const dir of [join(repo, 'engine'), join(repo, 'vendor')]) {
  const rel = relative(dir, target);
  if (!rel.startsWith('..') && !isAbsolute(rel)) throw new Error(`refusing to write inside ${dir}`);
}

const temp = mkdtempSync(join(tmpdir(), 'homecraft-deploy-'));
const manifestName = '.deploy-manifest.json';

try {
  const mirror = join(temp, 'repo');
  mkdirSync(mirror, { recursive: true });
  const workcraft = join(mirror, 'workcraft');
  const skipLocal = src => {
    const rel = relative(site, src).split(sep).join('/');
    return rel !== 'dist' && !rel.startsWith('dist/')
      && rel !== 'tools/.check' && !rel.startsWith('tools/.check/')
      && rel !== '.git' && !rel.startsWith('.git/')
      && rel !== 'node_modules' && !rel.startsWith('node_modules/');
  };
  cpSync(site, workcraft, { recursive: true, filter: skipLocal });

  for (const item of ['engine', 'vendor']) {
    const from = join(repo, item);
    if (!existsSync(from)) throw new Error(`${item}/ is missing at the repository root`);
    cpSync(from, join(mirror, item), {
      recursive: true,
      filter: src => {
        const rel = relative(from, src).split(sep).join('/');
        return rel !== '.git' && !rel.startsWith('.git/') && rel !== 'node_modules' && !rel.startsWith('node_modules/');
      },
    });
  }

  const stage = join(workcraft, 'tools/stage.mjs');
  if (!existsSync(stage)) throw new Error(`staging script missing: ${stage}`);
  const staged = join(temp, 'site');
  execFileSync(process.execPath, [stage, '--out', staged, '--quiet'], { cwd: mirror, stdio: 'inherit' });

  const manifestPath = join(target, manifestName);
  let previous = [];
  if (existsSync(manifestPath)) {
    try {
      const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (Array.isArray(parsed)) previous = parsed;
    } catch { /* an invalid manifest only means no stale files are known */ }
  }

  const next = listFiles(staged);
  const nextSet = new Set(next);
  let removed = 0;
  for (const rel of previous) {
    if (typeof rel !== 'string' || nextSet.has(rel)) continue;
    const path = resolve(target, rel);
    if (!relative(target, path).startsWith('..') && existsSync(path) && statSync(path).isFile()) {
      rmSync(path, { force: true });
      removed += 1;
    }
  }
  pruneEmptyDirs(target);
  mkdirSync(target, { recursive: true });
  cpSync(staged, target, { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`[deploy] ${next.length} files -> ${target}`);
  if (removed) console.log(`[deploy] removed ${removed} stale files`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

function listFiles(root) {
  const files = [];
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else files.push(relative(root, path).split(sep).join('/'));
    }
  };
  walk(root);
  return files.sort();
}

function pruneEmptyDirs(root) {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(root, entry.name);
    pruneEmptyDirs(path);
    if (readdirSync(path).length === 0) rmSync(path, { recursive: true, force: true });
  }
}
