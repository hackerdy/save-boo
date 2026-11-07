// Headless full playthrough used for docs/TEST_REPORT.md.
// Usage (needs playwright installed somewhere resolvable, not a project dependency):
//   npm run build && node scripts/playthrough.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href;
// Screenshots go to a gitignored folder; copy a handful into docs/screenshots by hand.
const shots = path.join(root, '.playthrough-shots');
const mode = process.argv[2] || 'desktop'; // desktop | mobile | nowebgl

fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const ctx = await browser.newContext(mode === 'mobile'
  ? { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1280, height: 760 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
if (mode === 'nowebgl') {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : orig.call(this, t, ...a); };
  });
}
const shot = async (n) => { await page.waitForTimeout(700); await page.screenshot({ path: path.join(shots, `${mode}-${n}.png`) }); console.log('shot', n); };
const log = (...a) => console.log(...a);

await page.goto(url);
await page.waitForSelector('#begin');
log('3D canvas ready:', await page.evaluate(() => document.getElementById('scene').dataset.ready === '1'));
await shot('01-intro');

await page.click('#begin');
await page.waitForSelector('.skip', { timeout: 3000 }).catch(() => {});
await shot('02-greeting');
await page.click('.skip').catch(() => {});

// 1 runaway checkbox
await page.waitForSelector('.fake-captcha');
for (let i = 0; i < 6; i++) { await page.dispatchEvent('.fake-captcha', 'pointerdown'); await page.waitForTimeout(250); }
await shot('03-challenge1');
await page.click('.fake-captcha .box');
await page.waitForSelector('#nextBtn');
await shot('04-pass1');
await page.click('#nextBtn');

// 2 grid, wrong first then right
await page.waitForSelector('.tile');
await page.click('#verify');
await page.waitForTimeout(300);
await shot('05-fail-angry');
const tiles = await page.$$eval('.tile', (els) => els.map((e) => e.textContent));
for (let i = 0; i < tiles.length; i++) if (['🧑', '👩', '👨', '🧓'].includes(tiles[i])) await page.click(`.tile:nth-child(${i + 1})`);
await page.click('#verify');
await page.waitForSelector('#nextBtn'); await page.click('#nextBtn');

// 3 text
await page.waitForSelector('#ans');
const word = await page.getAttribute('.wobble', 'data-word');
await shot('06-challenge3');
await page.fill('#ans', word); await page.click('#go');
await page.waitForSelector('#nextBtn'); await page.click('#nextBtn');

// 4 breathe
await page.waitForSelector('#breathBtn');
const b = await page.locator('#breathBtn').boundingBox();
for (let i = 0; i < 2; i++) {
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await page.waitForTimeout(2800);
  if (i === 0) await shot('07-challenge4');
  await page.mouse.up(); await page.waitForTimeout(300);
}
await page.waitForSelector('#nextBtn'); await page.click('#nextBtn');

// 5 heartbeat
await page.waitForSelector('#tap');
for (let i = 0; i < 5; i++) { await page.click('#tap'); await page.waitForTimeout(800); }
await page.waitForSelector('#nextBtn'); await shot('08-pass5'); await page.click('#nextBtn');

// 6 confess
await page.waitForSelector('#secret');
await page.fill('#secret', 'I once waved back at someone who was waving at a person behind me.');
await page.click('#confess');
await page.waitForSelector('#nextBtn', { timeout: 40000 });
await page.click('#nextBtn');

await page.waitForTimeout(2800);
await shot('09-finale-burst');
await page.waitForSelector('#again', { timeout: 40000 });
await shot('10-finale-done');

// mute behaviour
await page.click('#muteBtn');
log('muted flag:', await page.evaluate(() => localStorage.getItem('saveBooMuted')), 'aria-pressed:', await page.getAttribute('#muteBtn', 'aria-pressed'));
await page.click('#muteBtn');
log('unmuted flag:', await page.evaluate(() => localStorage.getItem('saveBooMuted')));

await page.click('#again');
await page.waitForSelector('#begin');
log('replay reset ok');
log('console errors/warnings:', errors.length ? errors : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
