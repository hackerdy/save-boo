// Save Boo — a "prove you're human" Halloween game
const $ = (s) => document.querySelector(s);
const speech = $('#speech');
const chal = $('#challenge');
const baby = $('#babySvg');
const grandMouth = $('#grandMouth');
let step = 0;
let timers = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => Math.random() * (b - a) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function say(text) { speech.textContent = '👻 ' + text; }
function mood(m) {
  // m: 'happy' | 'angry' | 'neutral'
  const d = { happy: 'M45 96 q15 14 30 0', angry: 'M45 104 q15 -14 30 0', neutral: 'M45 98 q15 -10 30 0' }[m];
  grandMouth.setAttribute('d', d);
  if (m === 'angry') sfx.play('buzz');
}
function shake() {
  const g = $('#grand');
  g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake');
}
function clearTimers() {
  timers.forEach((t) => (t && t.clear ? t.clear() : (clearInterval(t), clearTimeout(t))));
  timers = [];
}

function updateProgress(total) {
  $('#progress').innerHTML = '';
  for (let i = 0; i < total; i++) {
    const s = document.createElement('span');
    if (i < step) s.className = 'done';
    else if (i === step) s.className = 'now';
    $('#progress').appendChild(s);
  }
  const p = step / total;
  const body = baby.querySelector('.body');
  body.style.opacity = 0.15 + 0.85 * p;
  body.style.filter = `drop-shadow(0 0 ${p * 18}px rgba(255,170,200,${p}))`;
  body.style.fill = p > 0.99 ? '#ffe0ec' : '#fff';
}

/* ---------- Challenges ---------- */

// 1. The Runaway Checkbox
function cRunaway(done) {
  let dodges = 0;
  const need = 6;
  chal.innerHTML = `<h2>Challenge 1: The Sacred Checkbox</h2><div class="fake-captcha"><div class="box"></div><span>I am not a ghost</span></div>`;
  say("Simply tick the box. Humans do this thousands of times a day. Easy!");
  const cap = chal.querySelector('.fake-captcha');
  const box = cap.querySelector('.box');
  const flee = () => {
    const r = chal.getBoundingClientRect();
    cap.style.left = rand(0, r.width - cap.offsetWidth - 10) + 'px';
    cap.style.top = rand(40, r.height - cap.offsetHeight - 10) + 'px';
  };
  const react = (e) => {
    if (dodges >= need) return;
    dodges++;
    sfx.play('dodge');
    flee();
    shake();
    if (dodges === 3) say("Hm, it seems nervous. Ghosts are like that. Are YOU nervous, ghost?");
    if (dodges === need) { say("...Fine. The checkbox is tired. Tick it."); mood('neutral'); }
  };
  cap.addEventListener('mouseenter', react);
  cap.addEventListener('pointerdown', (e) => { if (dodges < need) { e.preventDefault(); react(); } });
  box.addEventListener('click', () => {
    if (dodges < need) return;
    box.textContent = '✔';
    done("Acceptable. Ticking boxes: the most human thing there is.");
  });
}

// 2. Select all humans
function cGrid(done) {
  const humans = ['🧑', '👩', '👨', '🧓'];
  const others = ['🧟', '🧛', '🤖', '🎃', '💀', '🐕', '🧙', '🦇', '👽', '🧜'];
  const tiles = [...humans.slice(0, 3 + Math.floor(Math.random() * 2))];
  while (tiles.length < 9) tiles.push(pick(others));
  tiles.sort(() => Math.random() - 0.5);
  const target = new Set(tiles.map((t, i) => (humans.includes(t) ? i : -1)).filter((i) => i >= 0));
  chal.innerHTML = `<h2>Challenge 2: Select all squares with a HUMAN</h2><div class="grid">${tiles.map((t, i) => `<div class="tile" data-i="${i}">${t}</div>`).join('')}</div><div class="center"><button id="verify">VERIFY</button></div>`;
  say("Pick every human. Vampires don't count, I don't care how much they say they 'identify as human'.");
  const sel = new Set();
  chal.querySelectorAll('.tile').forEach((t) => t.addEventListener('click', () => {
    const i = +t.dataset.i;
    sel.has(i) ? sel.delete(i) : sel.add(i);
    t.classList.toggle('sel');
  }));
  $('#verify').onclick = () => {
    const ok = sel.size === target.size && [...sel].every((i) => target.has(i));
    if (ok) return done("Correct. I was SURE you'd pick the zombie. Disappointed. Impressed.");
    mood('angry'); shake();
    say("WRONG. Maybe you ARE a ghost. Try again, spooky.");
  };
}

// 3. Wobbly text
function cText(done) {
  const words = ['BOOKEEPER', 'SPOOKY', 'CANDLES', 'COBWEB', 'PUMPKIN', 'WITCHES', 'MIDNIGHT', 'GRAVEYARD'];
  const word = pick(words);
  chal.innerHTML = `<h2>Challenge 3: Read the cursed text</h2><div class="wobble">${[...word].map((c, i) => `<span style="animation-delay:${-i * 0.2}s">${c}</span>`).join('')}</div><input type="text" id="ans" placeholder="Type what you see" autocomplete="off" /><p class="center"><button id="go">SUBMIT</button></p>`;
  say("Read the letters. If you squint like a human, they stop moving. (They don't.)");
  const submit = () => {
    if ($('#ans').value.trim().toUpperCase() === word) return done("You can read! Humans love reading. And complaining about reading.");
    mood('angry'); shake(); say("Nope. Was it the squiggly bit? It's always the squiggly bit.");
    $('#ans').value = '';
  };
  $('#go').onclick = submit;
  $('#ans').addEventListener('keydown', (e) => e.key === 'Enter' && submit());
}

// 4. Breathe
function cBreathe(done) {
  let cycles = 0;
  const need = 2;
  let holdStart = 0, full = false, raf;
  chal.innerHTML = `<h2>Challenge 4: Prove you breathe</h2><div class="center"><div class="meter"><div id="bar"></div></div><p id="breathMsg">Hold the button to INHALE.</p><button id="breathBtn">🫁 Hold to inhale</button></div>`;
  say("Humans breathe in... and out. Do it twice. I'll be watching. Creepily.");
  const btn = $('#breathBtn'), bar = $('#bar'), msg = $('#breathMsg');
  const tick = () => {
    if (!holdStart) return;
    const p = Math.min((performance.now() - holdStart) / 2500, 1);
    bar.style.width = p * 100 + '%';
    if (p >= 1 && !full) { full = true; msg.textContent = 'Now EXHALE — let go slowly...'; }
    raf = requestAnimationFrame(tick);
  };
  const start = (e) => { e.preventDefault(); holdStart = performance.now(); full = false; sfx.play('inhale'); msg.textContent = 'Inhaling...'; tick(); };
  const end = () => {
    if (!holdStart) return;
    cancelAnimationFrame(raf);
    holdStart = 0;
    if (full) {
      sfx.play('exhale');
      cycles++;
      bar.style.width = '0%';
      if (cycles >= need) return done("Oxygen detected. Suspicious, but acceptable.");
      msg.textContent = `Good. ${need - cycles} more breath to go.`;
    } else {
      bar.style.width = '0%';
      msg.textContent = 'Too short! That was a hiccup, not a breath.';
      mood('angry');
    }
  };
  btn.addEventListener('pointerdown', start);
  window.addEventListener('pointerup', end);
  timers.push({ clear: () => window.removeEventListener('pointerup', end) });
}

// 5. Heartbeat
function cHeart(done) {
  let taps = [];
  chal.innerHTML = `<h2>Challenge 5: Show me your heartbeat</h2><div class="center"><div class="big" id="heart">❤️</div><p id="hMsg">Tap the heart 5 times in a steady rhythm.</p><button id="tap">TAP 💓</button></div>`;
  say("Humans have a rhythm. Tap it out. Not too fast (panicking), not too slow (dead — well, I'd be fine with that).");
  const msg = $('#hMsg'), heart = $('#heart');
  $('#tap').onclick = () => {
    sfx.play('thump');
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 1600) taps = [];
    taps.push(now);
    heart.style.transform = 'scale(1.4)'; setTimeout(() => (heart.style.transform = ''), 120);
    if (taps.length < 5) { msg.textContent = `${taps.length}/5...`; return; }
    const gaps = taps.slice(1).map((t, i) => t - taps[i]);
    const avg = gaps.reduce((a, b) => a + b) / gaps.length;
    const steady = gaps.every((g) => Math.abs(g - avg) / avg < 0.3);
    const bpm = Math.round(60000 / avg);
    taps = [];
    if (steady && bpm >= 45 && bpm <= 140) return done(`${bpm} BPM. A real human heart! Gross. Beautiful.`);
    mood('angry'); shake();
    msg.textContent = steady ? `${bpm} BPM? Are you a hummingbird or a rock?` : 'That rhythm is all over the place. Try again.';
    say(steady ? 'Between 45 and 140 BPM, please.' : "Irregular! Do you need a doctor or an exorcist?");
  };
}

// 6. Embarrassing secret
function cSecret(done) {
  chal.innerHTML = `<h2>Final Challenge: Confess</h2><textarea id="secret" rows="4" placeholder="Tell me your most human, embarrassing secret..."></textarea><p class="center"><button id="confess">CONFESS</button></p>`;
  say("Last one. Only humans feel shame. Tell me something embarrassing. Be specific.");
  $('#confess').onclick = async () => {
    const v = $('#secret').value.trim();
    if (v.length < 20) { mood('angry'); shake(); say("That's not embarrassing, that's a tweet. MORE. At least 20 characters of shame."); return; }
    $('#confess').disabled = true;
    say('Hmmmm... analyzing shame levels...'); await sleep(1200);
    say(`"${v.slice(0, 40)}${v.length > 40 ? '…' : ''}" ...yes. That's the cringiest thing I've ever heard.`); await sleep(1800);
    done("SO. HUMAN.");
  };
}

/* ---------- Flow ---------- */
const challenges = [cRunaway, cGrid, cText, cBreathe, cHeart, cSecret];

async function start() {
  step = 0; clearTimers(); updateProgress(challenges.length);
  chal.innerHTML = `<div class="center"><p style="font-size:18px">Oh no! Little Boo has faded away. Only a verified <b>human</b> can bring her back to life.</p><button id="begin">Begin the Trials</button></div>`;
  mood('neutral');
  say("Greetings, mortal. Or ghost pretending to be mortal. My granddaughter Boo is fading. Prove you're human to save her. No pressure. (Lots of pressure.)");
  $('#begin').onclick = () => { sfx.unlock(); next(); };
}

function next() {
  clearTimers();
  if (step >= challenges.length) return finale();
  updateProgress(challenges.length);
  mood('neutral');
  challenges[step](onPass);
}

async function onPass(msg) {
  step++;
  mood('happy');
  sfx.play('chime');
  updateProgress(challenges.length);
  say(msg);
  chal.innerHTML = `<div class="center"><p class="big">✅</p><button id="nextBtn">${step >= challenges.length ? 'Wake up Boo!' : 'Next trial →'}</button></div>`;
  $('#nextBtn').onclick = next;
}

function confetti() {
  const e = ['🎃', '👻', '🦇', '✨', '🍬', '💖'];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('div');
    c.className = 'confetti'; c.textContent = pick(e);
    c.style.left = rand(0, 100) + 'vw'; c.style.animationDelay = rand(0, 1.5) + 's';
    document.body.appendChild(c); setTimeout(() => c.remove(), 6000);
  }
}

async function finale() {
  updateProgress(challenges.length);
  baby.querySelector('.body').style.fill = '#ffe0ec';
  $('#babyMouth').setAttribute('ry', '7');
  mood('happy');
  say("You… you actually did it. Boo? BOO?!");
  chal.innerHTML = `<div class="center big">✨</div>`;
  await sleep(2200);
  confetti();
  sfx.play('fanfare');
  say('"Gaga?" — Boo is ALIVE! Thank you, human. (Probably.)');
  chal.innerHTML = `<div class="center"><p class="big">🎉👻🎉</p><p>Boo has been revived thanks to your humanity.</p><p style="opacity:.7;font-size:14px">Mortimer's secret: there was no verification. He just wanted to see how far a human would go for a baby ghost. Which, frankly, is the most human thing of all.</p><button id="again">Play again</button></div>`;
  $('#again').onclick = start;
}

start();
