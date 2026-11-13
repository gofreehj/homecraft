#!/usr/bin/env node
// Bump the workcraft asset cache versions for one release.
//
//   node tools/bump-res.mjs
//
// RES_VER in cover.js and the cover.css/cover.js query strings in index.html
// move to the next release number. content.js has its own counter because its
// content can change independently. Every run increments again; run once per
// release.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');
const coverPath = join(site, 'cover.js');
const indexPath = join(site, 'index.html');

const cover = readFileSync(coverPath, 'utf8');
const index = readFileSync(indexPath, 'utf8');
const changed = [];
const lineAt = (text, offset) => text.slice(0, offset).split('\n').length;

const resMatch = /const RES_VER = (['"])(\d+)\1;/.exec(cover);
if (!resMatch) throw new Error('cover.js: const RES_VER was not found');
const res = Number(resMatch[2]) + 1;
const nextCover = cover.replace(resMatch[0], `const RES_VER = ${resMatch[1]}${res}${resMatch[1]};`);
changed.push(`cover.js:${lineAt(cover, resMatch.index)} RES_VER ${resMatch[2]} -> ${res}`);

function bumpAll(text, label, pattern, value) {
  let count = 0;
  const next = text.replace(pattern, (match, prefix, old, offset) => {
    count += 1;
    changed.push(`index.html:${lineAt(text, offset)} ${label} ${old} -> ${value}`);
    return `${prefix}${value}`;
  });
  if (!count) throw new Error(`index.html: no ${label} version was found`);
  return next;
}

let nextIndex = bumpAll(index, 'assets/cover.css?v=', /(assets\/cover\.css\?v=)(\d+)/g, res);
nextIndex = bumpAll(nextIndex, 'cover.js?v=', /(cover\.js\?v=)(\d+)/g, res);
const contentMatch = /content\.js\?v=(\d+)/.exec(nextIndex);
if (!contentMatch) throw new Error('index.html: no content.js version was found');
const content = Number(contentMatch[1]) + 1;
nextIndex = bumpAll(nextIndex, 'content.js?v=', /(content\.js\?v=)(\d+)/g, content);

writeFileSync(coverPath, nextCover);
writeFileSync(indexPath, nextIndex);

for (const line of changed) console.log(`[bump] ${line}`);
console.log('[bump] each run increments again; run once per release.');
