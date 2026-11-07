// Sound effects via WebAudio only. Fails silently if unavailable.
export type SfxName = 'dodge' | 'buzz' | 'chime' | 'thump' | 'exhale' | 'fanfare' | 'inhale';
interface ToneOpts { type?: OscillatorType; vol?: number; to?: number | null; dest?: AudioNode | null }
interface ToneHandle { o: OscillatorNode; g: GainNode }

export const sfx = (() => {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let inhale: ToneHandle | null = null;
  let muted = false;
  const listeners: Array<(m: boolean) => void> = [];
  try { muted = localStorage.getItem('saveBooMuted') === '1'; } catch (e) {}

  const safe = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A): void => { try { fn(...a); } catch (e) { /* audio is best effort */ } };

  const unlock = safe(() => {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const c = new AC();
      const m = c.createGain();
      m.gain.value = muted ? 0 : 1;
      m.connect(c.destination);
      ctx = c; master = m;
      startDrone(c, m);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  });

  function tone(c: AudioContext, m: GainNode, freq: number, start: number, dur: number, { type = 'sine', vol = 0.15, to = null, dest = null }: ToneOpts = {}): ToneHandle {
    const t = c.currentTime + start;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || m);
    o.start(t); o.stop(t + dur + 0.05);
    return { o, g };
  }

  function startDrone(c: AudioContext, m: GainNode) {
    const g = c.createGain();
    g.gain.value = 0.035;
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 0.15; lg.gain.value = 0.02;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    [55, 82.5, 110.7].forEach((f) => {
      const o = c.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      o.connect(g); o.start();
    });
    g.connect(m);
  }

  // Only called when ctx and master exist (play() guards this).
  const sounds: Record<Exclude<SfxName, 'inhale'>, (c: AudioContext, m: GainNode) => void> = {
    dodge: (c, m) => tone(c, m, 900, 0, 0.18, { type: 'sawtooth', vol: 0.05, to: 200 }),
    buzz: (c, m) => { tone(c, m, 110, 0, 0.3, { type: 'sawtooth', vol: 0.12 }); tone(c, m, 117, 0, 0.3, { type: 'square', vol: 0.06 }); },
    chime: (c, m) => [660, 880, 1320].forEach((f, i) => tone(c, m, f, i * 0.09, 0.5, { vol: 0.12 })),
    thump: (c, m) => { tone(c, m, 90, 0, 0.14, { vol: 0.4, to: 45 }); tone(c, m, 80, 0.16, 0.14, { vol: 0.3, to: 40 }); },
    exhale: (c, m) => {
      if (inhale) { try { inhale.o.stop(); } catch (e) {} inhale = null; }
      tone(c, m, 330, 0, 0.9, { vol: 0.08, to: 130 });
    },
    fanfare: (c, m) => {
      [523, 659, 784, 1047].forEach((f, i) => tone(c, m, f, i * 0.14, 0.4, { type: 'triangle', vol: 0.15 }));
      tone(c, m, 1047, 0.6, 0.9, { type: 'triangle', vol: 0.15 });
      [900, 1200, 1000, 1400].forEach((f, i) => tone(c, m, f, 1.6 + i * 0.1, 0.12, { vol: 0.08, to: f * 1.3 }));
    },
  };

  function inhaleStart(c: AudioContext, m: GainNode) {
    if (inhale) return;
    inhale = tone(c, m, 130, 0, 2.5, { vol: 0.08, to: 330 });
  }

  return {
    unlock,
    play: safe((name: SfxName) => {
      if (!ctx || !master || muted) return;
      if (name === 'inhale') { inhaleStart(ctx, master); return; }
      sounds[name]?.(ctx, master);
    }),
    isMuted: () => muted,
    setMuted: safe((m: boolean) => {
      muted = m;
      try { localStorage.setItem('saveBooMuted', m ? '1' : '0'); } catch (e) {}
      if (master) master.gain.value = m ? 0 : 1;
      listeners.forEach((f) => f(m));
    }),
    onMuteChange: (f: (m: boolean) => void) => {
      listeners.push(f);
      return () => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); };
    },
  };
})();

