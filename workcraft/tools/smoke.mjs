#!/usr/bin/env node
// Boot the staged site in a headless browser at desktop and phone size.
//
//   node tools/stage.mjs && node tools/smoke.mjs
//
// It clicks through the cover, waits for the engine, fails on startup errors,
// missing assets or console errors, and saves screenshots to tools/.check/.
// Like the repository's tools/check.mjs, frame times here are this computer's,
// not a phone's.
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDir } from './server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.log('Nothing is staged yet: run node tools/stage.mjs first.');
  process.exit(1);
}

const { chromium } = await import('playwright').catch(() => {
  console.log('The smoke test needs Playwright: run npm install in the repository root once.');
  process.exit(1);
});

const out = join(here, '.check');
mkdirSync(out, { recursive: true });

const gpu = process.platform === 'darwin'
  ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const VIEWS = [
  { name: 'computer', viewport: { width: 1280, height: 800 } },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
];

const { url, close } = await serveDir(dist, 0);
let browser, failed = false;
try {
  browser = await chromium.launch({ channel: 'chrome', args: gpu });
} catch {
  browser = await chromium.launch({ args: gpu });
}

for (const view of VIEWS) {
  const context = await browser.newContext(view);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`);
  });

  console.log(`\n${view.name}: ${url}`);
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.locator('[data-enter]').first().click();
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 90000 });
    const startup = await page.evaluate(() => window.__homeStartupError || null);
    if (startup) throw new Error(`${startup.phase || 'startup'}: ${startup.message || 'unknown error'}`);

    // The opening shot hides the HUD until it ends; capture it before cutting
    // it short so the check covers the radar, Dock and cards a visitor uses.
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(out, `${view.name}-intro.png`) });
    const introStats = await page.evaluate(() => __home.stats());
    console.log(`  intro: ${introStats.calls} draw calls, ${introStats.triangles} triangles`);
    await page.evaluate(() => __home.rig?.skipIntro?.());
    // The engine clamps dt to 50 ms, so a software renderer needs many frames
    // to finish the intro swoop; wait for the shot to end, not a wall time.
    await page.waitForFunction(() => !__home.rig.introActive, null, { timeout: 30000 });
    await page.waitForTimeout(300);
    const report = await page.evaluate(() => ({
      stats: __home.stats(),
      pages: document.querySelectorAll('#pages .page[data-station]').length,
      dock: [...document.querySelectorAll('#hotbar [data-station]')].map(el => el.dataset.station),
      plate: typeof window.__homePlate,
    }));
    console.log(`  pages ${report.pages}, dock ${report.dock.join(', ')}, __homePlate ${report.plate}`);
    console.log(`  ${report.stats.calls} draw calls, ${report.stats.triangles} triangles, ${report.stats.frameMs} ms/frame`);

    await page.screenshot({ path: join(out, `${view.name}.png`) });
    await page.evaluate(() => __home.go('about'));
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(out, `${view.name}-about.png`) });
    if (!report.dock.includes('lab')) throw new Error('the showroom is missing from the Dock');
    if (report.plate !== 'function') throw new Error('window.__homePlate is missing: the plate patch did not run');

    // The plate path end to end: engine passes the id, cover.js shows the sheet.
    const vehicle = await page.evaluate(() => {
      window.__homePlate('luna');
      const sheet = document.getElementById('vehicleSheet');
      return { open: !!sheet && !sheet.hidden, name: sheet?.querySelector('.vsheet-name')?.textContent || '' };
    });
    if (!vehicle.open || !vehicle.name) throw new Error('the vehicle detail sheet did not open');
    console.log(`  vehicle sheet: ${vehicle.name}`);
    await page.keyboard.press('Escape');

    // The Aima campus loads on approach; teleport to the bridge and wait for
    // the model before framing it.
    await page.evaluate(() => __home.player.teleport(58, -9.5));
    await page.waitForFunction(() => window.__aimaLoaded, null, { timeout: 60000 });
    await page.evaluate(() => __home.rig.showcase([25, 62, 105], [100, 32, -8]));
    // Same 50 ms clamp: allow the 0.9 s glide to reach its goal on a slow GPU.
    await page.waitForTimeout(4500);
    const office = await page.evaluate(() => __home.stats());
    console.log(`  office: ${office.calls} draw calls, ${office.triangles} triangles, ${office.frameMs} ms/frame`);
    await page.screenshot({ path: join(out, `${view.name}-office.png`) });

    // The phone's app tiles, including the Feishu icon this site adds.
    await page.keyboard.press('p');
    await page.waitForTimeout(800);
    const phone = await page.evaluate(() => {
      const apps = [...document.querySelectorAll('#phone .apps .app')].map(el => ({
        name: el.querySelector(':scope > span')?.textContent.trim(),
        bg: el.querySelector('.tile')?.style.backgroundImage || '',
      }));
      return { up: document.body.classList.contains('phone-on'), apps };
    });
    if (!phone.up) throw new Error('the phone did not open');
    const urls = phone.apps.map(app => app.bg.replace(/^url\(["']?|["']?\)$/g, '')).filter(Boolean);
    const loaded = await page.evaluate(async list => Promise.all(list.map(src => new Promise(ok => {
      const img = new Image();
      img.onload = () => ok({ src, ok: true });
      img.onerror = () => ok({ src, ok: false });
      img.src = src;
    }))), urls);
    const broken = loaded.filter(item => !item.ok).map(item => item.src);
    if (broken.length) throw new Error(`phone icons failed to load: ${broken.join(', ')}`);
    if (!phone.apps.some(app => app.bg.includes('feishu'))) throw new Error('the Feishu tile is missing from the phone');
    console.log(`  phone apps: ${phone.apps.map(app => app.name).join(', ')}; Feishu icon loaded`);
    await page.screenshot({ path: join(out, `${view.name}-phone.png`) });
  } catch (error) {
    failed = true;
    console.error(`  failed: ${error.message}`);
  }

  if (errors.length) {
    failed = true;
    for (const error of [...new Set(errors)]) console.error(`  ${error}`);
  }
  await context.close();
}

await browser.close();
await close();
console.log(`\nscreenshots: ${out}`);
process.exit(failed ? 1 : 0);
