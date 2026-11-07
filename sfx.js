// Sound effects via WebAudio only. Fails silently if unavailable.
const sfx = (() => {
  let ctx = null, master = null, drone = null, inhale = null;
  let muted = false;
  try { muted = localStorage.getItem('saveBooMuted') === '1'; } catch (e) {}

  const safe = (fn) => (...a) => { try { return fn(...a); } catch (e) {} };

  const unlock = safe(() => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      startDrone();
    }
    if (ctx.state === 'suspended') ctx.resume();
  });

  function tone(freq, start, dur, { type = 'sine', vol = 0.15, to = null, dest = null } = {}) {
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t); o.stop(t + dur + 0.05);
    return { o, g };
  }

  function startDrone() {
    const g = ctx.createGain();
    g.gain.value = 0.035;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.15; lg.gain.value = 0.02;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    [55, 82.5, 110.7].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      o.connect(g); o.start();
    });
    g.connect(master);
    drone = g;
  }

  const sounds = {
    dodge: () => tone(900, 0, 0.18, { type: 'sawtooth', vol: 0.05, to: 200 }),
    buzz: () => { tone(110, 0, 0.3, { type: 'sawtooth', vol: 0.12 }); tone(117, 0, 0.3, { type: 'square', vol: 0.06 }); },
    chime: () => [660, 880, 1320].forEach((f, i) => tone(f, i * 0.09, 0.5, { vol: 0.12 })),
    thump: () => { tone(90, 0, 0.14, { vol: 0.4, to: 45 }); tone(80, 0.16, 0.14, { vol: 0.3, to: 40 }); },
    exhale: () => {
      if (inhale) { try { inhale.o.stop(); } catch (e) {} inhale = null; }
      tone(330, 0, 0.9, { vol: 0.08, to: 130 });
    },
    fanfare: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.4, { type: 'triangle', vol: 0.15 }));
      tone(1047, 0.6, 0.9, { type: 'triangle', vol: 0.15 });
      [900, 1200, 1000, 1400].forEach((f, i) => tone(f, 1.6 + i * 0.1, 0.12, { vol: 0.08, to: f * 1.3 }));
    },
  };

  function inhaleStart() {
    if (inhale) return;
    inhale = tone(130, 0, 2.5, { vol: 0.08, to: 330 });
  }

  return {
    unlock,
    play: safe((name) => {
      if (name === 'inhale') { if (ctx && !muted) inhaleStart(); return; }
      if (ctx && !muted && sounds[name]) sounds[name]();
    }),
    isMuted: () => muted,
    setMuted: safe((m) => {
      muted = m;
      try { localStorage.setItem('saveBooMuted', m ? '1' : '0'); } catch (e) {}
      if (master) master.gain.value = m ? 0 : 1;
    }),
  };
})();

(() => {
  const btn = document.getElementById('muteBtn');
  const render = () => {
    btn.textContent = sfx.isMuted() ? '🔇' : '🔊';
    btn.setAttribute('aria-label', sfx.isMuted() ? 'Unmute sound' : 'Mute sound');
    btn.setAttribute('aria-pressed', String(sfx.isMuted()));
  };
  btn.addEventListener('click', () => { sfx.unlock(); sfx.setMuted(!sfx.isMuted()); render(); });
  render();
  window.addEventListener('pointerdown', sfx.unlock);
  window.addEventListener('keydown', sfx.unlock);
})();
