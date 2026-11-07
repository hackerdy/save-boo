import { sfx } from './sfx';
// Voice overs via the browser SpeechSynthesis API (no audio files, no network).
// Mortimer: low, slow, creaky. Boo: high, fast, squeaky.
// Subtitles are handled by game.js, so everything still works with no speech support.
export const voice = (() => {
  const synth = window.speechSynthesis;
  const supported = !!(synth && window.SpeechSynthesisUtterance);
  let enabled = false;      // becomes true after the Begin click (user gesture)
  let voices = [];
  let current: any = null;       // { who, timer, resolve, raf }
  let mouthCb: (who: string, v: number) => void = () => {};
  let token = 0;

  const PROFILES = {
    grand: {
      pitch: 0.35, rate: 0.82, volume: 1,
      prefer: [/daniel/i, /george/i, /ryan/i, /google uk english male/i, /alex/i, /fred/i, /male/i, /david/i, /mark/i],
    },
    boo: {
      pitch: 2, rate: 1.15, volume: 1,
      prefer: [/samantha/i, /zira/i, /karen/i, /google us english/i, /google uk english female/i, /female/i, /susan/i, /hazel/i],
    },
  };

  const loadVoices = () => { if (supported) voices = synth.getVoices() || []; };
  if (supported) {
    loadVoices();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices);
  }

  function pickVoice(who) {
    const en = voices.filter((v) => /^en[-_]/i.test(v.lang) || /^en$/i.test(v.lang));
    const pool = en.length ? en : voices;
    for (const re of PROFILES[who].prefer) {
      const v = pool.find((x) => re.test(x.name));
      if (v) return v;
    }
    return pool.find((v) => v.default) || pool[0] || null;
  }

  const isMuted = () => (sfx.isMuted());

  function stopCurrent() {
    token++;
    if (!current) return;
    const c = current;
    current = null;
    clearTimeout(c.timer);
    cancelAnimationFrame(c.raf);
    mouthCb(c.who, 0);
    c.resolve();
  }

  function cancel() {
    if (supported) { try { synth.cancel(); } catch (e) {} }
    stopCurrent();
  }

  // Estimated speaking time, used to drive the mouth and to resolve the promise
  // when speech is muted, unsupported, or never fires events.
  const estimate = (text, who) => Math.max(900, (text.length * 62) / PROFILES[who].rate);

  // Animate the mouth until `until` (timestamp). Boundary events add extra accents.
  function animateMouth(c, until) {
    const t0 = performance.now();
    const loop = (now) => {
      if (current !== c) return;
      if (now > until) return;
      const t = (now - t0) / 1000;
      const v = Math.abs(Math.sin(t * 11)) * (0.55 + 0.45 * Math.abs(Math.sin(t * 4.3)));
      mouthCb(c.who, Math.min(1, v + c.accent));
      c.accent *= 0.85;
      c.raf = requestAnimationFrame(loop);
    };
    c.raf = requestAnimationFrame(loop);
  }

  // Returns a promise that resolves when the line is finished or cancelled.
  function speak(who, text) {
    cancel();
    const my = token;
    return new Promise<void>((resolve) => {
      const dur = estimate(text, who);
      const c = { who, resolve, timer: 0, raf: 0, accent: 0 };
      current = c;
      const finish = () => { if (current === c) stopCurrent(); else resolve(); };

      // Muted or no speech: still animate the mouth, resolve quickly.
      if (!enabled || isMuted() || !supported) {
        animateMouth(c, performance.now() + dur);
        c.timer = setTimeout(finish, isMuted() || !enabled ? Math.min(dur, 2500) : dur);
        return;
      }
      try {
        const p = PROFILES[who];
        const u = new SpeechSynthesisUtterance(text.replace(/\s*\.\.\.\s*/g, ', '));
        const v = pickVoice(who);
        if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
        u.pitch = p.pitch; u.rate = p.rate; u.volume = p.volume;
        let started = false;
        u.onstart = () => {
          started = true;
          clearTimeout(c.timer);
          animateMouth(c, performance.now() + 60000);
          c.timer = setTimeout(finish, dur * 2.5 + 3000); // safety net
        };
        u.onboundary = () => { c.accent = 0.5; };
        u.onend = finish;
        u.onerror = (ev: any) => {
          if (ev && (ev.error === 'canceled' || ev.error === 'interrupted')) return finish();
          // Speech failed (no voices, blocked): keep the subtitle up for a readable time.
          clearTimeout(c.timer);
          cancelAnimationFrame(c.raf);
          animateMouth(c, performance.now() + dur);
          c.timer = setTimeout(finish, dur);
        };
        // If speech never starts (blocked, no voices), fall back to timer mouth.
        c.timer = setTimeout(() => {
          if (!started && current === c) {
            animateMouth(c, performance.now() + dur);
            c.timer = setTimeout(finish, dur);
          }
        }, 900);
        // Chrome sometimes needs a tick after cancel().
        setTimeout(() => { if (token === my && current === c) { try { synth.speak(u); } catch (e) { finish(); } } }, 30);
      } catch (e) {
        animateMouth(c, performance.now() + dur);
        c.timer = setTimeout(finish, dur);
      }
    });
  }

  function enable() { enabled = true; loadVoices(); }

  sfx.onMuteChange((m) => { if (m) cancel(); });
  window.addEventListener('pagehide', cancel);

  return {
    speak, cancel, enable, supported,
    set onMouth(fn) { mouthCb = fn || (() => {}); },
    describe: (who) => { const v = pickVoice(who); return v ? v.name : 'default'; },
  };
})();
