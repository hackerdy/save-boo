// Headless full playthrough used for docs/TEST_REPORT.md.
// Modes: desktop | mobile | nowebgl (pointer run) | keyboard (keyboard only, prefers-reduced-motion emulated).
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
const mode = process.argv[2] || 'desktop'; // desktop | mobile | nowebgl | keyboard
const kb = mode === 'keyboard';
// AI Mortimer network mode (env PLAY_AI): block (default, endpoint unreachable -> scripted fallback),
// mock (endpoint returns canned lines that must show up in subtitles), off (AI toggle off, zero requests).
const aiMode = process.env.PLAY_AI || 'block';

fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const ctx = await browser.newContext(mode === 'mobile'
  ? { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1280, height: 760 }, ...(kb ? { reducedMotion: 'reduce' } : {}) });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => {
  // A blocked AI endpoint logs a failed resource load by design; the game must fall back silently.
  if (aiMode === 'block' && /Failed to load resource/.test(m.text())) return;
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
let aiRequests = 0, aiBodies = [];
await page.route(/text\.pollinations\.ai/, (route) => {
  aiRequests++;
  aiBodies.push(route.request().postData() || '');
  if (aiMode === 'mock') {
    const content = `Canned AI line number ${aiRequests}, brought to you by the mocked ghost network.`;
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ choices: [{ message: { content, reasoning: 'ignored' } }] }) });
  }
  return route.abort('failed');
});
// AI is opt-in. mock/block runs seed an earlier opt-in; off leaves the default and checks it through the UI.
if (aiMode !== 'off') await page.addInitScript(() => { if (!localStorage.getItem('saveBooSettings')) localStorage.setItem('saveBooSettings', JSON.stringify({ aiEnabled: true })); });
await page.addInitScript(() => {
  window.__subs = [];
  const watch = () => {
    const el = document.getElementById('speech');
    if (!el) return setTimeout(watch, 50);
    new MutationObserver(() => window.__subs.push(el.innerText)).observe(el, { childList: true, subtree: true, characterData: true });
  };
  watch();
});
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
if (kb) {
  log('reduced-motion class:', await page.evaluate(() => document.body.classList.contains('reduced-motion')));
  if (!(await page.evaluate(() => document.body.classList.contains('reduced-motion')))) errors.push('reduced-motion not applied');
}
await shot('01-intro');

// Settings via the gear: opens, Escape closes, keyboard skip still works afterwards
await page.click('#settingsBtn');
await page.waitForSelector('[role=dialog][aria-label=Settings]');
// focus trap: Tab never leaves the dialog
for (let i = 0; i < 30; i++) {
  await page.keyboard.press('Tab');
  if (!(await page.evaluate(() => !!document.activeElement.closest('[role=dialog]')))) errors.push('focus escaped settings dialog');
}
if (aiMode === 'off') {
  if (await page.isChecked('#setAi')) errors.push('AI should default to off');
  await page.check('#setAi'); await page.uncheck('#setAi');     // toggle on then off through the UI
}
if (!(await page.isChecked('#setAi')) === (aiMode !== 'off')) errors.push('AI switch state wrong for mode ' + aiMode);
if (aiMode === 'off') log('AI status text:', await page.textContent('#aiStatus'));
await page.keyboard.press('Escape');
if (await page.$('[role=dialog][aria-label=Settings]')) errors.push('settings did not close on Escape');
// Intro choices exist and work
await page.click('#voiceChoice'); await page.click('#voiceChoice');
if (kb) { await page.focus('#begin'); await page.keyboard.press('Enter'); } else { await page.click('#begin'); }
await page.waitForSelector('.skip', { timeout: 3000 }).catch(() => {});
await shot('02-greeting');
if (kb) { await page.keyboard.press('Escape'); } else { await page.click('.skip').catch(() => {}); }

const WORDS = ['🧑', '👩', '👨', '🧓'];
const order = [];
for (let n = 0; n < 6; n++) {
  const sel = await page.waitForSelector('[data-challenge]:not([data-challenge=results])', { timeout: 15000 });
  const id = await sel.getAttribute('data-challenge');
  order.push(id);
  log(`step ${n + 1}: ${id}`);
  if (id === 'runaway') {
    const before = await page.getAttribute('.fake-captcha', 'style');
    if (kb) {
      await page.focus('.fake-captcha .box');
      for (let i = 0; i < 12; i++) {
        const box = await page.$('.fake-captcha .box');
        if (!box) break;
        await page.keyboard.press('Space'); await page.waitForTimeout(150);
        const st = await page.getAttribute('.fake-captcha', 'style', { timeout: 500 }).catch(() => before);
        if (st !== before) errors.push('runaway checkbox moved in reduced motion');
      }
    } else {
      for (let i = 0; i < 8; i++) { await page.dispatchEvent('.fake-captcha', 'pointerdown'); await page.waitForTimeout(250); }
      await shot('03-challenge1');
      await page.click('.fake-captcha .box');
    }
  } else if (id === 'grid') {
    const verify = async () => (kb ? (await page.focus('#verify'), page.keyboard.press('Enter')) : page.click('#verify'));
    await verify(); // wrong first (nothing selected)
    await page.waitForTimeout(300);
    if (!kb) await shot('05-fail-angry');
    const correct = await page.$$eval('.tile', (els) => els.map((e) => e.dataset.correct === '1'));
    for (let i = 0; i < correct.length; i++) {
      if (!correct[i]) continue;
      if (kb) { await page.focus(`.tile:nth-child(${i + 1})`); await page.keyboard.press('Space'); }
      else await page.click(`.tile:nth-child(${i + 1})`);
    }
    await verify();
  } else if (id === 'text') {
    const word = await page.getAttribute('.wobble', 'data-word');
    if (!kb) await shot('06-challenge3');
    if (kb) { await page.focus('#ans'); await page.keyboard.type(word); await page.keyboard.press('Enter'); }
    else { await page.fill('#ans', word); await page.click('#go'); }
  } else if (id === 'breathe') {
    const b = await page.locator('#breathBtn').boundingBox();
    const msgIs = (re) => page.waitForFunction((src) => new RegExp(src).test(document.getElementById('breathMsg')?.innerText || ''), re.source, { timeout: 15000 });
    for (let i = 0; i < 2; i++) {
      // Retry the press until the app reports it is inhaling (slow runners can drop the first event), then
      // hold until it says EXHALE instead of trusting a fixed sleep.
      for (let attempt = 0; ; attempt++) {
        if (kb) { await page.focus('#breathBtn'); await page.keyboard.down('Space'); }
        else { await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); }
        try { await msgIs(/Inhaling|EXHALE/); break; } catch (e) {
          if (kb) await page.keyboard.up('Space'); else await page.mouse.up();
          if (attempt >= 3) throw e;
        }
      }
      await msgIs(/EXHALE/);
      if (i === 0 && !kb) await shot('07-challenge4');
      if (kb) await page.keyboard.up('Space'); else await page.mouse.up();
      await page.waitForTimeout(300);
    }
  } else if (id === 'heart') {
    const min = +(await page.getAttribute('[data-challenge=heart]', 'data-bpm-min'));
    const max = +(await page.getAttribute('[data-challenge=heart]', 'data-bpm-max'));
    const gap = 60000 / ((min + max) / 2);
    if (kb) await page.focus('#tap');
    let t = Date.now();
    for (let i = 0; i < 5; i++) {
      const wait = t - Date.now();
      if (wait > 0) await page.waitForTimeout(wait);
      if (kb) await page.keyboard.press('Enter'); else await page.evaluate(() => document.getElementById('tap').click());
      t += gap;
    }
    // kb: focus stays on #tap (autoFocus)
  } else if (id === 'secret') {
    const text = 'I once waved back at someone who was waving at a person behind me.';
    if (kb) { await page.focus('#secret'); await page.keyboard.type(text); await page.focus('#confess'); await page.keyboard.press('Enter'); }
    else { await page.fill('#secret', text); await page.click('#confess'); }
  }
  await page.waitForSelector('#nextBtn', { timeout: 40000 }).catch(async (e) => {
    console.log('stuck at', id, await page.evaluate(() => document.getElementById('challenge').innerText));
    throw e;
  });
  if (!kb && n === 0) await shot('04-pass1');
  if (n === 4 && !kb) await shot('08-pass5');
  if (kb) await page.keyboard.press('Enter'); else await page.click('#nextBtn');
}
if (order[0] !== 'runaway' || order[5] !== 'secret' || new Set(order).size !== 6) errors.push('bad challenge order: ' + order.join(','));
log('challenge order:', order.join(' > '));

await page.waitForTimeout(2800);
await shot('09-finale-burst');
await page.waitForSelector('#again', { timeout: 40000 });
const rating = await page.textContent('#rating');
log('results:', rating, '|', await page.textContent('#ratingTitle'));
if (!/Humanity Rating: \d+%/.test(rating) || !(await page.$('#share'))) errors.push('results card incomplete');
await page.click('#share');
await page.waitForTimeout(300);
log('share note:', await page.textContent('#shareNote'));
await shot('10-finale-done');

// mute behaviour
await page.click('#muteBtn');
log('muted flag:', await page.evaluate(() => localStorage.getItem('saveBooMuted')), 'aria-pressed:', await page.getAttribute('#muteBtn', 'aria-pressed'));
await page.click('#muteBtn');
log('unmuted flag:', await page.evaluate(() => localStorage.getItem('saveBooMuted')));

const subs = await page.evaluate(() => window.__subs);
const canned = subs.filter((t) => /Canned AI line/.test(t)).length;
log(`AI mode ${aiMode}: ${aiRequests} request(s), ${canned} canned subtitle update(s)`);
if (aiMode === 'mock') {
  if (!canned) errors.push('mocked AI line never reached the subtitles');
  if (!(await page.$('#verdict'))) errors.push('AI verdict missing on results card');
  if (!aiBodies.some((b) => b.includes('I once waved back'))) errors.push('confession text was not sent for the AI reaction');
  if (aiBodies.some((b) => !b.includes('I once waved back') && b.includes('waving at a person'))) errors.push('typed text leaked into a non-confession request');
}
if (aiMode === 'off' && aiRequests) errors.push('AI toggle off but requests were made: ' + aiRequests);
if (aiMode === 'block' && canned) errors.push('canned lines appeared while the AI endpoint was blocked');
await page.click('#again');
await page.waitForSelector('#begin');
log('replay reset ok');
log('console errors/warnings:', errors.length ? errors : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
