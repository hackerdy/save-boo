import { useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../game/sfx';
import { ChallengeCtx } from '../types';

type Props = { ctx: ChallengeCtx };
const rand = (a: number, b: number) => Math.random() * (b - a) + a;
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// 1. The Runaway Checkbox
function Runaway({ ctx }: Props) {
  const need = 6;
  const [dodges, setDodges] = useState(0);
  const [pos, setPos] = useState({ left: 20, top: 70 });
  const [checked, setChecked] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const cap = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  useEffect(() => { ctx.say('Simply tick the box. Humans do this thousands of times a day. Easy!'); }, []);

  const react = () => {
    if (count.current >= need) return;
    count.current++;
    const n = count.current;
    setDodges(n);
    sfx.play('dodge');
    const r = wrap.current!.getBoundingClientRect();
    const w = cap.current!.offsetWidth, h = cap.current!.offsetHeight;
    setPos({ left: rand(0, Math.max(0, r.width - w - 10)), top: rand(40, Math.max(41, r.height - h - 10)) });
    ctx.shake();
    if (n === 3) ctx.say('Hm, it seems nervous. Ghosts are like that. Are YOU nervous, ghost?');
    if (n === need) { ctx.say('Fine. The checkbox is tired. Tick it.'); ctx.mood('neutral'); }
  };

  return (
    <div ref={wrap} className="runaway">
      <h2>Challenge 1: The Sacred Checkbox</h2>
      <div ref={cap} className="fake-captcha" style={pos}
        onMouseEnter={react}
        onPointerDown={(e) => { if (count.current < need) { e.preventDefault(); react(); } }}>
        <div className="box" role="checkbox" aria-checked={checked}
          onClick={() => {
            if (count.current < need || checked) return;
            setChecked(true);
            ctx.pass('Acceptable. Ticking boxes: the most human thing there is.');
          }}>{checked ? '✔' : ''}</div>
        <span>I am not a ghost</span>
      </div>
      <span className="sr-only">{dodges}</span>
    </div>
  );
}

// 2. Select all humans
function Grid({ ctx }: Props) {
  const humans = ['🧑', '👩', '👨', '🧓'];
  const others = ['🧟', '🧛', '🤖', '🎃', '💀', '🐕', '🧙', '🦇', '👽', '🧜'];
  const tiles = useMemo(() => {
    const t = [...humans.slice(0, 3 + Math.floor(Math.random() * 2))];
    while (t.length < 9) t.push(pick(others));
    return t.sort(() => Math.random() - 0.5);
  }, []);
  const [sel, setSel] = useState<Set<number>>(new Set());
  useEffect(() => { ctx.say("Pick every human. Vampires don't count, I don't care how much they say they identify as human."); }, []);

  const toggle = (i: number) => setSel((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const verify = () => {
    const target = new Set(tiles.map((t, i) => (humans.includes(t) ? i : -1)).filter((i) => i >= 0));
    const ok = sel.size === target.size && [...sel].every((i) => target.has(i));
    if (ok) return ctx.pass("Correct. I was SURE you'd pick the zombie. Disappointed. Impressed.");
    ctx.fail();
    ctx.say("WRONG. Maybe you ARE a ghost. Try again, spooky.");
  };
  return (
    <>
      <h2>Challenge 2: Select all squares with a HUMAN</h2>
      <div className="grid">
        {tiles.map((t, i) => (
          <div key={i} className={'tile' + (sel.has(i) ? ' sel' : '')} onClick={() => toggle(i)}>{t}</div>
        ))}
      </div>
      <div className="center"><button id="verify" onClick={verify}>VERIFY</button></div>
    </>
  );
}

// 3. Wobbly text
function CursedText({ ctx }: Props) {
  const word = useMemo(() => pick(['BOOKEEPER', 'SPOOKY', 'CANDLES', 'COBWEB', 'PUMPKIN', 'WITCHES', 'MIDNIGHT', 'GRAVEYARD']), []);
  const [val, setVal] = useState('');
  useEffect(() => { ctx.say("Read the letters. If you squint like a human, they stop moving. They don't."); }, []);
  const submit = () => {
    if (val.trim().toUpperCase() === word) return ctx.pass('You can read! Humans love reading. And complaining about reading.');
    ctx.fail();
    ctx.say("Nope. Was it the squiggly bit? It's always the squiggly bit.");
    setVal('');
  };
  return (
    <>
      <h2>Challenge 3: Read the cursed text</h2>
      <div className="wobble" data-word={word}>
        {[...word].map((c, i) => <span key={i} style={{ animationDelay: `${-i * 0.2}s` }}>{c}</span>)}
      </div>
      <input type="text" id="ans" placeholder="Type what you see" autoComplete="off" value={val}
        onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <p className="center"><button id="go" onClick={submit}>SUBMIT</button></p>
    </>
  );
}

// 4. Breathe
function Breathe({ ctx }: Props) {
  const need = 2;
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState('Hold the button to INHALE.');
  const hold = useRef(0), full = useRef(false), cycles = useRef(0), raf = useRef(0);
  useEffect(() => { ctx.say("Humans breathe in, and out. Do it twice. I'll be watching. Creepily."); }, []);

  const tick = () => {
    if (!hold.current) return;
    const p = Math.min((performance.now() - hold.current) / 2500, 1);
    setPct(p * 100);
    if (p >= 1 && !full.current) { full.current = true; setMsg('Now EXHALE. Let go slowly...'); }
    raf.current = requestAnimationFrame(tick);
  };
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    hold.current = performance.now(); full.current = false;
    sfx.play('inhale'); setMsg('Inhaling...'); tick();
  };
  useEffect(() => {
    const end = () => {
      if (!hold.current) return;
      cancelAnimationFrame(raf.current);
      hold.current = 0; setPct(0);
      if (full.current) {
        sfx.play('exhale');
        cycles.current++;
        if (cycles.current >= need) return ctx.pass('Oxygen detected. Suspicious, but acceptable.');
        setMsg(`Good. ${need - cycles.current} more breath to go.`);
      } else {
        setMsg('Too short! That was a hiccup, not a breath.');
        ctx.mood('angry');
      }
    };
    window.addEventListener('pointerup', end);
    return () => { window.removeEventListener('pointerup', end); cancelAnimationFrame(raf.current); };
  }, []);

  return (
    <>
      <h2>Challenge 4: Prove you breathe</h2>
      <div className="center">
        <div className="meter"><div id="bar" style={{ width: pct + '%' }} /></div>
        <p id="breathMsg">{msg}</p>
        <button id="breathBtn" onPointerDown={start}>🫁 Hold to inhale</button>
      </div>
    </>
  );
}

// 5. Heartbeat
function Heart({ ctx }: Props) {
  const taps = useRef<number[]>([]);
  const [msg, setMsg] = useState('Tap the heart 5 times in a steady rhythm.');
  const [beat, setBeat] = useState(false);
  useEffect(() => { ctx.say("Humans have a rhythm. Tap it out. Not too fast, that's panicking. Not too slow, that's dead. Well, I'd be fine with that."); }, []);
  const tap = () => {
    sfx.play('thump');
    const now = performance.now();
    const t = taps.current;
    if (t.length && now - t[t.length - 1] > 1600) taps.current = [];
    taps.current.push(now);
    setBeat(true); setTimeout(() => setBeat(false), 120);
    const a = taps.current;
    if (a.length < 5) { setMsg(`${a.length}/5...`); return; }
    const gaps = a.slice(1).map((x, i) => x - a[i]);
    const avg = gaps.reduce((x, y) => x + y) / gaps.length;
    const steady = gaps.every((g) => Math.abs(g - avg) / avg < 0.3);
    const bpm = Math.round(60000 / avg);
    taps.current = [];
    if (steady && bpm >= 45 && bpm <= 140) return ctx.pass(`${bpm} BPM. A real human heart! Gross. Beautiful.`);
    ctx.fail();
    setMsg(steady ? `${bpm} BPM? Are you a hummingbird or a rock?` : 'That rhythm is all over the place. Try again.');
    ctx.say(steady ? 'Between 45 and 140 BPM, please.' : 'Irregular! Do you need a doctor or an exorcist?');
  };
  return (
    <>
      <h2>Challenge 5: Show me your heartbeat</h2>
      <div className="center">
        <div className="big heart" id="heart" style={{ transform: beat ? 'scale(1.4)' : '' }}>❤</div>
        <p id="hMsg">{msg}</p>
        <button id="tap" onClick={tap}>TAP 💓</button>
      </div>
    </>
  );
}

// 6. Embarrassing secret
function Secret({ ctx }: Props) {
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { ctx.say('Last one. Only humans feel shame. Tell me something embarrassing. Be specific.'); }, []);
  const confess = async () => {
    const s = v.trim();
    if (s.length < 20) { ctx.fail(); ctx.say("That's not embarrassing, that's a tweet. MORE. At least 20 characters of shame."); return; }
    setBusy(true);
    await ctx.say('Hmmmm, analyzing shame levels...');
    await sleep(300);
    await ctx.say(`"${s.slice(0, 40)}${s.length > 40 ? '...' : ''}" Yes. That's the cringiest thing I've ever heard.`);
    await sleep(300);
    ctx.pass('SO. HUMAN.');
  };
  return (
    <>
      <h2>Final Challenge: Confess</h2>
      <textarea id="secret" rows={4} placeholder="Tell me your most human, embarrassing secret..." value={v} onChange={(e) => setV(e.target.value)} />
      <p className="center"><button id="confess" disabled={busy} onClick={confess}>CONFESS</button></p>
    </>
  );
}

export const CHALLENGES = [Runaway, Grid, CursedText, Breathe, Heart, Secret];
