import { useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../game/sfx';
import { ChallengeCtx } from '../types';
import { pickLine } from '../game/lines';

type Props = { ctx: ChallengeCtx };
const rand = (a: number, b: number) => Math.random() * (b - a) + a;
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = <T,>(arr: T[]) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const heading = (ctx: ChallengeCtx, title: string) => (ctx.n === ctx.total ? `Final Challenge: ${title}` : `Challenge ${ctx.n}: ${title}`);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// 1. The Runaway Checkbox. Reduced motion: the box stays put and just needs a few presses.
function Runaway({ ctx }: Props) {
  const need = useMemo(() => (ctx.reduced ? 3 : 4 + Math.floor(Math.random() * 3)), []);
  const [dodges, setDodges] = useState(0);
  const [pos, setPos] = useState({ left: 20, top: 70 });
  const [checked, setChecked] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const cap = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  useEffect(() => { ctx.say(pickLine('intro_runaway')); }, []);

  const react = () => {
    if (count.current >= need) return;
    count.current++;
    const n = count.current;
    setDodges(n);
    sfx.play('dodge');
    if (!ctx.reduced && wrap.current && cap.current) {
      const r = wrap.current.getBoundingClientRect();
      const w = cap.current.offsetWidth, h = cap.current.offsetHeight;
      setPos({ left: rand(0, Math.max(0, r.width - w - 10)), top: rand(40, Math.max(41, r.height - h - 10)) });
    }
    ctx.shake();
    if (n === Math.ceil(need / 2)) ctx.say(pickLine('nervous'));
    if (n === need) { ctx.say(pickLine('giveUp')); ctx.mood('neutral'); }
  };
  const tick = () => {
    if (count.current < need || checked) return;
    setChecked(true);
    ctx.pass(pickLine('passGeneric') + ' Ticking boxes: the most human thing there is.');
  };

  return (
    <div ref={wrap} className="runaway" data-challenge="runaway">
      <h2>{heading(ctx, 'The Sacred Checkbox')}</h2>
      <div ref={cap} className={'fake-captcha' + (ctx.reduced ? ' still' : '')} style={ctx.reduced ? undefined : pos}
        onMouseEnter={() => { if (!ctx.reduced) react(); }}
        onPointerDown={(e) => { if (count.current < need) { e.preventDefault(); react(); } }}>
        <div className="box" role="checkbox" aria-checked={checked} aria-label="I am not a ghost" tabIndex={0} autoFocus
          onClick={tick}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (count.current < need) react(); else tick(); }
          }}>{checked ? '✔' : ''}</div>
        <span>I am not a ghost</span>
      </div>
      <span className="sr-only" role="status" id="rMsg">
        {count.current < need ? `The checkbox dodged ${dodges} of ${need} times. Keep trying.` : 'The checkbox gave up. Tick it.'}
      </span>
    </div>
  );
}

// 2. Select all matching squares (three prompt variants)
interface GridVariant { id: string; title: string; targets: string[]; others: string[] }
const GRID_VARIANTS: GridVariant[] = [
  { id: 'human', title: 'Select all squares with a HUMAN', targets: ['🧑', '👩', '👨', '🧓'],
    others: ['🧟', '🧛', '🤖', '🎃', '💀', '🐕', '🧙', '🦇', '👽', '🧜'] },
  { id: 'breakfast', title: 'Select everything a human eats for BREAKFAST', targets: ['🥞', '🥐', '🍳', '☕', '🥣'],
    others: ['🦴', '🎃', '🕯️', '💀', '🔧', '🧪', '🕷️', '🧲', '📜', '🪦'] },
  { id: 'rain', title: 'Select what a human takes out in the RAIN', targets: ['☂️', '🧥', '🥾', '☔'],
    others: ['🔦', '🪓', '🧹', '🎸', '🗝️', '🪞', '📺', '🎈', '🦴', '🕯️'] },
];

function Grid({ ctx }: Props) {
  const variant = useMemo(() => pick(GRID_VARIANTS), []);
  const tiles = useMemo(() => {
    const t = shuffle(variant.targets).slice(0, 3 + Math.floor(Math.random() * 2));
    while (t.length < 9) t.push(pick(variant.others));
    return shuffle(t);
  }, [variant]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  useEffect(() => { ctx.say(pickLine('intro_grid')); }, []);

  const toggle = (i: number) => setSel((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const verify = () => {
    const target = new Set(tiles.map((t, i) => (variant.targets.includes(t) ? i : -1)).filter((i) => i >= 0));
    const ok = sel.size === target.size && [...sel].every((i) => target.has(i));
    if (ok) return ctx.pass(pickLine('passGeneric') + " I was SURE you'd pick the zombie.");
    ctx.fail(pickLine('gridWrong'));
  };
  return (
    <div data-challenge="grid" data-variant={variant.id}>
      <h2>{heading(ctx, variant.title)}</h2>
      <div className="grid" role="group" aria-label={variant.title}>
        {tiles.map((t, i) => (
          <button key={i} type="button" className={'tile' + (sel.has(i) ? ' sel' : '')} aria-pressed={sel.has(i)}
            data-correct={variant.targets.includes(t) ? '1' : '0'} onClick={() => toggle(i)}>{t}</button>
        ))}
      </div>
      <div className="center"><button id="verify" onClick={verify}>VERIFY</button></div>
    </div>
  );
}

// 3. Wobbly text
function CursedText({ ctx }: Props) {
  const word = useMemo(() => pick(['BOOKEEPER', 'SPOOKY', 'CANDLES', 'COBWEB', 'PUMPKIN', 'WITCHES', 'MIDNIGHT', 'GRAVEYARD', 'LANTERN', 'SKELETON']), []);
  const [val, setVal] = useState('');
  useEffect(() => { ctx.say(pickLine('intro_text')); }, []);
  const submit = () => {
    if (val.trim().toUpperCase() === word) return ctx.pass(pickLine('passGeneric') + ' You can read! Humans love reading.');
    ctx.fail(pickLine('textWrong'));
    setVal('');
  };
  return (
    <div data-challenge="text">
      <h2>{heading(ctx, 'Read the cursed text')}</h2>
      <div className="wobble" data-word={word} aria-label={`The letters spell ${word.split('').join(' ')}`} role="img">
        {[...word].map((c, i) => <span key={i} aria-hidden="true" style={{ animationDelay: `${-i * 0.2}s` }}>{c}</span>)}
      </div>
      <input type="text" id="ans" placeholder="Type what you see" aria-label="Type the letters you see" autoComplete="off" autoFocus value={val}
        onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
      <p className="center"><button id="go" onClick={submit}>SUBMIT</button></p>
    </div>
  );
}

// 4. Breathe. Pointer hold or hold Space/Enter.
function Breathe({ ctx }: Props) {
  const need = 2;
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState('Hold the button (or Space) to INHALE.');
  const hold = useRef(0), full = useRef(false), cycles = useRef(0), raf = useRef(0);
  useEffect(() => { ctx.say(pickLine('intro_breathe')); }, []);

  // Gentle curve: each mistake shortens the required inhale a little (2.5s down to 1.6s).
  const holdMs = () => 2500 - Math.min(ctx.fails(), 3) * 300;

  const tick = () => {
    if (!hold.current) return;
    const p = Math.min((performance.now() - hold.current) / holdMs(), 1);
    setPct(p * 100);
    if (p >= 1 && !full.current) { full.current = true; setMsg('Now EXHALE. Let go slowly...'); }
    raf.current = requestAnimationFrame(tick);
  };
  const start = () => {
    if (hold.current) return;
    hold.current = performance.now(); full.current = false;
    sfx.play('inhale'); setMsg('Inhaling...'); tick();
  };
  const endRef = useRef<() => void>(() => {});
  endRef.current = () => {
    if (!hold.current) return;
    cancelAnimationFrame(raf.current);
    hold.current = 0; setPct(0);
    if (full.current) {
      sfx.play('exhale');
      cycles.current++;
      if (cycles.current >= need) return ctx.pass(pickLine('passGeneric') + ' Oxygen detected. Suspicious, but acceptable.');
      setMsg(`Good. ${need - cycles.current} more breath to go.`);
    } else {
      setMsg('Too short! That was a hiccup, not a breath.');
      ctx.fail(pickLine('breathShort'));
    }
  };
  useEffect(() => {
    const end = () => endRef.current();
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => { window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); cancelAnimationFrame(raf.current); };
  }, []);

  const isKey = (e: React.KeyboardEvent) => e.key === ' ' || e.key === 'Enter';
  return (
    <div className="center" data-challenge="breathe">
      <h2>{heading(ctx, 'Prove you breathe')}</h2>
      <div className="meter" role="progressbar" aria-label="Breath" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}><div id="bar" style={{ width: pct + '%' }} /></div>
      <p id="breathMsg" role="status">{msg}</p>
      <button id="breathBtn" className="holdbtn" autoFocus onPointerDown={(e) => { e.preventDefault(); start(); }}
        onKeyDown={(e) => { if (isKey(e)) { e.preventDefault(); if (!e.repeat) start(); } }}
        onKeyUp={(e) => { if (isKey(e)) { e.preventDefault(); endRef.current(); } }}
        onBlur={() => endRef.current()}
        onContextMenu={(e) => e.preventDefault()}>🫁 Hold to inhale</button>
    </div>
  );
}

// 5. Heartbeat (three tempo variants)
interface HeartVariant { id: string; min: number; max: number; prompt: string }
const HEART_VARIANTS: HeartVariant[] = [
  { id: 'any', min: 45, max: 140, prompt: 'Tap the heart 5 times in a steady rhythm.' },
  { id: 'calm', min: 50, max: 80, prompt: 'Tap 5 times at a calm, sleepy pace (50 to 80 BPM).' },
  { id: 'excited', min: 100, max: 140, prompt: 'Tap 5 times like you just saw a ghost (100 to 140 BPM).' },
];

function Heart({ ctx }: Props) {
  const variant = useMemo(() => pick(HEART_VARIANTS), []);
  const taps = useRef<number[]>([]);
  const [msg, setMsg] = useState(variant.prompt);
  const [beat, setBeat] = useState(false);
  useEffect(() => { ctx.say(pickLine('intro_heart') + (variant.id === 'any' ? '' : ' ' + variant.prompt)); }, []);
  const tap = () => {
    sfx.play('thump');
    const now = performance.now();
    const t = taps.current;
    if (t.length && now - t[t.length - 1] > 2000) taps.current = [];
    taps.current.push(now);
    setBeat(true); setTimeout(() => setBeat(false), 120);
    const a = taps.current;
    if (a.length < 5) { setMsg(`${a.length}/5...`); return; }
    const gaps = a.slice(1).map((x, i) => x - a[i]);
    const avg = gaps.reduce((x, y) => x + y) / gaps.length;
    // Gentle curve: tolerance widens after each mistake (30% up to 50%).
    const tol = 0.3 + 0.05 * Math.min(ctx.fails(), 4);
    const steady = gaps.every((g) => Math.abs(g - avg) / avg < tol);
    const bpm = Math.round(60000 / avg);
    taps.current = [];
    if (steady && bpm >= variant.min && bpm <= variant.max) return ctx.pass(`${bpm} BPM. ${pickLine('passGeneric')} A real human heart! Gross. Beautiful.`);
    if (!steady) { setMsg('That rhythm is all over the place. Try again.'); return ctx.fail(pickLine('heartMessy')); }
    setMsg(`${bpm} BPM. Needed ${variant.min} to ${variant.max}. Try again.`);
    ctx.fail(pickLine(bpm > variant.max ? 'heartFast' : 'heartSlow'));
  };
  return (
    <div className="center" data-challenge="heart" data-variant={variant.id} data-bpm-min={variant.min} data-bpm-max={variant.max}>
      <h2>{heading(ctx, 'Show me your heartbeat')}</h2>
      <div className={'big heart' + (beat ? ' beat' : '')} id="heart" aria-hidden="true">❤</div>
      <p id="hMsg" role="status">{msg}</p>
      <button id="tap" className="holdbtn" autoFocus onClick={tap}>TAP 💓</button>
    </div>
  );
}

// 6. Embarrassing secret
const SECRET_PROMPTS = [
  'Tell me your most human, embarrassing secret...',
  'Confess the last thing you Googled that you hope nobody saw...',
  'Describe your most awkward moment in public...',
  'What do you pretend to understand but secretly do not?',
];
function Secret({ ctx }: Props) {
  const prompt = useMemo(() => pick(SECRET_PROMPTS), []);
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { ctx.say(pickLine('intro_secret')); }, []);
  const confess = async () => {
    const s = v.trim();
    if (busy) return;
    if (s.length < 20) { ctx.fail(pickLine('secretShort')); return; }
    setBusy(true);
    await ctx.say(pickLine('secretAnalyze'));
    await sleep(300);
    await ctx.say(`"${s.slice(0, 40)}${s.length > 40 ? '...' : ''}" ${pickLine('secretReact')}`);
    await sleep(300);
    ctx.pass('SO. HUMAN.');
  };
  return (
    <div data-challenge="secret">
      <h2>{heading(ctx, 'Confess')}</h2>
      <textarea id="secret" rows={4} placeholder={prompt} aria-label={prompt} autoFocus value={v} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) confess(); }} />
      <p className="center"><button id="confess" disabled={busy} onClick={confess}>CONFESS</button></p>
    </div>
  );
}

export interface ChallengeDef { id: string; hint: 'hint_runaway' | 'hint_grid' | 'hint_text' | 'hint_breathe' | 'hint_heart' | 'hint_secret'; Component: (p: Props) => JSX.Element }

// The checkbox always opens and the confession always closes; the middle four are shuffled per run.
export const OPENER: ChallengeDef = { id: 'runaway', hint: 'hint_runaway', Component: Runaway };
export const MIDDLE: ChallengeDef[] = [
  { id: 'grid', hint: 'hint_grid', Component: Grid },
  { id: 'text', hint: 'hint_text', Component: CursedText },
  { id: 'breathe', hint: 'hint_breathe', Component: Breathe },
  { id: 'heart', hint: 'hint_heart', Component: Heart },
];
export const CLOSER: ChallengeDef = { id: 'secret', hint: 'hint_secret', Component: Secret };
export const TOTAL = MIDDLE.length + 2;

export const makeRun = (): ChallengeDef[] => [OPENER, ...shuffle(MIDDLE), CLOSER];
