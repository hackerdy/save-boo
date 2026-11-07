import { useCallback, useEffect, useRef, useState } from 'react';
import { createScene, SceneApi } from './game/scene3d';
import { sfx } from './game/sfx';
import { voice } from './game/voice';
import { makeRun, TOTAL } from './challenges/Challenges';
import { ChallengeCtx, Who } from './types';
import { Confetti } from './components/Confetti';
import { FallbackStage } from './components/FallbackStage';
import { rate, Results, RunStats } from './components/Results';
import { SettingsPanel } from './components/SettingsPanel';
import { pickLine, PoolKey } from './game/lines';
import { ai, AiContext, line, liveLine, warm } from './game/ai';
import { haptic, settings, useSettings } from './game/settings';

type Phase = 'intro' | 'greeting' | 'trial' | 'passed' | 'finale' | 'done';
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const IDLE_MS = 15000;      // Mortimer nudges after this long without input
const ASSIST_FAILS = 4;     // mistakes on one challenge before the mercy button appears

const FIRST_GREETING = pickLine('greeting');
if (settings.get().aiEnabled) warm('greeting');      // only for players who opted in to AI Mortimer

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneApi | null>(null);
  const fbRef = useRef<{ mouth: (who: Who, v: number) => void } | null>(null);
  const [webgl, setWebgl] = useState(true);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('intro');
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(makeRun);
  const [sub, setSub] = useState<{ who: Who; text: string }>({ who: 'grand', text: FIRST_GREETING });
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(sfx.isMuted());
  const [confetti, setConfetti] = useState(0);
  const [bloom, setBloom] = useState(false);
  const [assist, setAssist] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [verdict, setVerdict] = useState('');
  const [results, setResults] = useState<RunStats>({ secs: 0, mistakes: 0, hints: 0, assists: 0 });
  const [, setVoiceTick] = useState(0);
  const set = useSettings();

  const runId = useRef(0);
  const sayTok = useRef(0);
  const phaseRef = useRef<Phase>('intro');
  const speakingRef = useRef(false);
  const greeting = useRef(FIRST_GREETING);
  const stats = useRef({ start: 0, mistakes: 0, hints: 0, assists: 0 });
  const fails = useRef(0);
  const reducedRef = useRef(set.reducedMotion);
  const runRef = useRef(run);
  const stepRef = useRef(step);
  phaseRef.current = phase;
  speakingRef.current = speaking;
  reducedRef.current = set.reducedMotion;
  runRef.current = run;
  stepRef.current = step;

  // Context sent to AI Mortimer: game state only, never user input (the confession goes through `react`).
  const aiCtx = useCallback((): AiContext => ({
    challenge: runRef.current[Math.min(stepRef.current, TOTAL - 1)].id,
    fails: fails.current,
    secs: stats.current.start ? (Date.now() - stats.current.start) / 1000 : 0,
  }), []);
  const lineFor = useCallback((key: PoolKey) => line(key, aiCtx()), [aiCtx]);
  const react = useCallback(async (text: string) => {
    const s = settings.get();
    if (!s.aiEnabled || !s.aiRoast) return null;
    return ai.ask('confession-reaction', { ...aiCtx(), challenge: 'secret', text });
  }, [aiCtx]);

  // 3D scene lifecycle
  useEffect(() => {
    const s = createScene(canvasRef.current!);
    sceneRef.current = s;
    setWebgl(s.ok);
    s.setReducedMotion(settings.get().reducedMotion);
    s.setLowPower(settings.get().lowPower);
    setReady(true);
    voice.onMouth = (who, v) => { s.mouth(who, v); fbRef.current?.mouth(who, v); };
    const off = voice.onVoices(() => setVoiceTick((n) => n + 1));
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      off();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      voice.cancel();
      s.dispose();
    };
  }, []);

  // Apply persisted settings
  useEffect(() => {
    document.body.classList.toggle('reduced-motion', set.reducedMotion);
    document.body.classList.toggle('captions-large', set.largeCaptions);
    voice.setVoiceOn(set.voice);
    sceneRef.current?.setReducedMotion(set.reducedMotion);
    sceneRef.current?.setLowPower(set.lowPower);
  }, [set, ready]);

  const say = useCallback((text: string, who: Who = 'grand') => {
    const id = ++sayTok.current;
    setSub({ who, text });
    setSpeaking(true);
    return voice.speak(who, text).then(() => { if (sayTok.current === id) setSpeaking(false); });
  }, []);

  const skip = useCallback(() => { voice.cancel(); setSpeaking(false); }, []);

  const mood = useCallback((m: 'happy' | 'angry' | 'neutral') => {
    sceneRef.current?.mood(m);
    if (m === 'angry') sfx.play('buzz');
  }, []);
  const shake = useCallback(() => sceneRef.current?.shake(), []);

  // A wrong answer: feedback plus an escalating Mortimer reaction. Many failures unlock the mercy button.
  const fail = useCallback((specific?: string) => {
    stats.current.mistakes++;
    const n = ++fails.current;
    mood('angry'); shake(); haptic([80, 40, 80]);
    let text: string;
    if (n === ASSIST_FAILS) { text = pickLine('assistOffer'); setAssist(true); }
    else if (n > ASSIST_FAILS) text = lineFor('failKind');
    else if (n === 3) text = lineFor('failSnark');
    else text = liveLine('failMild', aiCtx()) ?? specific ?? pickLine('failMild');
    say(text);
  }, [mood, shake, say, lineFor, aiCtx]);

  const begin = async () => {
    sfx.unlock();
    voice.enable();
    const id = ++runId.current;
    const next = makeRun();
    setRun(next);
    stats.current = { start: Date.now(), mistakes: 0, hints: 0, assists: 0 };
    fails.current = 0;
    runRef.current = next;
    stepRef.current = 0;
    greeting.current = lineFor('greeting');
    warm(('intro_' + next[0].id) as PoolKey);
    setVerdict('');
    setAssist(false);
    setPhase('greeting');
    await say(greeting.current);
    if (runId.current === id) goto(0);
  };

  const goto = (n: number) => {
    runId.current++;
    voice.cancel();
    if (n >= TOTAL) return finale();
    fails.current = 0;
    setAssist(false);
    setStep(n);
    // Warm the live-line cache for this trial and the next, so lines are ready without added latency.
    const r = runRef.current;
    const cur = r[n].id;
    warm('failMild', { challenge: cur }); warm('passGeneric', { challenge: cur }); warm('idle', { challenge: cur });
    if (n + 1 < TOTAL) warm(('intro_' + r[n + 1].id) as PoolKey);
    else warm('finale3');
    sceneRef.current?.setProgress(n / TOTAL);
    sceneRef.current?.cam(n + 1);
    sceneRef.current?.mood('neutral');
    setPhase('trial');
  };

  const onPass = useCallback((msg: string) => {
    sfx.play('chime');
    haptic(40);
    sceneRef.current?.mood('happy');
    sceneRef.current?.pass();
    setStep((s) => { const n = s + 1; sceneRef.current?.setProgress(n / TOTAL); return n; });
    setAssist(false);
    setPhase('passed');
    say(msg);
  }, [say]);

  const useAssist = () => { stats.current.assists++; onPass(pickLine('assistTaken')); };

  const finale = async () => {
    const id = ++runId.current;
    const scene = sceneRef.current;
    const st = stats.current;
    const res = { secs: Math.round((Date.now() - st.start) / 1000), mistakes: st.mistakes, hints: st.hints, assists: st.assists };
    setResults(res);
    const { title, pct } = rate(res);
    // The verdict is generated while the finale plays; scripted card text is used if it does not arrive.
    ai.ask('humanity-verdict', { secs: res.secs, fails: res.mistakes, extra: `Humanity rating ${pct} percent, title: ${title}.` })
      .then((v) => { if (v && runId.current === id) setVerdict(v); });
    setPhase('finale');
    setStep(TOTAL);
    scene?.setProgress(1);
    scene?.mood('happy');
    scene?.cam(7);                                   // slow camera push towards Boo
    await Promise.all([say(pickLine('finale1')), sleep(2600)]);
    if (runId.current !== id) return;
    scene?.finale();                                 // reveal: light flash and burst
    if (!reducedRef.current) { setBloom(true); setConfetti((c) => c + 1); }
    haptic([60, 40, 60, 40, 200]);
    sfx.play('fanfare');
    await Promise.all([say(pickLine('finale2'), 'boo'), sleep(2500)]);
    if (runId.current !== id) return;
    await say(lineFor('finale3'));
    if (runId.current === id) setPhase('done');
  };

  const again = () => {
    runId.current++;
    voice.cancel();
    sceneRef.current?.reset();
    setStep(0);
    setBloom(false);
    setAssist(false);
    const next = makeRun();
    setRun(next);
    runRef.current = next;
    ai.resetRun();
    warm('greeting');
    setVerdict('');
    greeting.current = pickLine('greeting');
    setSub({ who: 'grand', text: greeting.current });
    setSpeaking(false);
    setPhase('intro');
  };

  // AI is opt-in: nothing is sent to the third-party service until the player turns it on.
  const toggleAi = () => {
    const on = !settings.get().aiEnabled;
    settings.set({ aiEnabled: on });
    if (on) warm('greeting');
  };

  const toggleMute = () => {
    sfx.unlock();
    sfx.setMuted(!sfx.isMuted());
    setMuted(sfx.isMuted());
  };

  // Keyboard skip: Escape anywhere, Space/Enter while Mortimer is introducing or the finale plays.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (showSettings) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON');
      if (e.key === 'Escape') { if (speakingRef.current) skip(); return; }
      if ((e.key === ' ' || e.key === 'Enter') && !typing && (phaseRef.current === 'greeting' || phaseRef.current === 'finale')) {
        e.preventDefault(); skip();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [skip, showSettings]);

  // Idle nudges: a hint line after 15s of no input, mercy button after repeated nudges.
  useEffect(() => {
    if (phase !== 'trial') return;
    let last = Date.now(), nudges = 0;
    const bump = () => { last = Date.now(); };
    const evs = ['pointerdown', 'pointermove', 'keydown'] as const;
    evs.forEach((e) => window.addEventListener(e, bump));
    const iv = setInterval(() => {
      if (speakingRef.current || Date.now() - last < IDLE_MS) return;
      last = Date.now();
      nudges++;
      stats.current.hints++;
      say(lineFor('idle') + ' ' + pickLine(run[step].hint));
      if (nudges >= 3) setAssist(true);
    }, 1000);
    return () => { clearInterval(iv); evs.forEach((e) => window.removeEventListener(e, bump)); };
  }, [phase, step, run, say, lineFor]);

  const ctx: ChallengeCtx = {
    say, fail, mood, shake, pass: onPass, line: lineFor, react,
    n: step + 1, total: TOTAL, fails: () => fails.current, reduced: set.reducedMotion,
  };
  const Challenge = run[Math.min(step, TOTAL - 1)].Component;
  const voiceNote = !voice.supported
    ? 'Speech is not supported in this browser, so Mortimer and Boo will use subtitles only.'
    : !voice.available()
      ? 'No speech voices found (yet). If none appear, you will get subtitles only.'
      : !set.voice ? 'Voice is off. Subtitles only.' : '';

  return (
    <div className={'app' + (webgl ? ' has3d' : '')}>
      <canvas id="scene" ref={canvasRef} aria-hidden="true" style={{ display: webgl ? 'block' : 'none' }} />
      {!webgl && <FallbackStage ref={fbRef} progress={step / TOTAL} />}
      {bloom && <div className="bloom" aria-hidden="true" />}

      <header>
        <h1>Save Boo</h1>
        <div className="progress" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={TOTAL} aria-valuenow={Math.min(step, TOTAL)}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <span key={i} className={i < step ? 'done' : i === step && phase === 'trial' ? 'now' : ''} />
          ))}
        </div>
        <button id="settingsBtn" className="iconbtn" type="button" onClick={() => setShowSettings(true)} aria-label="Open settings" title="Settings">⚙️</button>
        <button id="muteBtn" className="iconbtn" type="button" onClick={toggleMute} title="Toggle sound and voice"
          aria-label={muted ? 'Unmute sound and voice' : 'Mute sound and voice'} aria-pressed={muted}>
          {muted ? '🔇' : '🔊'}
        </button>
      </header>

      <div className="ui">
        <div id="speech" className={'subtitle ' + sub.who} role="status" aria-live="polite" aria-atomic="true">
          <strong>{sub.who === 'boo' ? 'Boo' : 'Mortimer'}</strong>
          <span>{sub.text}</span>
          {speaking && <button className="skip" onClick={skip} aria-label="Skip this voice line (Escape)">Skip</button>}
        </div>

        <section id="challenge" className="panel" aria-label="Current challenge">
          {!ready && <div className="center"><p className="lead boot" id="boot">Summoning the ghosts...</p></div>}
          {ready && phase === 'intro' && (
            <div className="center intro">
              <div className="intro-ghosts" aria-hidden="true"><span>👻</span><span>🧓</span></div>
              <p className="lead">Little Boo has faded away. Only a verified <b>human</b> can bring her back. Beat six quick trials. Every run is different.</p>
              <div className="row">
                <button id="soundChoice" type="button" className="ghostbtn" aria-pressed={!muted} onClick={toggleMute}>Sound: {muted ? 'off' : 'on'}</button>
                <button id="voiceChoice" type="button" className="ghostbtn" aria-pressed={set.voice} onClick={() => settings.set({ voice: !set.voice })}>Voice: {set.voice ? 'on' : 'off'}</button>
                <button id="aiChoice" type="button" className="ghostbtn" aria-pressed={set.aiEnabled} onClick={toggleAi}>AI Mortimer: {set.aiEnabled ? 'on' : 'off'}</button>
              </div>
              <button id="begin" autoFocus onClick={begin}>Begin the Trials</button>
              <p className="hint" id="voiceNote">{voiceNote || 'Headphones recommended. Escape skips a voice line.'} AI Mortimer is optional and off by default. If on, trial name, mistakes and time go to a free third-party AI service.</p>
            </div>
          )}
          {phase === 'greeting' && <div className="center"><p className="lead">Mortimer is speaking... <span className="hint">(Space or Escape to skip)</span></p></div>}
          {phase === 'trial' && (
            <>
              <Challenge key={step} ctx={ctx} />
              {assist && <div className="center"><button id="assist" className="ghostbtn" onClick={useAssist}>Let Mortimer wave you through</button></div>}
            </>
          )}
          {phase === 'passed' && (
            <div className="center">
              <p className="big" aria-hidden="true">✅</p>
              <button id="nextBtn" autoFocus onClick={() => goto(step)}>{step >= TOTAL ? 'Wake up Boo!' : 'Next trial →'}</button>
            </div>
          )}
          {phase === 'finale' && <div className="center big" aria-label="Boo is waking up">✨</div>}
          {phase === 'done' && <Results stats={results} verdict={verdict} onAgain={again} />}
        </section>
      </div>
      {showSettings && <SettingsPanel muted={muted} onMute={toggleMute} voiceNote={voiceNote} onClose={() => setShowSettings(false)} />}
      {confetti > 0 && !set.reducedMotion && <Confetti key={confetti} />}
    </div>
  );
}
